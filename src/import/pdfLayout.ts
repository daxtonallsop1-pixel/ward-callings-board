import { matchColumns } from './columnMatch';
import { parseDate } from '../model/tenure';

/*
 * Rebuilds a table from a PDF's positioned text.
 *
 * A PDF has no table – just words placed at x/y coordinates. LCR's printed
 * reports are simple grids, so:
 *   1. group words into lines by their y position,
 *   2. find the heading line (Name, Gender, …) and use each heading's x as a
 *      column start,
 *   3. drop every word into the column it sits under,
 *   4. fold wrapped lines (a long calling on two lines) into their row.
 * Page titles above the heading, repeated headings on later pages and page
 * footers are ignored.
 */

export interface PdfItem {
  str: string;
  x: number;
  y: number; // PDF coordinates: larger = higher on the page
  w: number;
  h: number;
}

interface Line {
  y: number;
  h: number;
  items: PdfItem[];
}

interface Column {
  title: string;
  x: number;
}

const SLACK = 4;

function groupLines(items: PdfItem[]): Line[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Line[] = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    const tol = Math.max(2, (it.h || 8) * 0.4);
    if (last && Math.abs(last.y - it.y) <= tol) {
      last.items.push(it);
      last.h = Math.max(last.h, it.h || 0);
    } else {
      lines.push({ y: it.y, h: it.h || 8, items: [it] });
    }
  }
  for (const l of lines) l.items.sort((a, b) => a.x - b.x);
  return lines;
}

/** Joins words that sit right next to each other ("Birth" + "Date"). */
function phrases(line: Line): Column[] {
  const out: Column[] = [];
  let end = -Infinity;
  for (const it of line.items) {
    const gap = it.x - end;
    const cur = out[out.length - 1];
    if (cur && gap < Math.max(3, (it.h || 8) * 0.6)) cur.title += (gap > 0.5 ? ' ' : '') + it.str.trim();
    else out.push({ title: it.str.trim(), x: it.x });
    end = it.x + (it.w || it.str.length * (it.h || 8) * 0.5);
  }
  return out.filter((p) => p.title);
}

function headerOf(line: Line): Column[] | undefined {
  const cols = phrases(line);
  const hasName = cols.some((c) => /^(preferred )?name$/i.test(c.title));
  return hasName && cols.length >= 3 ? cols : undefined;
}

function cellsOf(line: Line, cols: Column[]): string[] {
  const cells = cols.map(() => [] as string[]);
  for (const it of line.items) {
    let idx = -1;
    for (let i = 0; i < cols.length; i++) if (cols[i].x <= it.x + SLACK) idx = i;
    if (idx < 0) idx = 0;
    cells[idx].push(it.str.trim());
  }
  return cells.map((c) => c.join(' ').replace(/\s+/g, ' ').trim());
}

interface Row {
  y: number;
  cells: string[];
  /** Extra wrapped lines: [y, cells] */
  extra: { y: number; cells: string[] }[];
}

export function tableFromPdfItems(pages: PdfItem[][]): string | undefined {
  let cols: Column[] | undefined;
  const rows: Row[] = [];

  for (const items of pages) {
    const lines = groupLines(items.filter((i) => i.str.trim()));
    const hIdx = lines.findIndex((l) => !!headerOf(l));
    if (hIdx >= 0 && !cols) cols = headerOf(lines[hIdx]);
    if (!cols) continue;
    const body = lines.slice(hIdx + 1).map((l) => ({ y: l.y, h: l.h, cells: cellsOf(l, cols!) }));

    const nameIdx = cols.findIndex((c) => /^(preferred )?name$/i.test(c.title));
    const named = body.filter((l) => l.cells[nameIdx]);
    // LCR names are "Last, First". If nearly all are, a comma-less "name" is
    // page furniture (ward title, printed date) or the 2nd line of a wrap.
    const commaShare = named.filter((l) => l.cells[nameIdx].includes(',')).length / Math.max(1, named.length);
    const isAnchor = (l: { cells: string[] }) => !!l.cells[nameIdx] && (commaShare < 0.8 || l.cells[nameIdx].includes(','));

    const anchors = body.filter(isAnchor);
    const gaps = anchors.slice(1).map((a, i) => anchors[i].y - a.y).sort((a, b) => a - b);
    const median = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;
    const typicalH = body[0]?.h ?? 8;
    const reach = median ? median * 0.6 : typicalH * 1.8;

    const pageRows: Row[] = anchors.map((a) => ({ y: a.y, cells: a.cells, extra: [] }));
    for (const l of body) {
      if (isAnchor(l)) continue;
      let best: Row | undefined;
      for (const r of pageRows) if (!best || Math.abs(r.y - l.y) < Math.abs(best.y - l.y)) best = r;
      if (best && Math.abs(best.y - l.y) <= reach) {
        best.extra.push({ y: l.y, cells: l.cells });
      } else if (l.cells.filter(Boolean).length >= 3) {
        // A far-away line with real content but no name: keep it so the
        // import preview can report it as skipped rather than hide it.
        pageRows.push({ y: l.y, cells: l.cells, extra: [] });
      }
    }
    pageRows.sort((a, b) => b.y - a.y);
    rows.push(...pageRows);
  }

  if (!cols || !rows.length) return undefined;

  const setApartIdx = (() => {
    const hit = matchColumns(cols.map((c) => c.title), ['setApart']).setApart;
    return hit ? cols.findIndex((c) => c.title === hit) : -1;
  })();

  const lines = [cols.map((c) => c.title)];
  for (const r of rows) {
    const parts = [{ y: r.y, cells: r.cells }, ...r.extra].sort((a, b) => b.y - a.y);
    const cells = cols.map((_, i) =>
      parts
        .map((p) => p.cells[i])
        .filter(Boolean)
        .join(' '),
    );
    // The ✔ glyph extracts differently per font; any mark in the column counts.
    if (setApartIdx >= 0 && cells[setApartIdx] && !parseDate(cells[setApartIdx])) cells[setApartIdx] = '✔';
    lines.push(cells);
  }
  return lines.map((r) => r.map((c) => c.replace(/\t/g, ' ')).join('\t')).join('\n');
}

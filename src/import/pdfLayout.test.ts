import { describe, expect, it } from 'vitest';
import { tableFromPdfItems, type PdfItem } from './pdfLayout';
import { parseCsv, buildBaseline, CALLING_FIELDS } from './importLcr';
import { matchColumns } from './columnMatch';

// Column starts roughly matching LCR's "Members with Callings" print layout.
const X = { name: 40, gender: 150, age: 185, birth: 212, org: 268, calling: 360, sustained: 505, setApart: 556 };
const H = 9;

const t = (str: string, x: number, y: number): PdfItem => ({ str, x, y, w: str.length * 4.6, h: H });

function header(y: number): PdfItem[] {
  return [
    t('Name', X.name, y),
    t('Gender', X.gender, y),
    t('Age', X.age, y),
    t('Birth', X.birth, y),
    t('Date', X.birth + 25, y), // split into two words, like some PDFs do
    t('Organization', X.org, y),
    t('Calling', X.calling, y),
    t('Sustained', X.sustained, y),
    t('Set Apart', X.setApart, y),
  ];
}

function row(y: number, name: string, g: string, age: string, org: string, calling: string, sus: string, sa: boolean): PdfItem[] {
  return [
    t(name, X.name, y),
    t(g, X.gender, y),
    t(age, X.age, y),
    t('1 Jan 1990', X.birth, y),
    t(org, X.org, y),
    t(calling, X.calling, y),
    t(sus, X.sustained, y),
    ...(sa ? [t('✔', X.setApart + 12, y)] : []),
  ];
}

const page1: PdfItem[] = [
  t('Maple Grove Ward (1234567)', X.name, 760),
  t('Members with Callings', 480, 760),
  t('Sample Stake (7654321)', X.name, 748),
  ...header(720),
  ...row(700, 'Doe, John', 'M', '32', 'Bishopric', 'Ward Assistant Clerk', '30 Aug 2026', true),
  ...row(677, 'Doe, Jane', 'F', '31', 'Primary', 'Primary Teacher', '2 Nov 2025', false),
  // Long calling wrapped onto two lines, other cells vertically centred
  ...row(654, 'Roe, Ann', 'F', '28', 'Relief Society', '', '12 Oct 2025', true).filter((i) => i.str),
  t('Relief Society Compassionate', X.calling, 659),
  t('Service Coordinator', X.calling, 649),
  ...row(631, 'Poe, Sam', 'M', '45', 'Elders Quorum', 'Elders Quorum President', '1 Jan 2026', true),
  // Footer
  t('Printed 13 Sep 2026', X.name, 40),
  t('Page 1 of 2', 520, 40),
];

const page2: PdfItem[] = [
  t('Maple Grove Ward (1234567)', X.name, 760),
  ...header(720),
  ...row(700, 'Loe, Kim', 'F', '50', 'Sunday School', 'Sunday School President', '3 Mar 2025', true),
  ...row(677, 'Moe, Tim', 'M', '61', 'Stake High Council', 'High Councilor', '9 Sep 2024', true),
  t('Page 2 of 2', 520, 40),
];

describe('tableFromPdfItems', () => {
  const text = tableFromPdfItems([page1, page2])!;
  const p = parseCsv(text);

  it('rebuilds the header and every row across pages', () => {
    expect(p.headers).toEqual(['Name', 'Gender', 'Age', 'Birth Date', 'Organization', 'Calling', 'Sustained', 'Set Apart']);
    expect(p.rows.map((r) => r.Name)).toEqual(['Doe, John', 'Doe, Jane', 'Roe, Ann', 'Poe, Sam', 'Loe, Kim', 'Moe, Tim']);
  });

  it('joins wrapped cells and ignores titles and footers', () => {
    expect(p.rows[2].Calling).toBe('Relief Society Compassionate Service Coordinator');
    expect(text).not.toMatch(/Printed|Page \d|Maple Grove/);
  });

  it('keeps set-apart marks', () => {
    expect(p.rows.map((r) => r['Set Apart'])).toEqual(['✔', '', '✔', '✔', '✔', '✔']);
  });

  it('feeds straight into the importer', () => {
    const r = buildBaseline({ callings: p, callingMap: matchColumns(p.headers, CALLING_FIELDS), today: new Date(2026, 8, 13) });
    expect(r.report.skippedRows).toBe(0);
    const bySlot = Object.fromEntries(r.baseline.assignments.map((a) => [a.memberId, a.slotId]));
    expect(bySlot).toMatchObject({
      'doe, john': 'bishopric.assistant-clerk',
      'doe, jane': 'primary.teacher',
      'poe, sam': 'eq.president',
      'loe, kim': 'ss.president',
    });
    expect(bySlot['moe, tim'].startsWith('stake.')).toBe(true);
    expect(r.report.newCallings).toEqual([{ org: 'Relief Society', calling: 'Relief Society Compassionate Service Coordinator' }]);
  });

  it('returns undefined when there is no table', () => {
    expect(tableFromPdfItems([[t('Just a letter', 40, 700)]])).toBeUndefined();
  });
});

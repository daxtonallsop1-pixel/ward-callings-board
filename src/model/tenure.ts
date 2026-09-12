export type TenureBand = 'fresh' | 'settled' | 'seasoned' | 'long' | 'unknown';

/** Parses LCR-style dates: 2025-03-05, 5 Mar 2025, 3/5/2025, Mar 5, 2025. */
export function parseDate(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  if (!s) return undefined;

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);

  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) return iso(fullYear(+m[3]), +m[1], +m[2]);

  m = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3,})[\s-,]+(\d{4})$/);
  if (m) {
    const mon = monthIndex(m[2]);
    if (mon) return iso(+m[3], mon, +m[1]);
  }

  m = s.match(/^([A-Za-z]{3,})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const mon = monthIndex(m[1]);
    if (mon) return iso(+m[3], mon, +m[2]);
  }
  return undefined;
}

function fullYear(y: number) {
  return y < 100 ? 2000 + y : y;
}

function monthIndex(name: string): number | undefined {
  const i = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(
    name.slice(0, 3).toLowerCase(),
  );
  return i >= 0 ? i + 1 : undefined;
}

function iso(y: number, mo: number, d: number): string | undefined {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Whole calendar months from `since` (ISO) to `today`. */
export function monthsBetween(since: string, today: Date = new Date()): number {
  const [y, m, d] = since.split('-').map(Number);
  let months = (today.getFullYear() - y) * 12 + (today.getMonth() + 1 - m);
  if (today.getDate() < d) months -= 1;
  return Math.max(0, months);
}

export function tenureBand(months: number | undefined, cutoffs: [number, number, number]): TenureBand {
  if (months === undefined) return 'unknown';
  if (months < cutoffs[0]) return 'fresh';
  if (months < cutoffs[1]) return 'settled';
  if (months < cutoffs[2]) return 'seasoned';
  return 'long';
}

export function formatTenure(months: number | undefined): string {
  if (months === undefined) return '—';
  if (months < 1) return '<1 mo';
  if (months < 24) return `${months} mo`;
  const y = Math.floor(months / 12);
  const r = months % 12;
  return r ? `${y} yr ${r} mo` : `${y} yr`;
}

export function bandLegend(cutoffs: [number, number, number]): { band: TenureBand; label: string }[] {
  const [a, b, c] = cutoffs;
  return [
    { band: 'fresh', label: `Under ${a} mo` },
    { band: 'settled', label: `${a}–${b} mo` },
    { band: 'seasoned', label: `${b}–${c} mo` },
    { band: 'long', label: `${c}+ mo` },
  ];
}

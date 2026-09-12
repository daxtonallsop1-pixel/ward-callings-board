import { describe, expect, it } from 'vitest';
import { formatTenure, monthsBetween, parseDate, tenureBand } from './tenure';

const CUTS: [number, number, number] = [9, 18, 24];

describe('parseDate', () => {
  it.each([
    ['2025-03-05', '2025-03-05'],
    ['5 Mar 2025', '2025-03-05'],
    ['05-Mar-2025', '2025-03-05'],
    ['3/5/2025', '2025-03-05'],
    ['Mar 5, 2025', '2025-03-05'],
    ['March 5 2025', '2025-03-05'],
  ])('%s', (raw, want) => expect(parseDate(raw)).toBe(want));

  it('returns undefined for junk', () => {
    expect(parseDate('')).toBeUndefined();
    expect(parseDate('Yes')).toBeUndefined();
    expect(parseDate('13/40/2025')).toBeUndefined();
  });
});

describe('monthsBetween', () => {
  const today = new Date(2026, 8, 11); // 11 Sep 2026
  it('counts whole calendar months', () => {
    expect(monthsBetween('2025-12-11', today)).toBe(9);
    expect(monthsBetween('2025-12-12', today)).toBe(8);
    expect(monthsBetween('2026-09-11', today)).toBe(0);
    expect(monthsBetween('2027-01-01', today)).toBe(0);
  });
});

describe('tenureBand edges', () => {
  it.each([
    [0, 'fresh'],
    [8, 'fresh'],
    [9, 'settled'],
    [17, 'settled'],
    [18, 'seasoned'],
    [23, 'seasoned'],
    [24, 'long'],
    [60, 'long'],
  ] as const)('%i months -> %s', (m, band) => expect(tenureBand(m, CUTS)).toBe(band));

  it('no date -> unknown', () => expect(tenureBand(undefined, CUTS)).toBe('unknown'));
});

describe('formatTenure', () => {
  it('formats', () => {
    expect(formatTenure(0)).toBe('<1 mo');
    expect(formatTenure(14)).toBe('14 mo');
    expect(formatTenure(24)).toBe('2 yr');
    expect(formatTenure(27)).toBe('2 yr 3 mo');
  });
});

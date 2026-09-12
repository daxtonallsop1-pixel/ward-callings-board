import Papa from 'papaparse';
import type { Assignment, Baseline, Member, Organization, Slot } from '../model/types';
import { TEMPLATE_ORGS, TEMPLATE_SLOTS, slotId, slug } from '../model/template';
import { memberKey } from '../model/names';
import { monthsBetween, parseDate } from '../model/tenure';
import { matchColumns, type ColumnMap, type Field } from './columnMatch';

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * Parses CSV text, or a table copied from an LCR web page (tab-separated;
 * the delimiter is auto-detected). A copy often drags in page text above
 * the table, so the header is the first row that looks like one, and
 * one-cell lines (menus, footers) are dropped.
 */
export function parseCsv(text: string): ParsedCsv {
  const raw = Papa.parse<string[]>(text.replace(/^﻿/, ''), { skipEmptyLines: 'greedy' }).data;
  let headerIdx = raw.findIndex((r, i) => i < 80 && r.filter((c) => c.trim()).length >= 2 && Object.keys(matchColumns(r, ['name'])).length > 0);
  if (headerIdx < 0) headerIdx = 0;
  const headers = (raw[headerIdx] ?? []).map((h) => h.trim());
  const rows = raw
    .slice(headerIdx + 1)
    .filter((r) => headers.length < 2 || r.filter((c) => c.trim()).length >= 2)
    .map((r) => {
      const o: Record<string, string> = {};
      headers.forEach((h, i) => (o[h] = (r[i] ?? '').trim()));
      return o;
    });
  return { headers, rows };
}

export const CALLING_FIELDS: Field[] = ['name', 'organization', 'calling', 'sustained', 'setApart', 'gender', 'age'];
export const CALLING_REQUIRED: Field[] = ['name', 'calling'];
export const MEMBER_FIELDS: Field[] = ['name', 'gender', 'age', 'birthDate'];
export const MEMBER_REQUIRED: Field[] = ['name'];

export interface ImportInput {
  callings: ParsedCsv;
  callingMap: ColumnMap;
  members?: ParsedCsv;
  memberMap?: ColumnMap;
  today?: Date;
}

export interface ImportReport {
  callingRows: number;
  assignments: number;
  newCallings: { org: string; calling: string }[];
  newOrgs: string[];
  members: number;
  membersOnlyInCallings: string[];
  skippedRows: number;
  duplicateNames: string[];
}

// ---------------------------------------------------------------------------
// Matching helpers

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function canon(s: string): string {
  return norm(s)
    .replace(/\bfirst\b/g, '1st')
    .replace(/\bsecond\b/g, '2nd')
    .replace(/\badvisor\b/g, 'adviser')
    .replace(/\bleaders\b/g, 'leader')
    .replace(/\bteachers\b(?! quorum)/g, 'teacher')
    .replace(/^ward /, '')
    .trim();
}

function stripPrefix(calling: string, prefixes: string[]): string {
  const c = norm(calling);
  for (const p of prefixes.map(norm).sort((a, b) => b.length - a.length)) {
    if (p && c.startsWith(p + ' ')) return c.slice(p.length + 1);
  }
  return c;
}

function isStake(org: string, calling: string): boolean {
  return /\bstake\b|high council/i.test(org) || /^stake\b|high councilor/i.test(calling);
}

function youthSection(org: string, calling: string): { orgId: string; section: string } | undefined {
  const t = `${org} ${calling}`.toLowerCase();
  if (/deacons? quorum/.test(t)) return { orgId: 'ap', section: 'Deacons Quorum Presidency' };
  if (/teachers quorum/.test(t)) return { orgId: 'ap', section: 'Teachers Quorum Presidency' };
  if (/priests? quorum/.test(t) && !/adviser|advisor|specialist/.test(t)) return { orgId: 'ap', section: 'Priests Quorum' };
  if (/young women/.test(t) && /class (president|1st counselor|first counselor|2nd counselor|second counselor|secretary)|class presidency/.test(t))
    return { orgId: 'yw', section: 'Class Presidency' };
  return undefined;
}

function findOrg(orgs: Organization[], orgName: string, calling: string): Organization | undefined {
  const n = canon(orgName);
  if (n) {
    const hit = orgs.find((o) => canon(o.name) === n || o.aliases?.some((a) => canon(a) === n));
    if (hit) return hit;
  }
  // No / unknown org column: guess from the calling's prefix ("Primary Teacher").
  const c = canon(calling);
  return [...orgs]
    .filter((o) => o.group === 'ward')
    .sort((a, b) => b.name.length - a.name.length)
    .find((o) => [o.name, ...(o.aliases ?? [])].some((a) => c.startsWith(canon(a) + ' ')));
}

function titleCase(s: string): string {
  return s.replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\bAnd\b/g, 'and').replace(/\bOf\b/g, 'of');
}

// ---------------------------------------------------------------------------

export function buildBaseline(input: ImportInput): { baseline: Baseline; report: ImportReport } {
  const today = input.today ?? new Date();
  const orgs: Organization[] = TEMPLATE_ORGS.map((o) => ({ ...o }));
  const slots: Slot[] = TEMPLATE_SLOTS.map((s) => ({ ...s }));
  const report: ImportReport = {
    callingRows: input.callings.rows.length,
    assignments: 0,
    newCallings: [],
    newOrgs: [],
    members: 0,
    membersOnlyInCallings: [],
    skippedRows: 0,
    duplicateNames: [],
  };

  // --- Members from the member list --------------------------------------
  const members = new Map<string, Member>();
  if (input.members && input.memberMap?.name) {
    const m = input.memberMap;
    const seen = new Map<string, number>();
    for (const row of input.members.rows) {
      const name = row[m.name!]?.trim();
      if (!name) continue;
      const base = memberKey(name);
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      if (n === 2) report.duplicateNames.push(name);
      const id = n > 1 ? `${base} #${n}` : base;
      members.set(id, { id, name, gender: gender(m.gender && row[m.gender]), age: age(row, m, today) });
    }
  }

  // --- Callings ----------------------------------------------------------
  const cm = input.callingMap;
  const assignments: Assignment[] = [];
  const stakeOrg = orgs.find((o) => o.id === 'stake')!;
  let customOrder = 900;

  for (const row of input.callings.rows) {
    const name = cm.name ? row[cm.name]?.trim() : '';
    const calling = cm.calling ? row[cm.calling]?.trim() : '';
    if (!name || !calling) {
      report.skippedRows++;
      continue;
    }
    const orgName = cm.organization ? row[cm.organization]?.trim() ?? '' : '';

    // Reports don't always agree on middle names: fall back to "last, first".
    let id = memberKey(name);
    if (!members.has(id)) {
      const short = shortKey(id);
      const hits = [...members.keys()].filter((k) => shortKey(k) === short);
      if (hits.length === 1) id = hits[0];
    }
    if (!members.has(id)) {
      members.set(id, { id, name, gender: gender(cm.gender && row[cm.gender]), age: cm.age ? num(row[cm.age]) : undefined });
      if (input.members) report.membersOnlyInCallings.push(name);
    }

    // Resolve org + slot
    let org: Organization | undefined;
    let section: string | undefined;
    let candidates: Slot[];

    const youth = youthSection(orgName, calling);
    if (isStake(orgName, calling)) {
      org = stakeOrg;
      section = orgName || undefined;
      candidates = slots.filter((s) => s.orgId === 'stake' && s.section === section);
    } else if (youth) {
      org = orgs.find((o) => o.id === youth.orgId)!;
      section = youth.section;
      candidates = slots.filter((s) => s.orgId === org!.id && s.section === section);
    } else {
      org = findOrg(orgs, orgName, calling);
      if (!org) {
        const label = orgName || 'Other';
        org = { id: `x-${slug(label)}`, name: label, group: 'ward', order: customOrder++, accent: '#5C6573', custom: true };
        orgs.push(org);
        report.newOrgs.push(label);
      }
      candidates = slots.filter((s) => s.orgId === org!.id && !s.section);
    }

    const prefixes = [org.name, ...(org.aliases ?? []), orgName, 'young women class', 'deacons quorum', 'teachers quorum', 'priests quorum', 'aaronic priesthood', 'bishopric', 'ward'];
    const short = canon(stripPrefix(calling, prefixes));
    const full = canon(calling);
    const slot =
      candidates.find((s) => canon(s.title) === short || canon(s.title) === full) ??
      candidates.find((s) => s.aliases?.some((a) => canon(a) === full || canon(a) === short));

    let target = slot;
    if (!target) {
      const title = org.group === 'stake' ? calling : titleCase(stripPrefix(calling, prefixes)) || calling;
      const sid = slotId(org.id, title, section);
      target = slots.find((s) => s.id === sid);
      if (!target) {
        const maxOrder = Math.max(0, ...slots.filter((s) => s.orgId === org!.id).map((s) => s.order));
        target = { id: sid, orgId: org.id, title, order: maxOrder + 10, section, custom: org.group !== 'stake', aliases: [calling] };
        slots.push(target);
        if (org.group !== 'stake') report.newCallings.push({ org: org.name, calling });
      }
    }

    const setApartRaw = cm.setApart ? row[cm.setApart] ?? '' : '';
    assignments.push({
      slotId: target.id,
      memberId: id,
      sustained: cm.sustained ? parseDate(row[cm.sustained]) : undefined,
      setApart: /^(y|yes|true|x|✓|✔)$/i.test(setApartRaw) || !!parseDate(setApartRaw),
    });
  }

  // Single-person slots that LCR shows with several holders become multi.
  const counts = new Map<string, number>();
  for (const a of assignments) counts.set(a.slotId, (counts.get(a.slotId) ?? 0) + 1);
  for (const s of slots) if ((counts.get(s.id) ?? 0) > 1) s.multi = true;

  report.assignments = assignments.length;
  report.members = members.size;

  return {
    baseline: { importedAt: today.toISOString(), orgs, slots, members: [...members.values()], assignments },
    report,
  };
}

function shortKey(key: string): string {
  const [last, rest = ''] = key.replace(/ #\d+$/, '').split(', ');
  return `${last}, ${rest.split(' ')[0]}`;
}

function gender(raw: string | undefined | false): 'M' | 'F' | undefined {
  if (!raw) return undefined;
  const c = raw.trim().charAt(0).toUpperCase();
  return c === 'M' ? 'M' : c === 'F' ? 'F' : undefined;
}

function num(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}

function age(row: Record<string, string>, m: ColumnMap, today: Date): number | undefined {
  const direct = m.age ? num(row[m.age]) : undefined;
  if (direct !== undefined) return direct;
  const bd = m.birthDate ? parseDate(row[m.birthDate]) : undefined;
  return bd ? Math.floor(monthsBetween(bd, today) / 12) : undefined;
}

export { matchColumns };

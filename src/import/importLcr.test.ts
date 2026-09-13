import { describe, expect, it } from 'vitest';
import { buildBaseline, namesIn, parseCsv, stakeUnitOptions, CALLING_FIELDS, MEMBER_FIELDS, STAKE_FIELDS } from './importLcr';
import { matchColumns, missingFields } from './columnMatch';
import { demoCsvs } from './demo';
import { buildView } from '../model/board';
import { defaultState, migrate } from '../store/persist';

const today = new Date(2026, 8, 11);

describe('matchColumns', () => {
  it('handles header variants', () => {
    const m = matchColumns(['Preferred Name', 'Sub Organization', 'Position', 'Date Sustained', 'Set Apart'], CALLING_FIELDS);
    expect(m).toMatchObject({ name: 'Preferred Name', organization: 'Sub Organization', calling: 'Position', sustained: 'Date Sustained', setApart: 'Set Apart' });
  });
  it('reports what is missing', () => {
    const m = matchColumns(['Foo', 'Calling'], CALLING_FIELDS);
    expect(missingFields(m, ['name', 'calling'])).toEqual(['name']);
  });
});

describe('parseCsv (pasted from an LCR page)', () => {
  it('reads a tab-separated copy with page text around the table', () => {
    const pasted = [
      'Leader and Clerk Resources',
      'Menu',
      'Members with Callings',
      'Name\tGender\tAge\tOrganization\tCalling\tSustained\tSet Apart',
      'Doe, Jane\tF\t40\tPrimary\tPrimary Teacher\t5 Mar 2025\t✔',
      'Roe, Sam\tM\t52\tElders Quorum\tElders Quorum President\t1 Jan 2026\t',
      'Privacy Notice',
      '© 2026 by Intellectual Reserve, Inc.',
    ].join('\n');
    const p = parseCsv(pasted);
    expect(p.headers[0]).toBe('Name');
    expect(p.rows.map((r) => r.Name)).toEqual(['Doe, Jane', 'Roe, Sam']);
    const r = buildBaseline({ callings: p, callingMap: matchColumns(p.headers, CALLING_FIELDS), today });
    expect(r.baseline.assignments.map((a) => a.slotId)).toEqual(['primary.teacher', 'eq.president']);
    expect(r.baseline.assignments[0]).toMatchObject({ sustained: '2025-03-05', setApart: true });
    expect(r.report.skippedRows).toBe(0);
  });

  it('matches the real LCR "Members with Callings" layout', () => {
    const p = parseCsv(
      [
        'Name\tGender\tAge\tBirth Date\tOrganization\tCalling\tSustained\tSet Apart',
        'Doe, John\tM\t32\t5 Aug 1994\tBishopric\tWard Assistant Clerk\t30 Aug 2026\t✔️',
        'Doe, Jane\tF\t31\t17 Feb 1995\tPrimary\tPrimary Teacher\t2 Nov 2025\t',
        'Roe, Ann\tF\t28\t14 May 1998\tYoung Women\tYoung Women Secretary\t12 Oct 2025\t✔',
      ].join('\n'),
    );
    const m = matchColumns(p.headers, CALLING_FIELDS);
    expect(m).toMatchObject({ name: 'Name', gender: 'Gender', age: 'Age', organization: 'Organization', calling: 'Calling', sustained: 'Sustained', setApart: 'Set Apart' });
    const r = buildBaseline({ callings: p, callingMap: m, today });
    expect(r.baseline.assignments.map((a) => [a.slotId, a.sustained, a.setApart])).toEqual([
      ['bishopric.assistant-clerk', '2026-08-30', true],
      ['primary.teacher', '2025-11-02', false],
      ['yw.secretary', '2025-10-12', true],
    ]);
    expect(r.report.newCallings).toEqual([]);
    // Callings report only: the board must not claim "everyone has a calling".
    expect(r.baseline.hasMemberList).toBe(false);
  });
});

describe('parseCsv', () => {
  it('skips title lines above the header', () => {
    const p = parseCsv('Members with Callings\nPrinted 9/11/2026\nName,Calling,Organization\n"Doe, Jane",Primary Teacher,Primary\n');
    expect(p.headers).toEqual(['Name', 'Calling', 'Organization']);
    expect(p.rows).toEqual([{ Name: 'Doe, Jane', Calling: 'Primary Teacher', Organization: 'Primary' }]);
  });
});

function importDemo() {
  const { callings, members, stake } = demoCsvs(today);
  const c = parseCsv(callings);
  const m = parseCsv(members);
  const s = parseCsv(stake);
  return buildBaseline({
    callings: c,
    callingMap: matchColumns(c.headers, CALLING_FIELDS),
    members: m,
    memberMap: matchColumns(m.headers, MEMBER_FIELDS),
    stake: s,
    stakeMap: matchColumns(s.headers, STAKE_FIELDS),
    today,
  });
}

describe('buildBaseline (demo export)', () => {
  const { baseline, report } = importDemo();
  const slotOf = (calling: string) => {
    const a = baseline.assignments.find((x) => baseline.slots.find((s) => s.id === x.slotId)?.aliases?.includes(calling) || false);
    return a && baseline.slots.find((s) => s.id === a.slotId);
  };

  it('maps standard LCR calling names onto template slots', () => {
    const ids = new Set(baseline.assignments.map((a) => a.slotId));
    for (const id of [
      'bishopric.bishop',
      'bishopric.first-counselor',
      'bishopric.executive-secretary',
      'bishopric.assistant-clerk',
      'eq.president',
      'eq.instructor',
      'rs.secretary',
      'yw.class-adviser',
      'yw.class-presidency.president',
      'ap.quorum-adviser',
      'ap.deacons-quorum-presidency.president',
      'ap.teachers-quorum-presidency.president',
      'ap.priests-quorum.first-assistant',
      'primary.teacher',
      'primary.nursery-leader',
      'primary.music-leader',
      'ss.adult-teacher',
      'ss.youth-teacher',
      'mission.ward-mission-leader',
      'mission.ward-missionary',
      'tfh.temple-and-family-history-leader',
      'music.organist-pianist',
      'other.activities-coordinator',
    ]) {
      expect(ids, id).toContain(id);
    }
  });

  it('adds unknown callings to the right org, flagged custom', () => {
    expect(report.newCallings).toEqual([{ org: 'Relief Society', calling: 'Relief Society Compassionate Service Coordinator' }]);
    const s = baseline.slots.find((x) => x.title === 'Compassionate Service Coordinator');
    expect(s).toMatchObject({ orgId: 'rs', custom: true });
    expect(slotOf('Relief Society Compassionate Service Coordinator')?.orgId).toBe('rs');
  });

  it('routes stake callings to the stake card, grouped by LCR org', () => {
    const stake = baseline.slots.filter((s) => s.orgId === 'stake');
    expect(stake.map((s) => s.section).sort()).toEqual(['Stake High Council', 'Stake Primary']);
    expect(report.newCallings.some((c) => /stake|high/i.test(c.calling))).toBe(false);
  });

  it('parses dates, set apart and members', () => {
    expect(report.skippedRows).toBe(0);
    expect(baseline.assignments.every((a) => /^\d{4}-\d{2}-\d{2}$/.test(a.sustained ?? ''))).toBe(true);
    expect(report.inBothReports).toEqual([]);
    expect(report.stakeCallings).toBe(2);
    expect(baseline.members.length).toBe(158);
    expect(baseline.hasMemberList).toBe(true);
  });

  it('computes who has no calling', () => {
    const state = { ...defaultState(), baseline };
    const v = buildView(state, today);
    const holding = new Set(baseline.assignments.map((a) => a.memberId));
    expect(v.available.length).toBeGreaterThan(0);
    expect(v.available.every((m) => !holding.has(m.id) && (m.age ?? 99) >= 18)).toBe(true);
    expect(v.youthAvailable.every((m) => m.age! >= 11 && m.age! < 18)).toBe(true);
    // Children under 11 never show
    const kids = baseline.members.filter((m) => (m.age ?? 99) < 11).map((m) => m.id);
    expect([...v.available, ...v.youthAvailable].some((m) => kids.includes(m.id))).toBe(false);
  });

  it('matches "Last, First Middle" in callings to "Last, First" in the member list', () => {
    const c = parseCsv('Name,Organization,Calling\n"Doe, Jane Marie",Primary,Primary Teacher');
    const m = parseCsv('Name,Age\n"Doe, Jane",40\n"Roe, Sam",30');
    const r = buildBaseline({ callings: c, callingMap: matchColumns(c.headers, CALLING_FIELDS), members: m, memberMap: matchColumns(m.headers, MEMBER_FIELDS), today });
    expect(r.baseline.members.map((x) => x.id).sort()).toEqual(['doe, jane', 'roe, sam']);
    expect(r.baseline.assignments[0].memberId).toBe('doe, jane');
  });
});

describe('Stake Callings report', () => {
  const callings = parseCsv('Name,Organization,Calling\n"Doe, Jane",Primary,Primary Teacher');
  const members = parseCsv('Name,Age\n"Roe, Sam",40');
  const cMap = matchColumns(callings.headers, CALLING_FIELDS);
  const mMap = matchColumns(members.headers, MEMBER_FIELDS);

  it('puts every row on the stake card, even without "Stake" in the org name', () => {
    const stake = parseCsv('Name,Organization,Calling,Sustained\n"Poe, Ann",Presidency,Executive Secretary,1 Jan 2026\n"Roe, Sam",High Council,High Councilor,2 Feb 2025');
    const r = buildBaseline({ callings, callingMap: cMap, members, memberMap: mMap, stake, stakeMap: matchColumns(stake.headers, STAKE_FIELDS), today });
    const inStake = r.baseline.assignments.filter((a) => a.slotId.startsWith('stake.'));
    expect(inStake.map((a) => a.memberId).sort()).toEqual(['poe, ann', 'roe, sam']);
    expect(r.report.stakeCallings).toBe(2);
    expect(r.report.newCallings).toEqual([]);
    expect(r.report.inBothReports).toEqual([]);
    // Sam has no ward calling but serves in the stake: not "available".
    const v = buildView({ ...defaultState(), baseline: r.baseline }, today);
    expect(v.available).toEqual([]);
  });

  it('narrows a stake-wide report to this ward by unit', () => {
    const stake = parseCsv(
      'Name,Unit,Organization,Calling\n"Roe, Sam",Old Highway Ward,High Council,High Councilor\n"Zed, Al",Other Ward,High Council,High Councilor\n"Yon, Bo",Other Ward,Stake Primary,Stake Primary President',
    );
    const sMap = matchColumns(stake.headers, STAKE_FIELDS);
    expect(sMap.unit).toBe('Unit');
    const known = new Set([...namesIn(callings, cMap), ...namesIn(members, mMap)]);
    const opts = stakeUnitOptions(stake, sMap, known);
    expect(opts[0]).toEqual({ unit: 'Old Highway Ward', rows: 1, known: 1 });
    const r = buildBaseline({ callings, callingMap: cMap, members, memberMap: mMap, stake, stakeMap: sMap, stakeUnit: opts[0].unit, today });
    expect(r.baseline.members.map((m) => m.id).sort()).toEqual(['doe, jane', 'roe, sam']);
    expect(r.report.stakeCallings).toBe(1);
  });

  it('flags people listed both with and without callings', () => {
    const both = parseCsv('Name,Age\n"Doe, Jane",40\n"Roe, Sam",40');
    const r = buildBaseline({ callings, callingMap: cMap, members: both, memberMap: matchColumns(both.headers, MEMBER_FIELDS), today });
    expect(r.report.inBothReports).toEqual(['Doe, Jane']);
  });
});

describe('scenario-only callings (placeholders)', () => {
  it('show up in the scenario view but not Current', () => {
    const { baseline } = importDemo();
    const slot = { id: 'new-eq-1', orgId: 'eq', title: 'Ministering Coordinator', order: 5000, custom: true };
    const member = baseline.members.find((m) => !baseline.assignments.some((a) => a.memberId === m.id) && (m.age ?? 0) >= 18)!;
    const scn = { id: 's1', name: 'EQ reorg', createdAt: '', basedOn: baseline.importedAt, addedSlots: [slot], assignments: [...baseline.assignments, { slotId: slot.id, memberId: member.id }] };
    const state = { ...defaultState(), baseline, scenarios: [scn], activeScenarioId: 's1' };

    const v = buildView(state, today);
    const eq = v.orgs.find((o) => o.org.id === 'eq')!;
    const sv = eq.sections[0].slots.find((s) => s.slot.id === slot.id)!;
    expect(sv.scenarioOnly).toBe(true);
    expect(sv.holders[0].isNew).toBe(true);
    expect(v.available.some((m) => m.id === member.id)).toBe(false);
    expect(v.diff?.changes).toEqual([{ kind: 'call', memberId: member.id, from: [], to: [slot.id] }]);

    const current = buildView({ ...state, activeScenarioId: null }, today);
    expect(current.slotById.has(slot.id)).toBe(false);
  });
});

describe('migrate (saved state / backups)', () => {
  it('fills defaults for old or partial saves', () => {
    const s = migrate({ wardName: 'Old Ward', scenarios: [{ id: 'a', name: 'x', createdAt: '', basedOn: '' }], settings: { tenureCutoffs: [1, 2] } });
    expect(s.wardName).toBe('Old Ward');
    expect(s.settings.tenureCutoffs).toEqual([9, 18, 24]);
    expect(s.settings.placeholdersPerOrg).toBe(2);
    expect(s.structure).toEqual({ addedSlots: [], removedSlotIds: [], titleOverrides: {} });
    expect(s.scenarios[0]).toMatchObject({ addedSlots: [], assignments: [] });
  });
  it('survives garbage', () => {
    expect(migrate(null)).toEqual(defaultState());
    expect(migrate('nope')).toEqual(defaultState());
  });
});

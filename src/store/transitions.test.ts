import { describe, expect, it } from 'vitest';
import { rebaseAssignments, assign } from '../model/scenario';
import { applyImport } from './transitions';
import { defaultState } from './persist';
import type { AppState, Assignment, Baseline, Member } from '../model/types';
import { TEMPLATE_ORGS, TEMPLATE_SLOTS } from '../model/template';

const multi = new Set(TEMPLATE_SLOTS.filter((s) => s.multi).map((s) => s.id));
const opts = (people: string[]) => ({
  exists: (a: Assignment) => people.includes(a.memberId),
  isMulti: (id: string) => multi.has(id),
});

const oldBase: Assignment[] = [
  { slotId: 'eq.president', memberId: 'adams', sustained: '2024-01-01' },
  { slotId: 'eq.secretary', memberId: 'baker', sustained: '2024-01-01' },
  { slotId: 'primary.teacher', memberId: 'cole', sustained: '2025-01-01' },
];

// The plan: Baker becomes EQ president (Adams released), Dunn becomes secretary.
let plan = assign(oldBase, 'baker', 'eq.president', { fromSlotId: 'eq.secretary' });
plan = assign(plan, 'dunn', 'eq.secretary');

describe('rebaseAssignments', () => {
  it('keeps unrelated LCR changes and re-applies the plan', () => {
    // Meanwhile in LCR: Cole released from Primary, Ellis called as teacher.
    const newBase = [oldBase[0], oldBase[1], { slotId: 'primary.teacher', memberId: 'ellis', sustained: '2026-09-01' }];
    const r = rebaseAssignments(oldBase, plan, newBase, opts(['adams', 'baker', 'dunn', 'ellis']));
    expect(r.map((a) => `${a.slotId}:${a.memberId}`).sort()).toEqual(['eq.president:baker', 'eq.secretary:dunn', 'primary.teacher:ellis']);
  });

  it('uses LCR’s version once a planned change has actually happened', () => {
    const newBase = [
      { slotId: 'eq.president', memberId: 'baker', sustained: '2026-09-07' },
      { slotId: 'primary.teacher', memberId: 'cole', sustained: '2025-01-01' },
    ];
    const r = rebaseAssignments(oldBase, plan, newBase, opts(['adams', 'baker', 'cole', 'dunn']));
    expect(r.find((a) => a.slotId === 'eq.president')).toEqual({ slotId: 'eq.president', memberId: 'baker', sustained: '2026-09-07' });
    expect(r.find((a) => a.slotId === 'eq.secretary')?.memberId).toBe('dunn');
  });

  it('plan wins a single-person calling LCR filled differently', () => {
    const newBase = [{ slotId: 'eq.secretary', memberId: 'fox', sustained: '2026-08-01' }];
    const r = rebaseAssignments(oldBase, plan, newBase, opts(['baker', 'dunn', 'fox']));
    expect(r.filter((a) => a.slotId === 'eq.secretary').map((a) => a.memberId)).toEqual(['dunn']);
  });

  it('drops moves for people who are gone', () => {
    const r = rebaseAssignments(oldBase, plan, oldBase, opts(['adams', 'baker', 'cole'])); // dunn moved away
    expect(r.some((a) => a.memberId === 'dunn')).toBe(false);
    expect(r.find((a) => a.slotId === 'eq.president')?.memberId).toBe('baker');
  });
});

const members = (ids: string[]): Member[] => ids.map((id) => ({ id, name: id }));
const baseline = (ids: string[], assignments: Assignment[], extra: Partial<Baseline> = {}): Baseline => ({
  importedAt: new Date().toISOString(),
  orgs: TEMPLATE_ORGS,
  slots: TEMPLATE_SLOTS,
  members: members(ids),
  assignments,
  ...extra,
});

describe('applyImport', () => {
  const people = ['adams', 'baker', 'cole', 'dunn'];
  const withScenario = (b: Baseline): AppState => ({
    ...defaultState(),
    wardName: 'Old Highway Ward',
    baseline: b,
    scenarios: [{ id: 's1', name: 'EQ reorg', createdAt: '', basedOn: b.importedAt, addedSlots: [], assignments: plan }],
    activeScenarioId: 's1',
  });

  it('switches to Current and carries scenarios forward', () => {
    const next = applyImport(withScenario(baseline(people, oldBase)), baseline(people, oldBase, { importedAt: '2026-10-01T00:00:00Z' }));
    expect(next.activeScenarioId).toBeNull();
    expect(next.scenarios[0].basedOn).toBe('2026-10-01T00:00:00Z');
    expect(next.scenarios[0].assignments.find((a) => a.slotId === 'eq.president')?.memberId).toBe('baker');
    expect(next.wardName).toBe('Old Highway Ward');
  });

  it('real data replacing the demo clears demo scenarios and name', () => {
    const demo = { ...withScenario(baseline(people, oldBase, { demo: true })), wardName: 'Maple Grove Ward (demo)', memberFlags: { adams: { hidden: true } } };
    const next = applyImport(demo, baseline(['real, person'], []));
    expect(next.scenarios).toEqual([]);
    expect(next.activeScenarioId).toBeNull();
    expect(next.wardName).toBe(defaultState().wardName);
    expect(next.memberFlags).toEqual({});
  });
});

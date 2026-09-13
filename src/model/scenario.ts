import type { Assignment, Slot } from './types';

/*
 * Pure planning operations. A scenario holds a full copy of assignments, so
 * everything here is (assignments in) -> (assignments out), and the diff
 * against the baseline is a plain comparison.
 */

const key = (a: Pick<Assignment, 'slotId' | 'memberId'>) => `${a.slotId}|${a.memberId}`;

export interface AssignOptions {
  /** The slot the person was dragged out of (released unless `keep`). */
  fromSlotId?: string;
  /** Alt-drop: add the calling without releasing the one they came from. */
  keep?: boolean;
  /** Target holds several people; don't release its current holders. */
  targetMulti?: boolean;
  /** Used to restore the original sustained date if someone is moved back. */
  baseline?: Assignment[];
}

export function assign(list: Assignment[], memberId: string, toSlotId: string, opts: AssignOptions = {}): Assignment[] {
  let next = list;
  if (opts.fromSlotId && opts.fromSlotId !== toSlotId && !opts.keep) {
    next = next.filter((a) => !(a.slotId === opts.fromSlotId && a.memberId === memberId));
  }
  if (next.some((a) => a.slotId === toSlotId && a.memberId === memberId)) return next;
  if (!opts.targetMulti) {
    next = next.filter((a) => a.slotId !== toSlotId);
  }
  const original = opts.baseline?.find((a) => a.slotId === toSlotId && a.memberId === memberId);
  return [...next, original ? { ...original } : { slotId: toSlotId, memberId }];
}

export function release(list: Assignment[], memberId: string, slotId: string): Assignment[] {
  return list.filter((a) => !(a.slotId === slotId && a.memberId === memberId));
}

export function releaseAll(list: Assignment[], slotId: string): Assignment[] {
  return list.filter((a) => a.slotId !== slotId);
}

export interface Change {
  kind: 'call' | 'release' | 'move';
  memberId: string;
  from: string[];
  to: string[];
}

export interface ScenarioDiff {
  changes: Change[];
  /** slot|member keys that are new relative to the baseline. */
  added: Set<string>;
  /** slotId -> memberIds who held it in the baseline but don't in the scenario. */
  replaced: Map<string, string[]>;
  /** Slots that had someone in the baseline and are empty in the scenario. */
  vacated: string[];
  /** Scenario-only slots (callings that don't exist in LCR yet). */
  createdSlots: Slot[];
  releasedMembers: Set<string>;
}

export function diffScenario(baseline: Assignment[], scenario: Assignment[], createdSlots: Slot[] = []): ScenarioDiff {
  const baseKeys = new Set(baseline.map(key));
  const scnKeys = new Set(scenario.map(key));

  const removed = baseline.filter((a) => !scnKeys.has(key(a)));
  const added = scenario.filter((a) => !baseKeys.has(key(a)));

  const byMember = new Map<string, { from: string[]; to: string[] }>();
  for (const a of removed) entry(byMember, a.memberId).from.push(a.slotId);
  for (const a of added) entry(byMember, a.memberId).to.push(a.slotId);

  const changes: Change[] = [];
  const releasedMembers = new Set<string>();
  for (const [memberId, { from, to }] of byMember) {
    const kind = from.length && to.length ? 'move' : to.length ? 'call' : 'release';
    changes.push({ kind, memberId, from, to });
    // "Released" = lost a calling and holds nothing now.
    if (from.length && !scenario.some((a) => a.memberId === memberId)) releasedMembers.add(memberId);
  }

  const replaced = new Map<string, string[]>();
  for (const a of removed) {
    const list = replaced.get(a.slotId) ?? [];
    list.push(a.memberId);
    replaced.set(a.slotId, list);
  }

  const filled = new Set(scenario.map((a) => a.slotId));
  const vacated = [...new Set(removed.map((a) => a.slotId))].filter((s) => !filled.has(s));

  const order = { move: 0, call: 1, release: 2 };
  changes.sort((a, b) => order[a.kind] - order[b.kind]);

  return { changes, added: new Set(added.map(key)), replaced, vacated, createdSlots, releasedMembers };
}

function entry(map: Map<string, { from: string[]; to: string[] }>, id: string) {
  let e = map.get(id);
  if (!e) map.set(id, (e = { from: [], to: [] }));
  return e;
}

export const assignmentKey = key;

/**
 * Carries a scenario's planned moves onto freshly imported LCR data.
 *
 * Start from what LCR says now, then re-apply the scenario's own changes
 * (relative to the data it was built on): drop the callings it released and
 * add the ones it extended. A planned calling that LCR now already shows is
 * left as LCR has it (with the real sustained date). Anything involving a
 * person or calling that no longer exists is dropped.
 */
export function rebaseAssignments(
  oldBase: Assignment[],
  scenario: Assignment[],
  newBase: Assignment[],
  opts: { exists: (a: Assignment) => boolean; isMulti: (slotId: string) => boolean },
): Assignment[] {
  const oldKeys = new Set(oldBase.map(key));
  const scnKeys = new Set(scenario.map(key));
  const newKeys = new Set(newBase.map(key));
  const released = new Set(oldBase.filter((a) => !scnKeys.has(key(a))).map(key));
  const added = scenario.filter((a) => !oldKeys.has(key(a)) && opts.exists(a));

  let result = newBase.filter((a) => !released.has(key(a)));
  for (const a of added) {
    if (newKeys.has(key(a))) continue; // LCR already made this change
    // The plan says this person holds a single-person calling: plan wins.
    if (!opts.isMulti(a.slotId)) result = result.filter((r) => r.slotId !== a.slotId);
    result.push(a);
  }
  return result;
}

/** A calling the bishop is considering that doesn't exist in LCR. */
export function scenarioSlot(orgId: string, title: string, order: number, section?: string): Slot {
  return { id: newId(`new-${orgId}`), orgId, title, order, section, custom: true };
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

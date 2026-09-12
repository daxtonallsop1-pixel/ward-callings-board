import type { AppState, Assignment, Member, Organization, Scenario, Slot } from './types';
import { TEMPLATE_ORGS, TEMPLATE_SLOTS } from './template';
import { diffScenario, assignmentKey, type ScenarioDiff } from './scenario';
import { monthsBetween } from './tenure';
import { sortName } from './names';

export interface Holder {
  member: Member;
  assignment: Assignment;
  months?: number;
  /** Placed in this scenario (not in LCR). */
  isNew: boolean;
}

export interface SlotView {
  slot: Slot;
  holders: Holder[];
  /** People who held this in Current but not in the scenario. */
  replaced: Member[];
  /** Created in this scenario only. */
  scenarioOnly: boolean;
}

export interface SectionView {
  name?: string;
  slots: SlotView[];
  filled: number;
}

export interface OrgView {
  org: Organization;
  sections: SectionView[];
  filled: number;
  total: number;
}

export interface BoardView {
  orgs: OrgView[];
  memberById: Map<string, Member>;
  slotById: Map<string, Slot>;
  orgById: Map<string, Organization>;
  assignments: Assignment[];
  /** Adults (18+ or unknown age) with no calling. */
  available: Member[];
  /** 11–17 with no calling. */
  youthAvailable: Member[];
  hidden: Member[];
  missionaries: Member[];
  diff: ScenarioDiff | null;
}

export function activeScenario(state: AppState): Scenario | null {
  return state.scenarios.find((s) => s.id === state.activeScenarioId) ?? null;
}

export function allMembers(state: AppState): Member[] {
  return [...(state.baseline?.members ?? []), ...state.manualMembers];
}

export function effectiveSlots(state: AppState, scenario: Scenario | null, assignments: Assignment[]): Slot[] {
  const { addedSlots, removedSlotIds, titleOverrides } = state.structure;
  const filled = new Set(assignments.map((a) => a.slotId));
  const removed = new Set(removedSlotIds);
  const base = [...(state.baseline?.slots ?? TEMPLATE_SLOTS), ...addedSlots]
    // A removed slot still shows while LCR says someone holds it.
    .filter((s) => !removed.has(s.id) || filled.has(s.id))
    .map((s) => (titleOverrides[s.id] ? { ...s, title: titleOverrides[s.id] } : s));
  return scenario ? [...base, ...scenario.addedSlots] : base;
}

export function buildView(state: AppState, today: Date = new Date()): BoardView {
  const scenario = activeScenario(state);
  const baseAssignments = state.baseline?.assignments ?? [];
  const assignments = scenario ? scenario.assignments : baseAssignments;

  const members = allMembers(state);
  const memberById = new Map(members.map((m) => [m.id, m]));
  const slots = effectiveSlots(state, scenario, assignments);
  const slotById = new Map(slots.map((s) => [s.id, s]));
  const orgs = [...(state.baseline?.orgs ?? TEMPLATE_ORGS)].sort((a, b) => a.order - b.order);
  const orgById = new Map(orgs.map((o) => [o.id, o]));

  // Ignore anything that points at a person or slot that no longer exists.
  const live = assignments.filter((a) => memberById.has(a.memberId) && slotById.has(a.slotId));

  const diff = scenario ? diffScenario(baseAssignments, live, scenario.addedSlots) : null;
  const scenarioSlotIds = new Set(scenario?.addedSlots.map((s) => s.id) ?? []);

  const bySlot = new Map<string, Holder[]>();
  for (const a of live) {
    const list = bySlot.get(a.slotId) ?? [];
    list.push({
      member: memberById.get(a.memberId)!,
      assignment: a,
      months: a.sustained ? monthsBetween(a.sustained, today) : undefined,
      isNew: !!diff?.added.has(assignmentKey(a)),
    });
    bySlot.set(a.slotId, list);
  }

  const orgViews: OrgView[] = orgs.map((org) => {
    const orgSlots = slots.filter((s) => s.orgId === org.id).sort((a, b) => a.order - b.order);
    // Un-sectioned slots first, then sections in template order. (Array.sort
    // always moves `undefined` to the end, so build the order by hand.)
    const named: string[] = [];
    for (const s of orgSlots) if (s.section && !named.includes(s.section)) named.push(s.section);
    const sectionNames: (string | undefined)[] = [undefined, ...named];

    const sections = sectionNames.map((name) => {
      const sv = orgSlots
        .filter((s) => s.section === name)
        .map<SlotView>((slot) => ({
          slot,
          holders: (bySlot.get(slot.id) ?? []).sort((a, b) => sortName(a.member.name).localeCompare(sortName(b.member.name))),
          replaced: (diff?.replaced.get(slot.id) ?? []).map((id) => memberById.get(id)).filter((m): m is Member => !!m),
          scenarioOnly: scenarioSlotIds.has(slot.id),
        }));
      return { name, slots: sv, filled: sv.filter((s) => s.holders.length).length };
    });
    const all = sections.flatMap((s) => s.slots);
    return { org, sections, filled: all.filter((s) => s.holders.length).length, total: all.length };
  });

  const holding = new Set(live.map((a) => a.memberId));
  const flags = state.memberFlags;
  const unassigned = members
    .filter((m) => !holding.has(m.id) && !flags[m.id]?.onMission)
    .sort((a, b) => sortName(a.name).localeCompare(sortName(b.name)));

  return {
    orgs: orgViews,
    memberById,
    slotById,
    orgById,
    assignments: live,
    available: unassigned.filter((m) => !flags[m.id]?.hidden && (m.age === undefined || m.age >= 18)),
    youthAvailable: unassigned.filter((m) => !flags[m.id]?.hidden && m.age !== undefined && m.age >= 11 && m.age < 18),
    hidden: unassigned.filter((m) => flags[m.id]?.hidden),
    missionaries: members.filter((m) => flags[m.id]?.onMission).sort((a, b) => sortName(a.name).localeCompare(sortName(b.name))),
    diff,
  };
}

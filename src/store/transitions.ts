import type { AppState, Baseline } from '../model/types';
import { rebaseAssignments } from '../model/scenario';
import { effectiveSlots } from '../model/board';
import { defaultState } from './persist';

/**
 * What happens to the saved state when new LCR data is imported.
 *
 * - The board always switches back to Current, so the fresh data is what
 *   you see first.
 * - Real data replacing the demo wipes everything demo-related.
 * - Otherwise every scenario keeps its planned moves, re-applied on top of
 *   the new data (see rebaseAssignments).
 */
export function applyImport(state: AppState, baseline: Baseline): AppState {
  if (state.baseline?.demo && !baseline.demo) {
    const d = defaultState();
    return {
      ...state,
      baseline,
      wardName: state.wardName.endsWith('(demo)') ? d.wardName : state.wardName,
      structure: d.structure,
      manualMembers: [],
      memberFlags: {},
      scenarios: [],
      activeScenarioId: null,
    };
  }

  const next: AppState = { ...state, baseline, activeScenarioId: null };
  const memberIds = new Set([...baseline.members, ...state.manualMembers].map((m) => m.id));
  const oldBase = state.baseline?.assignments ?? [];

  next.scenarios = state.scenarios.map((s) => {
    const slots = new Map(effectiveSlots(next, s, baseline.assignments).map((x) => [x.id, x]));
    return {
      ...s,
      basedOn: baseline.importedAt,
      assignments: rebaseAssignments(oldBase, s.assignments, baseline.assignments, {
        exists: (a) => memberIds.has(a.memberId) && slots.has(a.slotId),
        isMulti: (id) => !!slots.get(id)?.multi,
      }),
    };
  });
  return next;
}

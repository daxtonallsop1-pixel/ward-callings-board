import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppState, Baseline, Member, MemberFlags, Scenario, Settings, Slot } from '../model/types';
import { buildView, activeScenario, type BoardView } from '../model/board';
import { assign, newId, release, releaseAll, scenarioSlot } from '../model/scenario';
import { memberKey } from '../model/names';
import { buildBaseline, parseCsv, matchColumns, CALLING_FIELDS, MEMBER_FIELDS } from '../import/importLcr';
import { demoCsvs } from '../import/demo';
import { defaultState, loadState, migrate, saveState } from './persist';

type ScenarioSnapshot = Pick<Scenario, 'addedSlots' | 'assignments'>;

export interface MoveArgs {
  memberId: string;
  fromSlotId?: string;
  keep?: boolean;
}

export interface Store {
  state: AppState;
  view: BoardView;
  scenario: Scenario | null;
  /** Current is read-only; scenarios are always editable. */
  canPlan: boolean;
  canEditStructure: boolean;
  saveFailed: boolean;
  canUndo: boolean;
  actions: ReturnType<typeof makeActions>;
}

const Ctx = createContext<Store | null>(null);

export function useBoard(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useBoard outside BoardProvider');
  return s;
}

function makeActions(
  set: (fn: (s: AppState) => AppState) => void,
  get: () => AppState,
  undo: { push: (id: string, snap: ScenarioSnapshot) => void; pop: (id: string) => ScenarioSnapshot | undefined },
) {
  /** Edits the active scenario, remembering the previous version for undo. */
  const editScenario = (fn: (s: Scenario, state: AppState) => ScenarioSnapshot) => {
    const state = get();
    const scn = activeScenario(state);
    if (!scn) return;
    undo.push(scn.id, { addedSlots: scn.addedSlots, assignments: scn.assignments });
    set((s) => ({
      ...s,
      scenarios: s.scenarios.map((x) => (x.id === scn.id ? { ...x, ...fn(x, s) } : x)),
    }));
  };

  const isMulti = (state: AppState, slotId: string) => buildView(state).slotById.get(slotId)?.multi ?? false;

  return {
    setWardName: (wardName: string) => set((s) => ({ ...s, wardName })),
    updateSettings: (patch: Partial<Settings>) => set((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
    toggleSection: (key: string) =>
      set((s) => {
        const c = s.settings.collapsedSections;
        return { ...s, settings: { ...s.settings, collapsedSections: c.includes(key) ? c.filter((k) => k !== key) : [...c, key] } };
      }),

    importBaseline: (baseline: Baseline) => set((s) => ({ ...s, baseline })),

    loadDemo: () => {
      const { callings, members } = demoCsvs();
      const c = parseCsv(callings);
      const m = parseCsv(members);
      const { baseline } = buildBaseline({
        callings: c,
        callingMap: matchColumns(c.headers, CALLING_FIELDS),
        members: m,
        memberMap: matchColumns(m.headers, MEMBER_FIELDS),
      });
      set((s) => ({ ...defaultState(), settings: s.settings, wardName: 'Maple Grove Ward (demo)', baseline }));
    },

    // --- Scenarios ---------------------------------------------------------
    selectScenario: (id: string | null) => set((s) => ({ ...s, activeScenarioId: id })),

    newScenario: (name: string, copyFromId?: string) => {
      const id = newId('scn');
      set((s) => {
        const src = s.scenarios.find((x) => x.id === copyFromId);
        const scn: Scenario = {
          id,
          name,
          createdAt: new Date().toISOString(),
          basedOn: s.baseline?.importedAt ?? '',
          addedSlots: src ? src.addedSlots.map((x) => ({ ...x })) : [],
          assignments: (src ? src.assignments : s.baseline?.assignments ?? []).map((a) => ({ ...a })),
        };
        return { ...s, scenarios: [...s.scenarios, scn], activeScenarioId: id };
      });
      return id;
    },
    renameScenario: (id: string, name: string) =>
      set((s) => ({ ...s, scenarios: s.scenarios.map((x) => (x.id === id ? { ...x, name } : x)) })),
    deleteScenario: (id: string) =>
      set((s) => ({
        ...s,
        scenarios: s.scenarios.filter((x) => x.id !== id),
        activeScenarioId: s.activeScenarioId === id ? null : s.activeScenarioId,
      })),
    resetScenario: () =>
      editScenario((_x, s) => ({ addedSlots: [], assignments: (s.baseline?.assignments ?? []).map((a) => ({ ...a })) })),

    // --- Planning moves (active scenario only) -----------------------------
    moveTo: (toSlotId: string, { memberId, fromSlotId, keep }: MoveArgs) =>
      editScenario((x, s) => ({
        addedSlots: x.addedSlots,
        assignments: assign(x.assignments, memberId, toSlotId, {
          fromSlotId,
          keep,
          targetMulti: isMulti(s, toSlotId),
          baseline: s.baseline?.assignments,
        }),
      })),

    /** Drop onto a "New calling" placeholder. */
    moveToNewSlot: (orgId: string, title: string, { memberId, fromSlotId, keep }: MoveArgs) =>
      editScenario((x) => {
        const slot = scenarioSlot(orgId, title, 5000 + x.addedSlots.length);
        return {
          addedSlots: [...x.addedSlots, slot],
          assignments: assign(x.assignments, memberId, slot.id, { fromSlotId, keep }),
        };
      }),

    release: (memberId: string, slotId: string) =>
      editScenario((x) => ({ addedSlots: x.addedSlots, assignments: release(x.assignments, memberId, slotId) })),

    vacate: (slotId: string) => editScenario((x) => ({ addedSlots: x.addedSlots, assignments: releaseAll(x.assignments, slotId) })),

    undo: () => {
      const scn = activeScenario(get());
      if (!scn) return;
      const snap = undo.pop(scn.id);
      if (snap) set((s) => ({ ...s, scenarios: s.scenarios.map((x) => (x.id === scn.id ? { ...x, ...snap } : x)) }));
    },

    // --- Structure (scenario-only callings, or Current in edit mode) --------
    addSlot: (orgId: string, title: string) => {
      const state = get();
      if (activeScenario(state)) {
        editScenario((x) => ({ addedSlots: [...x.addedSlots, scenarioSlot(orgId, title, 5000 + x.addedSlots.length)], assignments: x.assignments }));
      } else {
        const slot: Slot = { ...scenarioSlot(orgId, title, 4000 + state.structure.addedSlots.length), id: newId(`added-${orgId}`) };
        set((s) => ({ ...s, structure: { ...s.structure, addedSlots: [...s.structure.addedSlots, slot] } }));
      }
    },
    renameSlot: (slotId: string, title: string) => {
      const scn = activeScenario(get());
      if (scn?.addedSlots.some((x) => x.id === slotId)) {
        editScenario((x) => ({ addedSlots: x.addedSlots.map((sl) => (sl.id === slotId ? { ...sl, title } : sl)), assignments: x.assignments }));
      } else {
        set((s) => ({ ...s, structure: { ...s.structure, titleOverrides: { ...s.structure.titleOverrides, [slotId]: title } } }));
      }
    },
    removeSlot: (slotId: string) => {
      const scn = activeScenario(get());
      if (scn?.addedSlots.some((x) => x.id === slotId)) {
        editScenario((x) => ({ addedSlots: x.addedSlots.filter((sl) => sl.id !== slotId), assignments: releaseAll(x.assignments, slotId) }));
      } else {
        set((s) => ({
          ...s,
          structure: {
            ...s.structure,
            addedSlots: s.structure.addedSlots.filter((sl) => sl.id !== slotId),
            removedSlotIds: [...s.structure.removedSlotIds, slotId],
          },
        }));
      }
    },

    // --- Members ------------------------------------------------------------
    setMemberFlag: (id: string, patch: MemberFlags) =>
      set((s) => ({ ...s, memberFlags: { ...s.memberFlags, [id]: { ...s.memberFlags[id], ...patch } } })),
    addManualMember: (name: string, gender?: 'M' | 'F', age?: number) =>
      set((s) => {
        let id = memberKey(name);
        const taken = new Set([...(s.baseline?.members ?? []), ...s.manualMembers].map((m) => m.id));
        for (let n = 2; taken.has(id); n++) id = `${memberKey(name)} #${n}`;
        const m: Member = { id, name, gender, age, manual: true };
        return { ...s, manualMembers: [...s.manualMembers, m] };
      }),
    removeManualMember: (id: string) => set((s) => ({ ...s, manualMembers: s.manualMembers.filter((m) => m.id !== id) })),

    // --- Backup -------------------------------------------------------------
    restore: (raw: unknown) => set(() => migrate(raw)),
    clearAll: () => set(() => defaultState()),
  };
}

export function BoardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);
  const [saveFailed, setSaveFailed] = useState(false);
  const [undoDepth, setUndoDepth] = useState(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  const undoStacks = useRef(new Map<string, ScenarioSnapshot[]>());

  useEffect(() => {
    setSaveFailed(!saveState(state));
  }, [state]);

  const set = useCallback((fn: (s: AppState) => AppState) => setState((s) => fn(s)), []);
  const get = useCallback(() => stateRef.current, []);

  const actions = useMemo(
    () =>
      makeActions(set, get, {
        push: (id, snap) => {
          const stack = undoStacks.current.get(id) ?? [];
          stack.push(snap);
          if (stack.length > 100) stack.shift();
          undoStacks.current.set(id, stack);
          setUndoDepth(stack.length);
        },
        pop: (id) => {
          const stack = undoStacks.current.get(id);
          const snap = stack?.pop();
          setUndoDepth(stack?.length ?? 0);
          return snap;
        },
      }),
    [set, get],
  );

  const view = useMemo(() => buildView(state), [state]);
  const scenario = activeScenario(state);
  const canUndo = !!scenario && (undoStacks.current.get(scenario.id)?.length ?? 0) > 0 && undoDepth >= 0;

  const store: Store = {
    state,
    view,
    scenario,
    canPlan: !!scenario,
    canEditStructure: !!scenario || state.settings.editMode,
    saveFailed,
    canUndo,
    actions,
  };
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

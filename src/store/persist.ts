import type { AppState } from '../model/types';

export const STORAGE_KEY = 'ward-callings-board';
export const SCHEMA_VERSION = 1;

export function defaultState(): AppState {
  return {
    version: SCHEMA_VERSION,
    wardName: 'Ward Callings',
    baseline: null,
    structure: { addedSlots: [], removedSlotIds: [], titleOverrides: {} },
    manualMembers: [],
    memberFlags: {},
    scenarios: [],
    activeScenarioId: null,
    settings: {
      tenureCutoffs: [9, 18, 24],
      placeholdersPerOrg: 2,
      editMode: false,
      showYouth: false,
      collapsedSections: [],
    },
  };
}

/**
 * Accepts anything that was ever saved (or a backup file) and returns a
 * complete, current-version state. Unknown / missing fields fall back to
 * defaults so an older save never crashes the app.
 */
export function migrate(raw: unknown): AppState {
  const d = defaultState();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<AppState>;
  const settings = { ...d.settings, ...(r.settings ?? {}) };
  if (!Array.isArray(settings.tenureCutoffs) || settings.tenureCutoffs.length !== 3) settings.tenureCutoffs = d.settings.tenureCutoffs;
  return {
    version: SCHEMA_VERSION,
    wardName: typeof r.wardName === 'string' && r.wardName ? r.wardName : d.wardName,
    baseline: r.baseline ?? null,
    structure: { ...d.structure, ...(r.structure ?? {}) },
    manualMembers: Array.isArray(r.manualMembers) ? r.manualMembers : [],
    memberFlags: r.memberFlags ?? {},
    scenarios: Array.isArray(r.scenarios) ? r.scenarios.map((s) => ({ ...s, addedSlots: s.addedSlots ?? [], assignments: s.assignments ?? [] })) : [],
    activeScenarioId: r.activeScenarioId ?? null,
    settings,
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? migrate(JSON.parse(raw)) : defaultState();
  } catch {
    return defaultState();
  }
}

export function saveState(state: AppState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

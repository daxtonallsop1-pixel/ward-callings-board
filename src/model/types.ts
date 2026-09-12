export type OrgGroup = 'ward' | 'stake' | 'mission';

export interface Organization {
  id: string;
  name: string;
  group: OrgGroup;
  order: number;
  /** Muted accent used for the card's top rule. */
  accent: string;
  /** Other names LCR may use for this organization. */
  aliases?: string[];
  /** Created from an import or by hand rather than the built-in template. */
  custom?: boolean;
}

export interface Slot {
  id: string;
  orgId: string;
  title: string;
  order: number;
  /** Sub-group inside an org, e.g. "Deacons Quorum Presidency". */
  section?: string;
  /** Can hold several people (teachers, ward missionaries, …). */
  multi?: boolean;
  /** Not part of the built-in template (imported, or added by the bishopric). */
  custom?: boolean;
  /** Other calling names LCR may use for this slot. */
  aliases?: string[];
}

export interface Member {
  /** Normalized LCR name ("last, first"), plus "#2" etc. for duplicate names. */
  id: string;
  /** Name as LCR exports it, usually "Last, First Middle". */
  name: string;
  gender?: 'M' | 'F';
  age?: number;
  /** Added by hand (e.g. a move-in whose records haven't arrived). */
  manual?: boolean;
}

export interface Assignment {
  slotId: string;
  memberId: string;
  /** ISO date (yyyy-mm-dd). Missing for callings proposed in a scenario. */
  sustained?: string;
  setApart?: boolean;
}

/** Everything that came from the most recent LCR import. */
export interface Baseline {
  importedAt: string;
  orgs: Organization[];
  slots: Slot[];
  members: Member[];
  assignments: Assignment[];
}

/** Structural edits the bishopric made to Current (survive re-imports). */
export interface StructureEdits {
  addedSlots: Slot[];
  removedSlotIds: string[];
  titleOverrides: Record<string, string>;
}

export interface Scenario {
  id: string;
  name: string;
  createdAt: string;
  /** baseline.importedAt when the scenario was created. */
  basedOn: string;
  /** Callings the bishop is considering that don't exist in LCR. */
  addedSlots: Slot[];
  assignments: Assignment[];
}

export interface MemberFlags {
  onMission?: boolean;
  hidden?: boolean;
}

export interface Settings {
  /** Month cutoffs between green | amber | dark amber | red. */
  tenureCutoffs: [number, number, number];
  placeholdersPerOrg: number;
  editMode: boolean;
  /** Youth (11–17) are hidden from the Available list unless toggled on. */
  showYouth: boolean;
  collapsedSections: string[];
}

export interface AppState {
  version: number;
  wardName: string;
  baseline: Baseline | null;
  structure: StructureEdits;
  manualMembers: Member[];
  memberFlags: Record<string, MemberFlags>;
  scenarios: Scenario[];
  activeScenarioId: string | null;
  settings: Settings;
}

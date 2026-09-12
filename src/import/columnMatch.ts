/*
 * LCR column headers vary a little between reports and over time, so match
 * them loosely. Anything we can't find confidently is surfaced in the import
 * dialog for the user to map by hand.
 */

export type Field = 'name' | 'organization' | 'calling' | 'sustained' | 'setApart' | 'gender' | 'age' | 'birthDate';

export const FIELD_LABELS: Record<Field, string> = {
  name: 'Name',
  organization: 'Organization',
  calling: 'Calling',
  sustained: 'Sustained date',
  setApart: 'Set apart',
  gender: 'Gender',
  age: 'Age',
  birthDate: 'Birth date',
};

const SYNONYMS: Record<Field, string[]> = {
  name: ['name', 'preferred name', 'member name', 'full name', 'individual', 'member', 'names'],
  organization: ['organization', 'org', 'organization name', 'sub organization', 'suborganization', 'group'],
  calling: ['calling', 'position', 'calling name', 'callings'],
  sustained: ['sustained', 'date sustained', 'sustained date', 'active date', 'start date', 'date called', 'called'],
  setApart: ['set apart', 'set apart date', 'date set apart'],
  gender: ['gender', 'sex'],
  age: ['age'],
  birthDate: ['birth date', 'birthdate', 'birthday', 'date of birth'],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export type ColumnMap = Partial<Record<Field, string>>;

export function matchColumns(headers: string[], fields: Field[]): ColumnMap {
  const map: ColumnMap = {};
  const used = new Set<string>();
  // Exact synonym matches first, then "contains" matches.
  for (const pass of ['exact', 'contains'] as const) {
    for (const f of fields) {
      if (map[f]) continue;
      const hit = headers.find((h) => {
        if (used.has(h)) return false;
        const n = norm(h);
        return SYNONYMS[f].some((syn) => (pass === 'exact' ? n === syn : n.includes(syn)));
      });
      if (hit) {
        map[f] = hit;
        used.add(hit);
      }
    }
  }
  return map;
}

export function missingFields(map: ColumnMap, required: Field[]): Field[] {
  return required.filter((f) => !map[f]);
}

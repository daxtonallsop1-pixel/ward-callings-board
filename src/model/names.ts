/** Stable id for a person from their LCR name ("Last, First Middle"). */
export function memberKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9,]+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "Doe, Jane Marie" -> "Jane Marie Doe". Names without a comma pass through. */
export function displayName(name: string): string {
  const i = name.indexOf(',');
  if (i < 0) return name.trim();
  const last = name.slice(0, i).trim();
  const first = name.slice(i + 1).trim();
  return first ? `${first} ${last}` : last;
}

/** For sorting lists by last name. */
export function sortName(name: string): string {
  return memberKey(name);
}

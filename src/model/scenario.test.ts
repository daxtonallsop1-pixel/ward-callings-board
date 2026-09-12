import { describe, expect, it } from 'vitest';
import { assign, diffScenario, release } from './scenario';
import type { Assignment } from './types';

const base: Assignment[] = [
  { slotId: 'eq.president', memberId: 'adams', sustained: '2025-01-01' },
  { slotId: 'eq.1c', memberId: 'baker', sustained: '2025-01-01' },
  { slotId: 'primary.teacher', memberId: 'cole', sustained: '2025-06-01' },
];

describe('assign', () => {
  it('moves: releases from the source slot', () => {
    const next = assign(base, 'baker', 'eq.president', { fromSlotId: 'eq.1c' });
    expect(next.find((a) => a.memberId === 'baker')?.slotId).toBe('eq.president');
    expect(next.some((a) => a.slotId === 'eq.1c')).toBe(false);
    // Single slot: previous president is released
    expect(next.some((a) => a.memberId === 'adams')).toBe(false);
  });

  it('keep (Alt) adds a second calling', () => {
    const next = assign(base, 'baker', 'primary.teacher', { fromSlotId: 'eq.1c', keep: true, targetMulti: true });
    expect(next.filter((a) => a.memberId === 'baker').map((a) => a.slotId).sort()).toEqual(['eq.1c', 'primary.teacher']);
    expect(next.some((a) => a.memberId === 'cole')).toBe(true); // multi: nobody replaced
  });

  it('restores the original sustained date when moved back', () => {
    const away = assign(base, 'adams', 'primary.teacher', { fromSlotId: 'eq.president', targetMulti: true });
    const back = assign(away, 'adams', 'eq.president', { fromSlotId: 'primary.teacher', baseline: base });
    expect(back.find((a) => a.slotId === 'eq.president')?.sustained).toBe('2025-01-01');
    expect(diffScenario(base, back).changes).toEqual([]);
  });

  it('is a no-op when already holding the slot', () => {
    expect(assign(base, 'adams', 'eq.president')).toBe(base);
  });
});

describe('diffScenario', () => {
  it('classifies move, call, release and vacated', () => {
    let s = assign(base, 'baker', 'eq.president', { fromSlotId: 'eq.1c' }); // baker moves, adams released
    s = assign(s, 'dunn', 'eq.1c'); // new call
    s = release(s, 'cole', 'primary.teacher'); // release -> vacated

    const d = diffScenario(base, s);
    const byMember = Object.fromEntries(d.changes.map((c) => [c.memberId, c.kind]));
    expect(byMember).toEqual({ baker: 'move', dunn: 'call', adams: 'release', cole: 'release' });
    expect(d.vacated).toEqual(['primary.teacher']);
    expect(d.replaced.get('eq.president')).toEqual(['adams']);
    expect([...d.releasedMembers].sort()).toEqual(['adams', 'cole']);
  });

  it('dual calling is a call, not a move, and not "released"', () => {
    const s = assign(base, 'adams', 'primary.teacher', { fromSlotId: 'eq.president', keep: true, targetMulti: true });
    const d = diffScenario(base, s);
    expect(d.changes).toEqual([{ kind: 'call', memberId: 'adams', from: [], to: ['primary.teacher'] }]);
    expect(d.releasedMembers.size).toBe(0);
  });
});

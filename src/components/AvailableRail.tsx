import { useMemo, useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { Member } from '../model/types';
import { displayName } from '../model/names';
import { useBoard } from '../store/useBoardStore';
import { Menu, type DragData, type DropData } from './common';

type Gender = 'all' | 'M' | 'F';

/** Older saves don't record it; if anyone is uncalled, a list was imported. */
export function hasMemberList(baseline: { hasMemberList?: boolean } | null, view: { available: unknown[]; youthAvailable: unknown[]; hidden: unknown[] }): boolean {
  return baseline?.hasMemberList ?? view.available.length + view.youthAvailable.length + view.hidden.length > 0;
}

export function AvailableRail() {
  const { state, view, canPlan, actions } = useBoard();
  const [q, setQ] = useState('');
  const [gender, setGender] = useState<Gender>('all');
  const [showHidden, setShowHidden] = useState(false);
  const [adding, setAdding] = useState(false);

  const drop: DropData = { kind: 'rail' };
  const { setNodeRef, isOver } = useDroppable({ id: 'rail', data: drop, disabled: !canPlan });

  const filter = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (list: Member[]) =>
      list.filter((m) => (gender === 'all' || m.gender === gender) && (!needle || displayName(m.name).toLowerCase().includes(needle) || m.name.toLowerCase().includes(needle)));
  }, [q, gender]);

  const adults = filter(view.available);
  const youth = state.settings.showYouth ? filter(view.youthAvailable) : [];
  const released = view.diff?.releasedMembers ?? new Set<string>();

  return (
    <aside ref={setNodeRef} className={`rail ${isOver ? 'over' : ''}`} aria-label="Members without a calling">
      <div className="rail-head">
        <div className="title">
          <h2>Available</h2>
          <span className="big">{view.available.length + (state.settings.showYouth ? view.youthAvailable.length : 0)}</span>
        </div>
        <p className="hint">{canPlan ? 'Drag a name onto a calling. Drop a name here to release.' : 'Members without a calling. Start a scenario to move people.'}</p>
        <input className="search" type="search" placeholder="Search names" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="filters">
          <div className="seg" role="group" aria-label="Filter by gender">
            {(['all', 'M', 'F'] as Gender[]).map((g) => (
              <button key={g} className={gender === g ? 'on' : ''} onClick={() => setGender(g)}>
                {g === 'all' ? 'All' : g === 'M' ? 'Men' : 'Women'}
              </button>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" checked={state.settings.showYouth} onChange={(e) => actions.updateSettings({ showYouth: e.target.checked })} />
            Youth 11–17
          </label>
        </div>
      </div>

      <div className="rail-list">
        {adults.map((m) => (
          <PersonRow key={m.id} m={m} draggable={canPlan} released={released.has(m.id)} />
        ))}
        {!adults.length && (
          <p className="empty-note">
            {view.available.length
              ? 'No matches.'
              : hasMemberList(state.baseline, view)
                ? 'Everyone has a calling.'
                : 'No member list imported yet, so the board can’t tell who doesn’t have a calling. Click Import and add one in box 2.'}
          </p>
        )}
        {state.settings.showYouth && (
          <>
            <div className="rail-group">Youth · {view.youthAvailable.length}</div>
            {youth.map((m) => (
              <PersonRow key={m.id} m={m} draggable={canPlan} released={released.has(m.id)} />
            ))}
          </>
        )}
        {showHidden && (
          <>
            <div className="rail-group">Hidden · {view.hidden.length}</div>
            {view.hidden.map((m) => (
              <PersonRow key={m.id} m={m} draggable={false} released={false} hidden />
            ))}
          </>
        )}
      </div>

      <div className="rail-foot">
        {adding ? (
          <AddPerson onDone={() => setAdding(false)} />
        ) : (
          <>
            <button className="linkbtn" onClick={() => setAdding(true)}>
              ＋ Add person
            </button>
            {view.hidden.length > 0 && (
              <button className="linkbtn" onClick={() => setShowHidden((s) => !s)}>
                {showHidden ? 'Hide' : 'Show'} hidden ({view.hidden.length})
              </button>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

function PersonRow({ m, draggable, released, hidden }: { m: Member; draggable: boolean; released: boolean; hidden?: boolean }) {
  const { actions } = useBoard();
  const data: DragData = { memberId: m.id };
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: `m|${m.id}`, data, disabled: !draggable });
  const meta = [m.gender, m.age].filter((x) => x !== undefined).join(' · ');
  return (
    <div ref={setNodeRef} className={`person ${draggable ? 'draggable' : ''} ${isDragging ? 'dragging' : ''}`} {...(draggable ? { ...attributes, ...listeners } : {})}>
      <span className="name">{displayName(m.name)}</span>
      {released && <span className="released">Released</span>}
      {m.manual && <span className="meta">added</span>}
      {meta && <span className="meta">{meta}</span>}
      <Menu trigger="⋯" className="more" align="right" label={`Options for ${displayName(m.name)}`}>
        {hidden ? (
          <button onClick={() => actions.setMemberFlag(m.id, { hidden: false })}>Show in Available</button>
        ) : (
          <>
            <button onClick={() => actions.setMemberFlag(m.id, { onMission: true })}>Serving a mission</button>
            <button onClick={() => actions.setMemberFlag(m.id, { hidden: true })}>Hide from this list</button>
          </>
        )}
        {m.manual && (
          <button className="danger" onClick={() => actions.removeManualMember(m.id)}>
            Remove person
          </button>
        )}
      </Menu>
    </div>
  );
}

function AddPerson({ onDone }: { onDone: () => void }) {
  const { actions } = useBoard();
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [gender, setGender] = useState<'' | 'M' | 'F'>('');
  const [age, setAge] = useState('');
  const save = () => {
    if (!last.trim() && !first.trim()) return onDone();
    actions.addManualMember(`${last.trim()}, ${first.trim()}`, gender || undefined, age ? parseInt(age, 10) : undefined);
    onDone();
  };
  return (
    <form
      className="add-person"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <input autoFocus placeholder="First name" value={first} onChange={(e) => setFirst(e.target.value)} />
      <select value={gender} onChange={(e) => setGender(e.target.value as '' | 'M' | 'F')} aria-label="Gender">
        <option value="">–</option>
        <option value="M">M</option>
        <option value="F">F</option>
      </select>
      <input type="number" min={0} max={120} placeholder="Age" value={age} onChange={(e) => setAge(e.target.value)} />
      <input placeholder="Last name" value={last} onChange={(e) => setLast(e.target.value)} />
      <button className="btn primary" type="submit">
        Add
      </button>
      <button className="btn" type="button" onClick={onDone}>
        Cancel
      </button>
    </form>
  );
}

import { createContext, useContext, useState, type CSSProperties } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { Holder, OrgView, SlotView } from '../model/board';
import { displayName } from '../model/names';
import { useBoard } from '../store/useBoardStore';
import { EditableText, TenureChip, type DragData, type DropData } from './common';

/** The focus view renders a second copy of a card; drag ids must stay unique. */
const Surface = createContext('');

export function OrgCard({ ov, onFocus, surface = '' }: { ov: OrgView; onFocus?: () => void; surface?: string }) {
  return (
    <Surface.Provider value={surface}>
      <OrgCardInner ov={ov} onFocus={onFocus} />
    </Surface.Provider>
  );
}

function OrgCardInner({ ov, onFocus }: { ov: OrgView; onFocus?: () => void }) {
  const { state, view, canEditStructure, actions } = useBoard();
  const { org } = ov;
  const isMission = org.group === 'mission';
  const isStake = org.group === 'stake';

  if (isMission && view.missionaries.length === 0) return null;
  if (isStake && ov.filled === 0) return null;

  const placeholders = !isMission && !isStake && canEditStructure ? state.settings.placeholdersPerOrg : 0;
  const count = isMission ? `${view.missionaries.length} serving` : `${ov.filled} of ${ov.total} filled`;

  return (
    <section className="card" style={{ '--accent': org.accent } as CSSProperties} aria-label={org.name}>
      <header className="card-head">
        <button onClick={onFocus} title={onFocus ? 'Show this organization full screen' : undefined}>
          {org.name}
        </button>
        <span className="count">{count}</span>
      </header>
      <div className="card-body">
        {isMission
          ? view.missionaries.map((m) => (
              <div className="slot" key={m.id}>
                <div className="holder">
                  <span className="name">{displayName(m.name)}</span>
                  <span className="tenure">Serving</span>
                  <button className="iconbtn" style={{ fontSize: '1rem' }} title="No longer serving" onClick={() => actions.setMemberFlag(m.id, { onMission: false })}>
                    ×
                  </button>
                </div>
              </div>
            ))
          : ov.sections.map((sec) => {
              const key = `${org.id}:${sec.name ?? ''}`;
              const collapsed = !!sec.name && state.settings.collapsedSections.includes(key);
              // Stake card only lists callings someone actually holds.
              const slots = isStake ? sec.slots.filter((s) => s.holders.length) : sec.slots;
              // Placeholders sit after the adult callings, above youth sections.
              const ph =
                !sec.name &&
                Array.from({ length: placeholders }, (_, i) => <Placeholder key={`ph${i}`} orgId={org.id} index={i} />);
              if (!slots.length && !ph) return null;
              return (
                <div key={key}>
                  {sec.name && (
                    <button className={`section-head ${collapsed ? 'collapsed' : ''}`} onClick={() => actions.toggleSection(key)} aria-expanded={!collapsed}>
                      <span>
                        <span className="chev">▾</span>
                        {sec.name}
                      </span>
                      {!isStake && (
                        <span className="count">
                          {sec.filled}/{sec.slots.length}
                        </span>
                      )}
                    </button>
                  )}
                  {!collapsed && slots.map((sv) => <SlotRow key={sv.slot.id} sv={sv} locked={isStake} />)}
                  {ph}
                </div>
              );
            })}
      </div>
    </section>
  );
}

function SlotRow({ sv, locked }: { sv: SlotView; locked?: boolean }) {
  const { state, canPlan, canEditStructure, actions } = useBoard();
  const surface = useContext(Surface);
  const { slot, holders, replaced } = sv;
  const drop: DropData = { kind: 'slot', slotId: slot.id };
  const { setNodeRef, isOver } = useDroppable({ id: `${surface}slot|${slot.id}`, data: drop, disabled: !canPlan || locked });

  const structureAdded = state.structure.addedSlots.some((s) => s.id === slot.id);
  const renamable = !locked && (sv.scenarioOnly || (state.settings.editMode && !canPlan));
  const removable = !locked && (sv.scenarioOnly || (state.settings.editMode && !canPlan && (structureAdded || !holders.length)));
  const changed = replaced.length > 0 || holders.some((h) => h.isNew) || sv.scenarioOnly;

  return (
    <div ref={setNodeRef} className={`slot ${isOver ? 'over' : ''} ${changed ? 'changed' : ''}`}>
      <div className="slot-title">
        <EditableText value={slot.title} editable={renamable && canEditStructure} onSave={(t) => actions.renameSlot(slot.id, t)} />
        {sv.scenarioOnly && <span className="tag">Proposed calling</span>}
        {removable && (
          <button
            className="x"
            title={sv.scenarioOnly ? 'Remove this proposed calling' : 'Remove this calling from the board'}
            onClick={() => {
              if (sv.scenarioOnly || confirm(`Remove "${slot.title}" from the board? (It will come back if LCR ever lists someone in it.)`)) actions.removeSlot(slot.id);
            }}
          >
            ×
          </button>
        )}
      </div>
      {holders.map((h) => (
        <HolderRow key={h.member.id} h={h} slotId={slot.id} draggable={canPlan && !locked} />
      ))}
      {!holders.length && <span className="vacant">Vacant</span>}
      {replaced.length > 0 && (
        <div className="was">
          was{' '}
          {replaced.map((m, i) => (
            <span key={m.id}>
              {i > 0 && ', '}
              <s>{displayName(m.name)}</s>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function HolderRow({ h, slotId, draggable }: { h: Holder; slotId: string; draggable: boolean }) {
  const { state } = useBoard();
  const surface = useContext(Surface);
  const data: DragData = { memberId: h.member.id, fromSlotId: slotId };
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: `${surface}h|${slotId}|${h.member.id}`, data, disabled: !draggable });
  return (
    <div
      ref={setNodeRef}
      className={`holder ${draggable ? 'draggable' : ''} ${isDragging ? 'dragging' : ''}`}
      {...(draggable ? { ...attributes, ...listeners } : {})}
      title={h.assignment.sustained ? `Sustained ${h.assignment.sustained}${h.assignment.setApart === false ? ' · not yet set apart' : ''}` : undefined}
    >
      <span className="name">{displayName(h.member.name)}</span>
      <TenureChip months={h.months} cutoffs={state.settings.tenureCutoffs} isNew={h.isNew} />
    </div>
  );
}

function Placeholder({ orgId, index }: { orgId: string; index: number }) {
  const { canPlan, actions } = useBoard();
  const surface = useContext(Surface);
  const [naming, setNaming] = useState(false);
  const drop: DropData = { kind: 'placeholder', orgId };
  const { setNodeRef, isOver } = useDroppable({ id: `${surface}ph|${orgId}|${index}`, data: drop, disabled: !canPlan });

  if (naming) {
    return (
      <div className="placeholder" ref={setNodeRef}>
        <EditableText
          value=""
          editable
          startEditing
          placeholder="Name the new calling…"
          onSave={(t) => {
            actions.addSlot(orgId, t);
            setNaming(false);
          }}
          onCancel={() => setNaming(false)}
        />
      </div>
    );
  }
  return (
    <button ref={setNodeRef} className={`placeholder ${isOver ? 'over' : ''}`} onClick={() => setNaming(true)} title="Click to name a new calling, or drop a person here">
      <span aria-hidden>＋</span> New calling
    </button>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { useBoard } from './store/useBoardStore';
import { displayName } from './model/names';
import { Header, PlanBand } from './components/Header';
import { OrgCard } from './components/OrgCard';
import { AvailableRail } from './components/AvailableRail';
import { ChangesDrawer } from './components/ChangesDrawer';
import { ImportDialog } from './components/ImportDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { Welcome } from './components/Welcome';
import type { DragData, DropData } from './components/common';

export default function App() {
  const { state, view, scenario, saveFailed, actions } = useBoard();
  const [dialog, setDialog] = useState<'import' | 'settings' | null>(null);
  const [focusOrg, setFocusOrg] = useState<string | null>(null);
  const [blank, setBlank] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [dragging, setDragging] = useState<DragData | null>(null);
  const [keepHeld, setKeepHeld] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Alt or Ctrl held while dropping = keep their current calling too.
  const keep = useRef(false);

  const showToast = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast((t) => (t === m ? null : t)), 3500);
  }, []);

  useEffect(() => {
    const track = (e: KeyboardEvent | PointerEvent) => {
      keep.current = e.altKey || e.ctrlKey;
      setKeepHeld(keep.current);
    };
    const onKey = (e: KeyboardEvent) => {
      track(e);
      if (e.key === 'Alt') e.preventDefault(); // stop Windows focusing the browser menu
      const typing = (e.target as HTMLElement).closest?.('input, textarea, select');
      if (typing) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        actions.undo();
      } else if (e.key.toLowerCase() === 'b' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setBlank((b) => !b);
      } else if (e.key === 'Escape') {
        setBlank(false);
        setFocusOrg(null);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', track);
    window.addEventListener('pointermove', track);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', track);
      window.removeEventListener('pointermove', track);
    };
  }, [actions]);

  useEffect(() => {
    if (!scenario) setChangesOpen(false);
  }, [scenario]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragStart = (e: DragStartEvent) => setDragging(e.active.data.current as DragData);
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const src = e.active.data.current as DragData | undefined;
    const dst = e.over?.data.current as DropData | undefined;
    if (!src || !dst) return;
    const args = { memberId: src.memberId, fromSlotId: src.fromSlotId, keep: keep.current };
    if (dst.kind === 'slot') actions.moveTo(dst.slotId, args);
    else if (dst.kind === 'placeholder') actions.moveToNewSlot(dst.orgId, 'New calling', args);
    else if (dst.kind === 'rail' && src.fromSlotId) actions.release(src.memberId, src.fromSlotId);
  };

  const dragName = dragging ? displayName(view.memberById.get(dragging.memberId)?.name ?? '') : '';
  const focused = view.orgs.find((o) => o.org.id === focusOrg);

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="app">
        <Header onImport={() => setDialog('import')} onSettings={() => setDialog('settings')} onBlank={() => setBlank(true)} />
        <PlanBand onChanges={() => setChangesOpen((o) => !o)} changesOpen={changesOpen} />

        {state.baseline ? (
          <main className="main">
            <div className="board-scroll">
              <div className="board">
                {view.orgs.map((ov) => (
                  <OrgCard key={ov.org.id} ov={ov} onFocus={() => setFocusOrg(ov.org.id)} />
                ))}
              </div>
            </div>
            <AvailableRail />
            {changesOpen && <ChangesDrawer onClose={() => setChangesOpen(false)} />}
          </main>
        ) : (
          <main style={{ overflowY: 'auto', padding: '0 1rem' }}>
            <Welcome onImport={() => setDialog('import')} />
          </main>
        )}
      </div>

      {focused && (
        <div className="focus-overlay">
          <button className="btn focus-close" onClick={() => setFocusOrg(null)}>
            Close <span className="kbd">Esc</span>
          </button>
          <OrgCard ov={focused} surface="focus:" />
        </div>
      )}

      <DragOverlay dropAnimation={null}>
        {dragging && (
          <div className="drag-pill">
            {dragName}
            {dragging.fromSlotId && <span className="hint">{keepHeld ? '+ keeps current calling' : 'hold Ctrl to keep current calling'}</span>}
          </div>
        )}
      </DragOverlay>

      {dialog === 'import' && (
        <ImportDialog
          onClose={() => setDialog(null)}
          onDone={(m) => {
            setDialog(null);
            showToast(m);
          }}
        />
      )}
      {dialog === 'settings' && <SettingsDialog onClose={() => setDialog(null)} onToast={showToast} />}

      {blank && (
        <div className="blank" onClick={() => setBlank(false)}>
          <div>
            <div className="w">{state.wardName}</div>
            <div className="h">Press B or click to return</div>
          </div>
        </div>
      )}

      {saveFailed && <div className="toast">Couldn't save to this browser (private window or storage full). Download a backup in Settings.</div>}
      {toast && !saveFailed && <div className="toast">{toast}</div>}
    </DndContext>
  );
}

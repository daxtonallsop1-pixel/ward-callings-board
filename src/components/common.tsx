import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { BoardView } from '../model/board';
import { formatTenure, tenureBand } from '../model/tenure';

/* ------------------------------------------------------------- Drag data */

export interface DragData {
  memberId: string;
  /** Set when dragged out of a calling (released on move unless Alt/Ctrl). */
  fromSlotId?: string;
}

export type DropData = { kind: 'slot'; slotId: string } | { kind: 'placeholder'; orgId: string } | { kind: 'rail' };

/* ------------------------------------------------------------- Tenure chip */

export function TenureChip({ months, cutoffs, isNew }: { months?: number; cutoffs: [number, number, number]; isNew?: boolean }) {
  if (isNew) return <span className="newchip">New</span>;
  const band = tenureBand(months, cutoffs);
  return (
    <span className={`tenure t-${band}`} title={months === undefined ? 'No sustained date in LCR' : `${months} months in calling`}>
      <i className="dot" aria-hidden />
      {formatTenure(months)}
    </span>
  );
}

/* ------------------------------------------------------------- Inline edit */

export function EditableText({
  value,
  editable,
  onSave,
  className,
  startEditing,
  placeholder,
  onCancel,
}: {
  value: string;
  editable: boolean;
  onSave: (v: string) => void;
  className?: string;
  startEditing?: boolean;
  placeholder?: string;
  onCancel?: () => void;
}) {
  const [editing, setEditing] = useState(!!startEditing);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);

  if (!editing) {
    return (
      <span
        className={`${className ?? ''} ${editable ? 'editable' : ''}`}
        onClick={editable ? () => (setDraft(value), setEditing(true)) : undefined}
        title={editable ? 'Click to rename' : undefined}
      >
        {value}
      </span>
    );
  }
  const commit = () => {
    const v = draft.trim();
    setEditing(false);
    if (v && v !== value) onSave(v);
    else onCancel?.();
  };
  return (
    <input
      ref={ref}
      className="inline-input"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') {
          setEditing(false);
          onCancel?.();
        }
        e.stopPropagation();
      }}
      onPointerDown={(e) => e.stopPropagation()}
    />
  );
}

/* ------------------------------------------------------------- Menu */

export function Menu({
  trigger,
  children,
  align = 'left',
  className = 'hbtn',
  label,
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div className="menu-wrap" ref={ref}>
      <button className={className} aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)} onPointerDown={(e) => e.stopPropagation()}>
        {trigger}
      </button>
      {open && (
        <div className={`menu ${align}`} role="menu" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- Dialog */

export function Dialog({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="overlay" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal aria-label={title}>
        <div className="dialog-head">
          <h2>{title}</h2>
          <button className="iconbtn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Helpers */

export function slotLabel(view: BoardView, slotId: string): string {
  const slot = view.slotById.get(slotId);
  if (!slot) return 'a calling no longer on the board';
  const org = view.orgById.get(slot.orgId);
  const title = slot.section ? `${slot.section.replace(/ Presidency$/, '')} ${slot.title}` : slot.title;
  return org ? `${org.name} · ${title}` : title;
}

export function downloadFile(filename: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readFile(file: File): Promise<string> {
  return file.text();
}

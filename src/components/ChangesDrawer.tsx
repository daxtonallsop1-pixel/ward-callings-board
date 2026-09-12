import { useState } from 'react';
import { useBoard } from '../store/useBoardStore';
import { displayName } from '../model/names';
import type { Change } from '../model/scenario';
import { slotLabel } from './common';

export function ChangesDrawer({ onClose }: { onClose: () => void }) {
  const { view, scenario } = useBoard();
  const [copied, setCopied] = useState(false);
  const diff = view.diff;
  if (!scenario || !diff) return null;

  const name = (id: string) => {
    const m = view.memberById.get(id);
    return m ? displayName(m.name) : 'Unknown';
  };
  const labels = (ids: string[]) => ids.map((id) => slotLabel(view, id)).join(', ');
  const groups: [string, Change['kind']][] = [
    ['Moves', 'move'],
    ['New callings extended', 'call'],
    ['Releases', 'release'],
  ];
  const vacated = diff.vacated.filter((id) => view.slotById.has(id));

  const asText = () => {
    const lines = [`${scenario.name}: proposed changes`, ''];
    for (const [title, kind] of groups) {
      const list = diff.changes.filter((c) => c.kind === kind);
      if (!list.length) continue;
      lines.push(title.toUpperCase());
      for (const c of list) {
        if (kind === 'move') lines.push(`- ${name(c.memberId)}: ${labels(c.from)} -> ${labels(c.to)}`);
        if (kind === 'call') lines.push(`- ${name(c.memberId)}: ${labels(c.to)}`);
        if (kind === 'release') lines.push(`- ${name(c.memberId)}: released from ${labels(c.from)}`);
      }
      lines.push('');
    }
    if (diff.createdSlots.length) lines.push('PROPOSED NEW CALLINGS', ...diff.createdSlots.map((s) => `- ${slotLabel(view, s.id)}`), '');
    if (vacated.length) lines.push('LEFT VACANT', ...vacated.map((id) => `- ${slotLabel(view, id)}`));
    return lines.join('\n').trim();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked; nothing to do */
    }
  };

  return (
    <aside className="drawer" aria-label="Changes in this scenario">
      <div className="drawer-head">
        <h2>Changes vs. Current</h2>
        <button className="btn" onClick={copy} disabled={!diff.changes.length && !diff.createdSlots.length}>
          {copied ? 'Copied' : 'Copy as text'}
        </button>
        <button className="iconbtn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="drawer-body">
        {!diff.changes.length && !diff.createdSlots.length && <p className="empty-note">No changes yet. Drag people between callings to plan.</p>}

        {groups.map(([title, kind]) => {
          const list = diff.changes.filter((c) => c.kind === kind);
          if (!list.length) return null;
          return (
            <section key={kind}>
              <h3>
                {title} · {list.length}
              </h3>
              {list.map((c) => (
                <div className="change" key={c.memberId}>
                  <div className="who">{name(c.memberId)}</div>
                  <div className="what">
                    {kind === 'move' && (
                      <>
                        {labels(c.from)}
                        <span className="arrow">→</span>
                        {labels(c.to)}
                      </>
                    )}
                    {kind === 'call' && labels(c.to)}
                    {kind === 'release' && <>Released from {labels(c.from)}</>}
                  </div>
                </div>
              ))}
            </section>
          );
        })}

        {diff.createdSlots.length > 0 && (
          <section>
            <h3>Proposed new callings · {diff.createdSlots.length}</h3>
            {diff.createdSlots.map((s) => (
              <div className="change" key={s.id}>
                <div className="what">{slotLabel(view, s.id)}</div>
              </div>
            ))}
          </section>
        )}

        {vacated.length > 0 && (
          <section>
            <h3>Left vacant · {vacated.length}</h3>
            {vacated.map((id) => (
              <div className="change" key={id}>
                <div className="what">{slotLabel(view, id)}</div>
              </div>
            ))}
          </section>
        )}
      </div>
    </aside>
  );
}

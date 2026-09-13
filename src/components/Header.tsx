import { useBoard } from '../store/useBoardStore';
import { bandLegend } from '../model/tenure';
import { EditableText, Menu } from './common';
import { hasMemberList } from './AvailableRail';

export function Header({ onImport, onSettings, onBlank }: { onImport: () => void; onSettings: () => void; onBlank: () => void }) {
  const { state, view, scenario, actions } = useBoard();
  const ward = view.orgs.filter((o) => o.org.group === 'ward');
  const filled = ward.reduce((n, o) => n + o.filled, 0);
  const total = ward.reduce((n, o) => n + o.total, 0);
  const asOf = state.baseline ? new Date(state.baseline.importedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  return (
    <header className="header">
      <div className="ward">
        <h1>{state.wardName}</h1>
        <span className="sub">
          {asOf ? (
            <>
              LCR data as of {asOf} · {filled} of {total} callings filled
              {hasMemberList(state.baseline, view) ? ` · ${view.available.length} adults available` : ' · Available list not imported yet'}
            </>
          ) : (
            'No LCR data imported yet'
          )}
        </span>
      </div>

      <div className="legend" aria-label="Time in calling">
        <span className="caption">Time in calling</span>
        {bandLegend(state.settings.tenureCutoffs).map((b) => (
          <span key={b.band}>
            <i className={`dot t-${b.band}`} aria-hidden />
            {b.label}
          </span>
        ))}
      </div>

      <div className="header-actions">
        {state.baseline && (
          <Menu
            trigger={
              <>
                {scenario ? `Scenario: ${scenario.name}` : 'Current (LCR)'} <span className="caret">▼</span>
              </>
            }
            className={scenario ? 'hbtn primary' : 'hbtn'}
          >
            <div className="label">View</div>
            <button className={!scenario ? 'active' : ''} onClick={() => actions.selectScenario(null)}>
              Current (LCR)
            </button>
            {state.scenarios.map((s) => (
              <button key={s.id} className={scenario?.id === s.id ? 'active' : ''} onClick={() => actions.selectScenario(s.id)}>
                {s.name}
              </button>
            ))}
            <hr />
            <button onClick={() => actions.newScenario(nextName(state.scenarios.map((s) => s.name)))}>New scenario from Current</button>
            {scenario && <button onClick={() => actions.newScenario(`${scenario.name} (copy)`, scenario.id)}>Duplicate this scenario</button>}
          </Menu>
        )}
        <button className="hbtn" onClick={onImport}>
          Import
        </button>
        <button className="hbtn" onClick={onSettings}>
          Settings
        </button>
        <button className="hbtn" onClick={onBlank} title="Blank the screen (B)">
          Blank <span className="kbd">B</span>
        </button>
      </div>
    </header>
  );
}

function nextName(existing: string[]) {
  for (let n = 1; ; n++) if (!existing.includes(`Scenario ${n}`)) return `Scenario ${n}`;
}

export function PlanBand({ onChanges, changesOpen }: { onChanges: () => void; changesOpen: boolean }) {
  const { state, view, scenario, canUndo, actions } = useBoard();
  if (!scenario) return null;
  const n = view.diff?.changes.length ?? 0;
  const created = scenario.addedSlots.length;
  const stale = state.baseline && scenario.basedOn !== state.baseline.importedAt;

  return (
    <div className="plan-band" role="status">
      <span className="tag">Planning</span>
      <EditableText className="name" value={scenario.name} editable onSave={(name) => actions.renameScenario(scenario.id, name)} />
      <span className="note">Draft only · nothing here is official until extended and sustained</span>
      {stale && <span className="stale" title="LCR data was re-imported after this scenario was made. Moves still apply; double-check anyone who changed.">Built on older LCR data</span>}
      <span className="spacer" />
      <button className={`bbtn ${changesOpen ? 'strong' : ''}`} onClick={onChanges}>
        Changes ({n}
        {created ? ` · ${created} new calling${created > 1 ? 's' : ''}` : ''})
      </button>
      <button className="bbtn" onClick={actions.undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
        Undo
      </button>
      <button
        className="bbtn"
        onClick={() => confirm('Reset this scenario back to Current? You can undo this.') && actions.resetScenario()}
        disabled={!n && !created}
      >
        Reset
      </button>
      <button className="bbtn" onClick={() => confirm(`Delete scenario "${scenario.name}"? This can't be undone.`) && actions.deleteScenario(scenario.id)}>
        Delete
      </button>
      <button className="bbtn strong" onClick={() => actions.selectScenario(null)}>
        Back to Current
      </button>
    </div>
  );
}

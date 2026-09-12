import { useBoard } from '../store/useBoardStore';
import { Dialog, downloadFile } from './common';

export function SettingsDialog({ onClose, onToast }: { onClose: () => void; onToast: (m: string) => void }) {
  const { state, actions } = useBoard();
  const s = state.settings;

  const setCut = (i: number, v: string) => {
    const n = Math.max(1, Math.min(240, parseInt(v, 10) || 1));
    const c = [...s.tenureCutoffs] as [number, number, number];
    c[i] = n;
    // Keep them increasing.
    if (c[0] < c[1] && c[1] < c[2]) actions.updateSettings({ tenureCutoffs: c });
  };

  const backup = () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(`ward-board-backup-${date}.json`, JSON.stringify(state, null, 2));
    onToast('Backup downloaded. It contains member names, so keep it private.');
  };

  const restore = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (!confirm('Replace everything on this computer with the backup?')) return;
      actions.restore(data);
      onToast('Backup restored.');
      onClose();
    } catch {
      alert("That file isn't a valid board backup.");
    }
  };

  return (
    <Dialog title="Settings" onClose={onClose} footer={<button className="btn primary" onClick={onClose}>Done</button>}>
      <label className="field">
        <span>Ward name</span>
        <input type="text" value={state.wardName} onChange={(e) => actions.setWardName(e.target.value)} />
      </label>

      <div className="field">
        <span>Time-in-calling colors (months)</span>
        <div className="cutoffs">
          <i className="dot t-fresh" /> under
          <input type="number" defaultValue={s.tenureCutoffs[0]} onBlur={(e) => setCut(0, e.target.value)} aria-label="Green until" />
          <i className="dot t-settled" /> until
          <input type="number" defaultValue={s.tenureCutoffs[1]} onBlur={(e) => setCut(1, e.target.value)} aria-label="Amber until" />
          <i className="dot t-seasoned" /> until
          <input type="number" defaultValue={s.tenureCutoffs[2]} onBlur={(e) => setCut(2, e.target.value)} aria-label="Dark amber until" />
          <i className="dot t-long" /> after
        </div>
        <small>Each cutoff must be larger than the one before it.</small>
      </div>

      <label className="field">
        <span>"New calling" placeholders per organization</span>
        <select value={s.placeholdersPerOrg} onChange={(e) => actions.updateSettings({ placeholdersPerOrg: +e.target.value })}>
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <small>Shown in scenarios (and in Current while editing the board). Name one, or drop a person on it, to propose a calling LCR doesn't have yet.</small>
      </label>

      <label className="check" style={{ fontSize: '1rem', marginBottom: '0.3rem' }}>
        <input type="checkbox" checked={s.editMode} onChange={(e) => actions.updateSettings({ editMode: e.target.checked })} />
        Edit the board's callings (Current view)
      </label>
      <p className="help" style={{ marginTop: 0 }}>
        Lets you add, rename, and remove callings on the Current board. For example, remove a template calling your ward doesn't use. These edits are kept when you re-import.
      </p>

      <div className="settings-section">
        <h3>Backup &amp; sharing</h3>
        <p className="help">
          Everything is saved in this browser only. Download a backup now and then, and use it to hand your data and scenarios to the other clerk. A backup contains member names: keep it private and never commit it to GitHub.
        </p>
        <div className="row">
          <button className="btn" onClick={backup} disabled={!state.baseline}>
            Download backup
          </button>
          <label className="btn">
            Restore backup…
            <input
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) restore(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>

      <div className="settings-section">
        <h3>Data</h3>
        <div className="row">
          <button
            className="btn"
            onClick={() => {
              if (!state.baseline || confirm('Replace the current data with fictional demo data?')) {
                actions.loadDemo();
                onClose();
              }
            }}
          >
            Load demo data
          </button>
          <button
            className="btn danger"
            onClick={() => {
              if (confirm('Erase all data and scenarios from this browser? Download a backup first if you need one.')) {
                actions.clearAll();
                onClose();
              }
            }}
          >
            Erase all data
          </button>
        </div>
      </div>
    </Dialog>
  );
}

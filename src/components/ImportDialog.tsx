import { useMemo, useState } from 'react';
import { useBoard } from '../store/useBoardStore';
import { buildBaseline, parseCsv, CALLING_FIELDS, CALLING_REQUIRED, MEMBER_FIELDS, MEMBER_REQUIRED, type ParsedCsv } from '../import/importLcr';
import { FIELD_LABELS, matchColumns, missingFields, type ColumnMap, type Field } from '../import/columnMatch';
import { Dialog } from './common';

interface Loaded {
  fileName: string;
  csv: ParsedCsv;
  map: ColumnMap;
}

export function ImportDialog({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const { state, actions } = useBoard();
  const [callings, setCallings] = useState<Loaded | null>(null);
  const [members, setMembers] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async (file: File, fields: Field[], setter: (l: Loaded) => void) => {
    setError(null);
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      setError(`"${file.name}" is an Excel file. In LCR choose the CSV export, or open it in Excel and use File → Save As → CSV.`);
      return;
    }
    try {
      const csv = parseCsv(await file.text());
      if (!csv.headers.length || !csv.rows.length) throw new Error('empty');
      setter({ fileName: file.name, csv, map: matchColumns(csv.headers, fields) });
    } catch {
      setError(`Couldn't read "${file.name}" as a CSV report.`);
    }
  };

  const callingsMissing = callings ? missingFields(callings.map, CALLING_REQUIRED) : CALLING_REQUIRED;
  const membersMissing = members ? missingFields(members.map, MEMBER_REQUIRED) : [];

  const result = useMemo(() => {
    if (!callings || callingsMissing.length || membersMissing.length) return null;
    return buildBaseline({ callings: callings.csv, callingMap: callings.map, members: members?.csv, memberMap: members?.map });
  }, [callings, members, callingsMissing.length, membersMissing.length]);

  const doImport = () => {
    if (!result) return;
    actions.importBaseline(result.baseline);
    onDone(`Imported ${result.report.assignments} callings and ${result.report.members} members.`);
  };

  return (
    <Dialog
      title="Import from LCR"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!result} onClick={doImport}>
            {state.baseline ? 'Replace current data' : 'Import'}
          </button>
        </>
      }
    >
      <p className="help" style={{ marginTop: 0 }}>
        Files are read in this browser only. Nothing is uploaded anywhere. Keep exports in the project's <code>private/</code> folder (or delete them after importing), and never commit them to GitHub.
      </p>

      <FileZone
        title="1. Members with Callings"
        hint="LCR → Organizations → Members with Callings → export as CSV."
        loaded={callings}
        onFile={(f) => load(f, CALLING_FIELDS, setCallings)}
      />
      {callings && <Mapping loaded={callings} fields={CALLING_FIELDS} required={CALLING_REQUIRED} onChange={(map) => setCallings({ ...callings, map })} />}

      <FileZone
        title="2. Member list (recommended)"
        hint="Any LCR member list with Name (and ideally Gender and Age). This is how the board knows who doesn't have a calling."
        loaded={members}
        onFile={(f) => load(f, MEMBER_FIELDS, setMembers)}
      />
      {members && <Mapping loaded={members} fields={MEMBER_FIELDS} required={MEMBER_REQUIRED} onChange={(map) => setMembers({ ...members, map })} />}

      {error && <div className="warn">{error}</div>}

      {result && (
        <div className="preview">
          <div className="stats">
            <div className="stat">
              <b>{result.report.assignments}</b>
              <span>callings</span>
            </div>
            <div className="stat">
              <b>{result.report.members}</b>
              <span>members</span>
            </div>
            <div className="stat">
              <b>{result.report.newCallings.length}</b>
              <span>new callings found</span>
            </div>
            {result.report.skippedRows > 0 && (
              <div className="stat">
                <b>{result.report.skippedRows}</b>
                <span>rows skipped (no name/calling)</span>
              </div>
            )}
          </div>
          {result.report.newCallings.length > 0 && (
            <>
              <p className="help" style={{ marginBottom: 0 }}>
                These aren't in the built-in list, so they'll be added to the bottom of their organization. Send this list to whoever maintains the app to sort them in properly:
              </p>
              <ul>
                {result.report.newCallings.map((c, i) => (
                  <li key={i}>
                    {c.org}: {c.calling}
                  </li>
                ))}
              </ul>
            </>
          )}
          {result.report.newOrgs.length > 0 && <div className="note">New organizations added: {result.report.newOrgs.join(', ')}</div>}
          {result.report.duplicateNames.length > 0 && (
            <div className="note">Two or more members share these names, so callings may attach to the first one: {result.report.duplicateNames.join('; ')}</div>
          )}
          {result.report.membersOnlyInCallings.length > 0 && (
            <div className="note">
              {result.report.membersOnlyInCallings.length} people hold callings but aren't in the member list (often stake callings or name differences):{' '}
              {result.report.membersOnlyInCallings.slice(0, 8).join('; ')}
              {result.report.membersOnlyInCallings.length > 8 && '…'}
            </div>
          )}
          {!members && <div className="note">No member list: the Available column will be empty until you add one.</div>}
          {state.scenarios.length > 0 && (
            <p className="help">
              Your {state.scenarios.length} scenario{state.scenarios.length > 1 ? 's' : ''} will be kept and marked as built on older data.
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}

function FileZone({ title, hint, loaded, onFile }: { title: string; hint: string; loaded: Loaded | null; onFile: (f: File) => void }) {
  const [hot, setHot] = useState(false);
  return (
    <label
      className={`drop ${hot ? 'hot' : ''} ${loaded ? 'done' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setHot(true);
      }}
      onDragLeave={() => setHot(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHot(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
    >
      <strong>{title}</strong>
      <span className="help">{loaded ? `✓ ${loaded.fileName}: ${loaded.csv.rows.length} rows` : `${hint} Drop the file here or click to choose.`}</span>
      <input
        type="file"
        accept=".csv,text/csv,.xlsx,.xls"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
    </label>
  );
}

function Mapping({ loaded, fields, required, onChange }: { loaded: Loaded; fields: Field[]; required: Field[]; onChange: (m: ColumnMap) => void }) {
  const missing = missingFields(loaded.map, required);
  return (
    <details open={missing.length > 0} style={{ marginBottom: '0.75rem' }}>
      <summary className="help">{missing.length ? `Pick the column for: ${missing.map((f) => FIELD_LABELS[f]).join(', ')}` : 'Columns matched. Click to check.'}</summary>
      <div className="mapping">
        {fields.map((f) => (
          <label key={f}>
            {FIELD_LABELS[f]}
            {required.includes(f) ? ' *' : ''}
            <select
              className={missing.includes(f) ? 'missing' : ''}
              value={loaded.map[f] ?? ''}
              onChange={(e) => onChange({ ...loaded.map, [f]: e.target.value || undefined })}
            >
              <option value="">(none)</option>
              {loaded.csv.headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </details>
  );
}

import { useMemo, useState } from 'react';
import { useBoard } from '../store/useBoardStore';
import {
  buildBaseline,
  namesIn,
  parseCsv,
  stakeUnitOptions,
  CALLING_FIELDS,
  CALLING_REQUIRED,
  MEMBER_FIELDS,
  MEMBER_REQUIRED,
  STAKE_FIELDS,
  STAKE_REQUIRED,
  type ParsedCsv,
} from '../import/importLcr';
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
  const [stake, setStake] = useState<Loaded | null>(null);
  const [stakeUnit, setStakeUnit] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadText = (text: string, name: string, fields: Field[], setter: (l: Loaded) => void) => {
    try {
      const csv = parseCsv(text);
      if (csv.headers.length < 2 || !csv.rows.length) throw new Error('empty');
      setter({ fileName: name, csv, map: matchColumns(csv.headers, fields) });
    } catch {
      setError(`Couldn't find a table in ${name}. Make sure it's the right LCR report, with column headings (Name, Calling, …).`);
    }
  };

  const load = async (file: File, fields: Field[], setter: (l: Loaded) => void) => {
    setError(null);
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      setError(`"${file.name}" is an Excel file. Use the PDF from LCR's Print button instead.`);
      return;
    }
    if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
      setBusy(true);
      try {
        const { readPdfTable } = await import('../import/readPdf');
        const text = await readPdfTable(file);
        if (!text) setError(`Couldn't find a table with a "Name" column in "${file.name}". Is it one of the three LCR reports?`);
        else loadText(text, `"${file.name}"`, fields, setter);
      } catch {
        setError(`Couldn't open "${file.name}" as a PDF.`);
      } finally {
        setBusy(false);
      }
      return;
    }
    loadText(await file.text(), `"${file.name}"`, fields, setter);
  };

  // If the stake report covers several wards, pick ours (best name overlap).
  const unitOptions = useMemo(() => {
    if (!stake) return [];
    const known = new Set([...namesIn(callings?.csv, callings?.map), ...namesIn(members?.csv, members?.map)]);
    return stakeUnitOptions(stake.csv, stake.map, known);
  }, [stake, callings, members]);
  const unit = unitOptions.length > 1 ? (stakeUnit ?? unitOptions[0].unit) : undefined;

  const callingsMissing = callings ? missingFields(callings.map, CALLING_REQUIRED) : CALLING_REQUIRED;
  const membersMissing = members ? missingFields(members.map, MEMBER_REQUIRED) : [];
  const stakeMissing = stake ? missingFields(stake.map, STAKE_REQUIRED) : [];

  const result = useMemo(() => {
    if (!callings || callingsMissing.length || membersMissing.length || stakeMissing.length) return null;
    return buildBaseline({
      callings: callings.csv,
      callingMap: callings.map,
      members: members?.csv,
      memberMap: members?.map,
      stake: stake?.csv,
      stakeMap: stake?.map,
      stakeUnit: unit,
    });
  }, [callings, members, stake, unit, callingsMissing.length, membersMissing.length, stakeMissing.length]);

  const doImport = () => {
    if (!result) return;
    actions.importBaseline(result.baseline);
    onDone(`Imported ${result.report.assignments} callings and ${result.report.members} members.`);
  };

  const r = result?.report;

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
        In LCR, open each report, click <b>Print</b>, and save the PDF. The PDFs are read in this browser only and never uploaded. Keep them in the project's <code>private/</code> folder (or delete them after importing), and never commit them to GitHub.
      </p>

      <FileZone
        title="1. Members with Callings"
        hint="Every ward calling and who holds it. Required."
        loaded={callings}
        onFile={(f) => load(f, CALLING_FIELDS, setCallings)}
      />
      {callings && <Mapping loaded={callings} fields={CALLING_FIELDS} required={CALLING_REQUIRED} onChange={(map) => setCallings({ ...callings, map })} />}

      <FileZone
        title="2. Members without Callings"
        hint="Fills the Available column."
        loaded={members}
        onFile={(f) => load(f, MEMBER_FIELDS, setMembers)}
      />
      {members && <Mapping loaded={members} fields={MEMBER_FIELDS} required={MEMBER_REQUIRED} onChange={(map) => setMembers({ ...members, map })} />}

      <FileZone
        title="3. Stake Callings"
        hint="Ward members serving in the stake. They show on the Stake Callings card instead of Available."
        loaded={stake}
        onFile={(f) => {
          setStakeUnit(undefined);
          load(f, STAKE_FIELDS, setStake);
        }}
      />
      {stake && <Mapping loaded={stake} fields={STAKE_FIELDS} required={STAKE_REQUIRED} onChange={(map) => setStake({ ...stake, map })} />}
      {unitOptions.length > 1 && (
        <label className="field">
          <span>This stake report lists several units. Show stake callings for:</span>
          <select value={unit} onChange={(e) => setStakeUnit(e.target.value)}>
            {unitOptions.map((o) => (
              <option key={o.unit} value={o.unit}>
                {o.unit} ({o.rows} callings{o.known ? `, ${o.known} names match your ward reports` : ''})
              </option>
            ))}
          </select>
        </label>
      )}

      {busy && <div className="note">Reading PDF…</div>}
      {error && <div className="warn">{error}</div>}

      {r && (
        <div className="preview">
          <div className="stats">
            <div className="stat">
              <b>{r.assignments - r.stakeCallings}</b>
              <span>ward callings</span>
            </div>
            {stake && (
              <div className="stat">
                <b>{r.stakeCallings}</b>
                <span>stake callings</span>
              </div>
            )}
            <div className="stat">
              <b>{r.members}</b>
              <span>people</span>
            </div>
            <div className="stat">
              <b>{r.newCallings.length}</b>
              <span>new callings found</span>
            </div>
            {r.skippedRows > 0 && (
              <div className="stat">
                <b>{r.skippedRows}</b>
                <span>rows skipped (no name/calling)</span>
              </div>
            )}
          </div>
          {r.newCallings.length > 0 && (
            <>
              <p className="help" style={{ marginBottom: 0 }}>
                These aren't in the built-in list, so they'll be added to the bottom of their organization. Send this list to whoever maintains the app to sort them in properly:
              </p>
              <ul>
                {r.newCallings.map((c, i) => (
                  <li key={i}>
                    {c.org}: {c.calling}
                  </li>
                ))}
              </ul>
            </>
          )}
          {r.newOrgs.length > 0 && <div className="note">New organizations added: {r.newOrgs.join(', ')}</div>}
          {r.duplicateNames.length > 0 && <div className="note">Two or more members share these names, so callings may attach to the first one: {r.duplicateNames.join('; ')}</div>}
          {r.inBothReports.length > 0 && (
            <div className="note">
              {r.inBothReports.length} {r.inBothReports.length === 1 ? 'person is' : 'people are'} in both "with" and "without" callings (were the reports pulled on different days?). They'll show in their calling:{' '}
              {r.inBothReports.slice(0, 8).join('; ')}
              {r.inBothReports.length > 8 && '…'}
            </div>
          )}
          {!members && <div className="note">No "Members without Callings" report: the Available column will be empty until you add it.</div>}
          {state.baseline?.demo ? (
            <p className="help">The demo data, and any scenarios you made with it, will be cleared.</p>
          ) : (
            state.scenarios.length > 0 && (
              <p className="help">
                Your {state.scenarios.length} scenario{state.scenarios.length > 1 ? 's' : ''} will be kept, with the planned moves re-applied on top of the new data.
              </p>
            )
          )}
        </div>
      )}
    </Dialog>
  );
}

function FileZone({ title, hint, loaded, onFile }: { title: string; hint: string; loaded: Loaded | null; onFile: (f: File) => void }) {
  const [hot, setHot] = useState(false);
  return (
    <div
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
      <span className="help">{loaded ? `✓ ${loaded.fileName}: ${loaded.csv.rows.length} rows` : hint}</span>
      <label className="file-pick">
        {loaded ? 'Choose a different file' : 'Drop the PDF here, or click to choose it'}
        <input
          type="file"
          accept=".pdf,application/pdf,.csv,text/csv"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = '';
          }}
        />
      </label>
    </div>
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

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

  const loadText = (text: string, name: string, fields: Field[], setter: (l: Loaded) => void) => {
    setError(null);
    try {
      const csv = parseCsv(text);
      if (csv.headers.length < 2 || !csv.rows.length) throw new Error('empty');
      setter({ fileName: name, csv, map: matchColumns(csv.headers, fields) });
    } catch {
      setError(`Couldn't find a table in ${name}. Make sure the selection includes the column headings (Name, Calling, …) and at least one row.`);
    }
  };

  const load = async (file: File, fields: Field[], setter: (l: Loaded) => void) => {
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      setError(`"${file.name}" is an Excel file. Open it in Excel and use File → Save As → CSV, or paste the table instead.`);
      return;
    }
    loadText(await file.text(), `"${file.name}"`, fields, setter);
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
        What you paste is read in this browser only. Nothing is uploaded anywhere. If you ever save a copy as a file, keep it in the project's <code>private/</code> folder and never commit it to GitHub.
      </p>

      <FileZone
        title="1. Members with Callings"
        hint="In LCR open Members with Callings, select the whole table (headings included), copy it, and paste here."
        loaded={callings}
        onFile={(f) => load(f, CALLING_FIELDS, setCallings)}
        onText={(t) => loadText(t, 'the pasted table', CALLING_FIELDS, setCallings)}
      />
      {callings && <Mapping loaded={callings} fields={CALLING_FIELDS} required={CALLING_REQUIRED} onChange={(map) => setCallings({ ...callings, map })} />}

      <FileZone
        title="2. Member list (recommended)"
        hint="In LCR open the Member List, select the table, copy, and paste here. Name is required; Gender and Age help. This is how the board knows who doesn't have a calling."
        loaded={members}
        onFile={(f) => load(f, MEMBER_FIELDS, setMembers)}
        onText={(t) => loadText(t, 'the pasted table', MEMBER_FIELDS, setMembers)}
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

function FileZone({
  title,
  hint,
  loaded,
  onFile,
  onText,
}: {
  title: string;
  hint: string;
  loaded: Loaded | null;
  onFile: (f: File) => void;
  onText: (t: string) => void;
}) {
  const [hot, setHot] = useState(false);
  return (
    <div className={`drop ${hot ? 'hot' : ''} ${loaded ? 'done' : ''}`}>
      <strong>{title}</strong>
      <span className="help">{loaded ? `✓ ${loaded.fileName}: ${loaded.csv.rows.length} rows` : hint}</span>
      <textarea
        className="paste"
        rows={2}
        placeholder={loaded ? 'Paste again to replace' : 'Click here and press Ctrl+V'}
        value=""
        onChange={() => {}}
        onPaste={(e) => {
          e.preventDefault();
          const html = e.clipboardData.getData('text/html');
          onText(html ? tableFromHtml(html) ?? e.clipboardData.getData('text/plain') : e.clipboardData.getData('text/plain'));
        }}
      />
      <FilePicker
        onFile={onFile}
        onHot={setHot}
      />
    </div>
  );
}

/**
 * Browsers put copied web tables on the clipboard as HTML too; reading the
 * real <table> is more reliable than the plain-text version (cells with
 * line breaks, hidden icons, etc.).
 */
function tableFromHtml(html: string): string | undefined {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const table = [...doc.querySelectorAll('table')].sort((a, b) => b.rows.length - a.rows.length)[0];
  if (!table || table.rows.length < 2) return undefined;
  const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
  return [...table.rows].map((tr) => [...tr.cells].map((td) => clean(td.textContent ?? '').replace(/\t/g, ' ')).join('\t')).join('\n');
}

function FilePicker({ onFile, onHot }: { onFile: (f: File) => void; onHot: (h: boolean) => void }) {
  return (
    <label
      className="linkbtn file-pick"
      onDragOver={(e) => {
        e.preventDefault();
        onHot(true);
      }}
      onDragLeave={() => onHot(false)}
      onDrop={(e) => {
        e.preventDefault();
        onHot(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
    >
      …or choose / drop a CSV file
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

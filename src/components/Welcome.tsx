import { useBoard } from '../store/useBoardStore';

export function Welcome({ onImport }: { onImport: () => void }) {
  const { actions } = useBoard();
  return (
    <div className="welcome">
      <h2>Ward callings board</h2>
      <p>Every organization and calling in the ward, who holds it, and how long they've served. Plus a planning mode to try out changes before anything happens in LCR.</p>
      <ol>
        <li>
          In LCR, open <b>Organizations → Members with Callings</b> and export it as CSV.
        </li>
        <li>
          Export a <b>member list</b> as CSV (Name, Gender, Age). This is what tells the board who doesn't have a calling.
        </li>
        <li>Click Import and drop both files in.</li>
      </ol>
      <p className="help">Your data stays in this browser. It's never uploaded, and the website itself contains no member information.</p>
      <div className="actions">
        <button className="btn primary" onClick={onImport}>
          Import LCR reports
        </button>
        <button className="btn" onClick={actions.loadDemo}>
          Try it with demo data
        </button>
      </div>
    </div>
  );
}

import { useBoard } from '../store/useBoardStore';

export function Welcome({ onImport }: { onImport: () => void }) {
  const { actions } = useBoard();
  return (
    <div className="welcome">
      <h2>Ward callings board</h2>
      <p>Every organization and calling in the ward, who holds it, and how long they've served. Plus a planning mode to try out changes before anything happens in LCR.</p>
      <ol>
        <li>
          In LCR, print these three reports and save each as a PDF: <b>Members with Callings</b>, <b>Members without Callings</b>, and <b>Stake Callings</b>.
        </li>
        <li>Click Import below and drop each PDF into its box.</li>
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

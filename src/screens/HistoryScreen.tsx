import type { Assessment } from "../storage/db";
import { fmtDate, fmtGrade, fmtRange, rarityOf } from "../ui/format";
import { useObjectUrl } from "../ui/useObjectUrl";

interface Props {
  items: Assessment[];
  onOpen: (id: string) => void;
  onBack: () => void;
  onDeleteAll: () => void;
}

export function HistoryScreen({ items, onOpen, onBack, onDeleteAll }: Props) {
  return (
    <main className="screen history">
      <nav className="topbar">
        <button className="link" onClick={onBack}>
          ‹ Home
        </button>
        <span className="pill">{items.length} saved</span>
      </nav>
      <h2 className="h2">My cards</h2>
      <p className="small dim">Saved on this device only. Opening a saved result costs nothing.</p>
      {items.length === 0 ? (
        <p className="empty">No cards graded yet.</p>
      ) : (
        <ul className="history-list">
          {items.map((a) => (
            <li key={a.id}>
              <HistoryRow a={a} onOpen={() => onOpen(a.id)} />
            </li>
          ))}
        </ul>
      )}
      {items.length > 0 && (
        <button
          className="btn danger-ghost"
          onClick={() => {
            if (confirm("Delete all saved results and photos from this device?")) onDeleteAll();
          }}
        >
          Delete all
        </button>
      )}
    </main>
  );
}

function HistoryRow({ a, onOpen }: { a: Assessment; onOpen: () => void }) {
  const url = useObjectUrl(a.images[0]?.blob);
  const r = a.result.status === "graded" ? rarityOf(a.result.gradeRange) : null;
  return (
    <button className="history-row" onClick={onOpen} data-testid="history-row">
      <span className="history-thumb">{url && <img src={url} alt="" />}</span>
      <span className="history-body">
        <span className="history-name">
          <span className="history-name-text">{a.card.name || "Unknown card"}</span>
          {a.demo && <span className="badge demo">DEMO</span>}
        </span>
        <span className="small dim mono">
          {a.card.number || "–"} · {fmtDate(a.createdAt)}
        </span>
        {a.actual && (
          <span className="small">
            Actual: {a.actual.company} {fmtGrade(a.actual.grade)}
          </span>
        )}
      </span>
      <span className="history-grade">
        <span className="history-stars">{r ? "★".repeat(r.stars) : ""}</span>
        {a.result.status === "graded" ? fmtRange(a.result.gradeRange) : "–"}
      </span>
    </button>
  );
}

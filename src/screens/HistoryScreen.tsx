import type { Assessment } from "../storage/db";
import { fmtDate, fmtGrade, fmtRange } from "../ui/format";
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
          ‹ Start
        </button>
        <span className="mono dim">{items.length} SPARADE</span>
      </nav>
      <h2 className="h2">Historik</h2>
      <p className="small dim">Sparas bara på den här enheten. Att öppna en bedömning kostar inget.</p>
      {items.length === 0 ? (
        <p className="empty">Inga bedömningar ännu.</p>
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
            if (confirm("Radera alla sparade bedömningar och bilder från enheten?")) onDeleteAll();
          }}
        >
          Radera allt
        </button>
      )}
    </main>
  );
}

function HistoryRow({ a, onOpen }: { a: Assessment; onOpen: () => void }) {
  const url = useObjectUrl(a.images[0]?.blob);
  return (
    <button className="history-row" onClick={onOpen} data-testid="history-row">
      <span className="history-thumb">{url && <img src={url} alt="" />}</span>
      <span className="history-body">
        <span className="history-name">
          {a.card.name || "Okänt kort"}
          {a.demo && <span className="badge demo">DEMO</span>}
        </span>
        <span className="small dim mono">
          {a.card.number || "–"} · {fmtDate(a.createdAt)}
        </span>
        {a.actual && (
          <span className="small">
            Faktisk: {a.actual.company} {fmtGrade(a.actual.grade)}
          </span>
        )}
      </span>
      <span className="history-grade">{a.result.status === "graded" ? fmtRange(a.result.gradeRange) : "–"}</span>
    </button>
  );
}

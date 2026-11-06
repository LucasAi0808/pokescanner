import { useEffect, useState } from "react";
import type { PreparedImage } from "../images/prepare";
import { useObjectUrl } from "../ui/useObjectUrl";

const STEPS = ["Centrering", "Hörn", "Kanter", "Yta", "Kortuppgifter"];

export function AnalyzingScreen({ front, label, onCancel }: { front?: PreparedImage; label: string; onCancel: () => void }) {
  const url = useObjectUrl(front?.blob);
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const active = Math.min(STEPS.length - 1, Math.floor(sec / 6));

  return (
    <main className="screen analyzing" aria-busy="true">
      <div className="scan">
        {url && <img src={url} alt="" />}
        <div className="scanline" />
        <span className="corner tl" />
        <span className="corner tr" />
        <span className="corner bl" />
        <span className="corner br" />
      </div>
      <h2 className="h2">Analyserar…</h2>
      <p className="dim">{label}</p>
      <ul className="checklist mono">
        {STEPS.map((s, i) => (
          <li key={s} className={i < active ? "done" : i === active ? "now" : ""}>
            {s}
          </li>
        ))}
      </ul>
      <p className="mono dim">{sec} s</p>
      <p className="small dim">Det tar oftast mellan 20 sekunder och någon minut.</p>
      <button className="btn" onClick={onCancel} data-testid="cancel">
        Avbryt
      </button>
    </main>
  );
}

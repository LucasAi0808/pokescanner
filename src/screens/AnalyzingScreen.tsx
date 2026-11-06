import { useEffect, useState } from "react";
import type { PreparedImage } from "../images/prepare";
import { EnergyIcon, type Energy } from "../ui/EnergyIcon";
import { useObjectUrl } from "../ui/useObjectUrl";

const STEPS: { label: string; energy: Energy }[] = [
  { label: "Centering", energy: "psychic" },
  { label: "Corners", energy: "fire" },
  { label: "Edges", energy: "electric" },
  { label: "Surface", energy: "water" },
];

export function AnalyzingScreen({ front, label, onCancel }: { front?: PreparedImage; label: string; onCancel: () => void }) {
  const url = useObjectUrl(front?.blob);
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const active = Math.min(STEPS.length, Math.floor(sec / 6));

  return (
    <main className="screen analyzing" aria-busy="true">
      <div className="scan">
        {url && <img src={url} alt="" />}
        <div className="scanline" />
      </div>
      <h2 className="h2">Analyzing…</h2>
      <p className="dim">{label}</p>
      <ul className="checklist">
        {STEPS.map((s, i) => (
          <li key={s.label} className={i < active ? "done" : i === active ? "now" : ""}>
            <EnergyIcon type={s.energy} size={30} />
            <span>{s.label}</span>
            <span className="check-mark">{i < active ? "✓" : ""}</span>
          </li>
        ))}
      </ul>
      <p className="mono dim">{sec}s</p>
      <p className="small dim">This usually takes between 20 seconds and a minute.</p>
      <button className="btn" onClick={onCancel} data-testid="cancel">
        Cancel
      </button>
    </main>
  );
}

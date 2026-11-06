import { useRef, useState } from "react";
import { SLOT_LABELS, type ImageSlot } from "../grading/types";
import type { PreparedImage } from "../images/prepare";
import { formatAxis } from "../quality/centering";
import { CardGuide } from "../ui/CardGuide";
import { useObjectUrl } from "../ui/useObjectUrl";

const REQUIRED: ImageSlot[] = ["front", "back"];
const EXTRA: ImageSlot[] = ["closeup", "raking"];

const SLOT_HELP: Record<ImageSlot, string> = {
  front: "Hela framsidan, rakt ovanifrån.",
  back: "Hela baksidan, rakt ovanifrån.",
  closeup: "Gå nära ett hörn, en kant eller något du är osäker på.",
  raking: "Låt ljuset falla snett över ytan så att repor och bucklor syns.",
};

interface Props {
  images: Partial<Record<ImageSlot, PreparedImage>>;
  busy: Partial<Record<ImageSlot, boolean>>;
  demo: boolean;
  error: string | null;
  notice: string | null;
  onFile: (slot: ImageSlot, file: File) => void;
  onRemove: (slot: ImageSlot) => void;
  onAnalyze: () => void;
  onBack: () => void;
  onDismissError: () => void;
}

export function CaptureScreen(p: Props) {
  const [showGuide, setShowGuide] = useState(!p.images.front && !p.demo);
  const [showExtra, setShowExtra] = useState(Boolean(p.images.closeup || p.images.raking));
  const ready = REQUIRED.every((s) => p.images[s]);
  const anyBusy = Object.values(p.busy).some(Boolean);
  const warnings = Object.values(p.images).reduce(
    (n, img) => n + (img?.quality.issues.filter((i) => i.level === "warn").length ?? 0),
    0,
  );
  const missing = REQUIRED.filter((s) => !p.images[s]).map((s) => SLOT_LABELS[s].toLowerCase());

  return (
    <main className="screen capture">
      <nav className="topbar">
        <button className="link" onClick={p.onBack}>
          ‹ Start
        </button>
        <span className="mono dim">{p.demo ? "DEMOLÄGE" : "GRADERA KORT"}</span>
      </nav>

      <h2 className="h2">Bilder</h2>
      {p.demo && (
        <p className="notice info">
          Demoläge: exempelbilder på ett fiktivt kort är redan ifyllda. Ingen bild skickas någonstans och resultatet är
          förskrivet.
        </p>
      )}
      {p.notice && <p className="notice info">{p.notice}</p>}
      {p.error && (
        <div className="notice error" role="alert">
          <p>{p.error}</p>
          <button className="link" onClick={p.onDismissError}>
            Stäng
          </button>
        </div>
      )}

      <button className="guide-toggle" onClick={() => setShowGuide((v) => !v)} aria-expanded={showGuide}>
        {showGuide ? "Dölj" : "Visa"} hur du placerar kortet
      </button>
      {showGuide && <CardGuide />}

      <div className="slots">
        {REQUIRED.map((s) => (
          <SlotCard key={s} slot={s} required image={p.images[s]} busy={!!p.busy[s]} onFile={p.onFile} onRemove={p.onRemove} />
        ))}
      </div>

      {showExtra ? (
        <>
          <h3 className="h3">Extra bilder (valfritt)</h3>
          <div className="slots">
            {EXTRA.map((s) => (
              <SlotCard key={s} slot={s} image={p.images[s]} busy={!!p.busy[s]} onFile={p.onFile} onRemove={p.onRemove} />
            ))}
          </div>
        </>
      ) : (
        <button className="btn ghost" onClick={() => setShowExtra(true)}>
          + Lägg till närbild eller bild i snett ljus
        </button>
      )}

      <div className="sticky-bar">
        <p className="bar-status">
          {!ready
            ? `Lägg till ${missing.join(" och ")} för att fortsätta.`
            : warnings > 0
              ? `${warnings} ${warnings === 1 ? "varning" : "varningar"} på bilderna. Du kan ta om eller analysera ändå.`
              : "Bilderna ser bra ut."}
        </p>
        <button className="btn primary" disabled={!ready || anyBusy} onClick={p.onAnalyze}>
          {warnings > 0 && ready ? "Analysera ändå" : "Analysera"}
        </button>
      </div>
    </main>
  );
}

interface SlotProps {
  slot: ImageSlot;
  required?: boolean;
  image?: PreparedImage;
  busy: boolean;
  onFile: (slot: ImageSlot, file: File) => void;
  onRemove: (slot: ImageSlot) => void;
}

function SlotCard({ slot, required, image, busy, onFile, onRemove }: SlotProps) {
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const url = useObjectUrl(image?.blob);
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFile(slot, f);
    e.target.value = "";
  };
  const q = image?.quality;
  const c = q?.centering;
  const lr = formatAxis(c?.leftRight ?? null);
  const tb = formatAxis(c?.topBottom ?? null);

  return (
    <section className={`slot${image ? " has-image" : ""}`} data-testid={`slot-${slot}`}>
      <header className="slot-head">
        <h3>
          {SLOT_LABELS[slot]}
          {required && <span className="req">krävs</span>}
        </h3>
        <p className="dim small">{SLOT_HELP[slot]}</p>
      </header>

      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={pick} data-testid={`camera-${slot}`} />
      <input ref={library} type="file" accept="image/*" hidden onChange={pick} data-testid={`file-${slot}`} />

      {busy ? (
        <div className="slot-busy">
          <span className="spinner" /> Kontrollerar bilden…
        </div>
      ) : image && url ? (
        <div className="slot-body">
          <div className="thumb">
            <img src={url} alt={`${SLOT_LABELS[slot]}, förhandsvisning`} />
            {q?.card && (
              <svg className="thumb-outline" viewBox={`0 0 ${q.width} ${q.height}`} preserveAspectRatio="none">
                <polygon
                  points={[q.card.corners.tl, q.card.corners.tr, q.card.corners.br, q.card.corners.bl]
                    .map((pt) => `${pt.x},${pt.y}`)
                    .join(" ")}
                />
              </svg>
            )}
          </div>
          <div className="slot-info">
            {q && q.issues.length === 0 && <p className="ok small">✓ Bilden ser bra ut.</p>}
            {q?.issues.map((i) => (
              <div key={i.code} className={`issue ${i.level}`} data-testid={`issue-${slot}-${i.code}`}>
                <p className="issue-msg">{i.message}</p>
                <p className="issue-advice">{i.advice}</p>
              </div>
            ))}
            {(slot === "front" || slot === "back") && (
              <p className="mono small centering-line">
                Centrering:{" "}
                {lr || tb ? (
                  <>
                    {lr && <>V/H {lr}</>} {tb && <>Ö/N {tb}</>}
                  </>
                ) : (
                  <span className="dim">kunde inte mätas</span>
                )}
              </p>
            )}
            <div className="row">
              <button className="btn small" onClick={() => camera.current?.click()}>
                Ta om
              </button>
              <button className="btn small" onClick={() => library.current?.click()}>
                Byt bild
              </button>
              <button className="btn small danger-ghost" onClick={() => onRemove(slot)}>
                Ta bort
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="row">
          <button className="btn" onClick={() => camera.current?.click()}>
            Ta foto
          </button>
          <button className="btn ghost" onClick={() => library.current?.click()}>
            Välj bild
          </button>
        </div>
      )}
    </section>
  );
}

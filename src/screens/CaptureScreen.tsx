import { useRef, useState } from "react";
import { SLOT_LABELS, type ImageSlot } from "../grading/types";
import type { PreparedImage } from "../images/prepare";
import { formatAxis } from "../quality/centering";
import { CardGuide } from "../ui/CardGuide";
import { useObjectUrl } from "../ui/useObjectUrl";

const REQUIRED: ImageSlot[] = ["front", "back"];
const EXTRA: ImageSlot[] = ["closeup", "raking"];

const SLOT_HELP: Record<ImageSlot, string> = {
  front: "The whole front, straight from above.",
  back: "The whole back, straight from above.",
  closeup: "Get close to a corner, an edge or anything you are unsure about.",
  raking: "Let the light fall across the surface at an angle so scratches and dents show.",
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
          ‹ Home
        </button>
        <span className="pill">{p.demo ? "Demo mode" : "Grade a card"}</span>
      </nav>

      <h2 className="h2">Your photos</h2>
      {p.demo && (
        <p className="notice info">
          Demo mode: example photos of a fictional card are already filled in. Nothing is sent anywhere and the result is
          pre-written.
        </p>
      )}
      {p.notice && <p className="notice info">{p.notice}</p>}
      {p.error && (
        <div className="notice error" role="alert">
          <p>{p.error}</p>
          <button className="link" onClick={p.onDismissError}>
            Close
          </button>
        </div>
      )}

      <button className="guide-toggle" onClick={() => setShowGuide((v) => !v)} aria-expanded={showGuide}>
        {showGuide ? "Hide" : "Show"} how to position the card
      </button>
      {showGuide && <CardGuide />}

      <div className="slots">
        {REQUIRED.map((s) => (
          <SlotCard key={s} slot={s} required image={p.images[s]} busy={!!p.busy[s]} onFile={p.onFile} onRemove={p.onRemove} />
        ))}
      </div>

      {showExtra ? (
        <>
          <h3 className="h3">Extra photos (optional)</h3>
          <div className="slots">
            {EXTRA.map((s) => (
              <SlotCard key={s} slot={s} image={p.images[s]} busy={!!p.busy[s]} onFile={p.onFile} onRemove={p.onRemove} />
            ))}
          </div>
        </>
      ) : (
        <button className="btn ghost" onClick={() => setShowExtra(true)}>
          + Add a close-up or angled-light photo
        </button>
      )}

      <div className="sticky-bar">
        <p className="bar-status">
          {!ready
            ? `Add the ${missing.join(" and ")} to continue.`
            : warnings > 0
              ? `${warnings} ${warnings === 1 ? "warning" : "warnings"} on your photos. Retake or analyze anyway.`
              : "Your photos look good."}
        </p>
        <button className="btn primary" disabled={!ready || anyBusy} onClick={p.onAnalyze}>
          {warnings > 0 && ready ? "Analyze anyway" : "Analyze"}
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
          {required && <span className="req">required</span>}
        </h3>
        <p className="dim small">{SLOT_HELP[slot]}</p>
      </header>

      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={pick} data-testid={`camera-${slot}`} />
      <input ref={library} type="file" accept="image/*" hidden onChange={pick} data-testid={`file-${slot}`} />

      {busy ? (
        <div className="slot-busy">
          <span className="spinner" /> Checking the photo…
        </div>
      ) : image && url ? (
        <div className="slot-body">
          <div className="thumb">
            <img src={url} alt={`${SLOT_LABELS[slot]} preview`} />
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
            {q && q.issues.length === 0 && <p className="ok small">✓ Looks good.</p>}
            {q?.issues.map((i) => (
              <div key={i.code} className={`issue ${i.level}`} data-testid={`issue-${slot}-${i.code}`}>
                <p className="issue-msg">{i.message}</p>
                <p className="issue-advice">{i.advice}</p>
              </div>
            ))}
            {(slot === "front" || slot === "back") && (
              <p className="mono small centering-line">
                Centering:{" "}
                {lr || tb ? (
                  <>
                    {lr && <>L/R {lr}</>} {tb && <>T/B {tb}</>}
                  </>
                ) : (
                  <span className="dim">could not be measured</span>
                )}
              </p>
            )}
            <div className="row">
              <button className="btn small" onClick={() => camera.current?.click()}>
                Retake
              </button>
              <button className="btn small" onClick={() => library.current?.click()}>
                Replace
              </button>
              <button className="btn small danger-ghost" onClick={() => onRemove(slot)}>
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="row">
          <button className="btn primary" onClick={() => camera.current?.click()}>
            Take photo
          </button>
          <button className="btn" onClick={() => library.current?.click()}>
            Choose photo
          </button>
        </div>
      )}
    </section>
  );
}

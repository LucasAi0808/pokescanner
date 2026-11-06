import { useMemo, useRef, useState } from "react";
import { FINDING_KINDS, LANGUAGES, SLOT_LABELS, type CardIdentity, type CardLanguage, type ImageSlot } from "../grading/types";
import { ANTHROPIC_MODELS } from "../grading/provider";
import { formatAxis } from "../quality/centering";
import type { ActualGrade, Assessment } from "../storage/db";
import { EnergyIcon, SUBGRADE_ENERGY } from "../ui/EnergyIcon";
import { CONFIDENCE_LABEL, KIND_GROUP, KIND_LABEL, SEVERITY_LABEL, fmtDate, fmtGrade, fmtRange, fmtUsd } from "../ui/format";
import { ImageViewer } from "../ui/ImageViewer";
import { RarityBadge } from "../ui/RarityBadge";

interface Props {
  assessment: Assessment;
  saved: boolean;
  onBack: () => void;
  backLabel: string;
  onNew: () => void;
  onRetake: () => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<Pick<Assessment, "card" | "actual">>) => Promise<void>;
}

const SUBGRADE_LABELS = { centering: "Centering", corners: "Corners", edges: "Edges", surface: "Surface" } as const;
const COMPANIES = ["PSA", "BGS", "CGC", "TAG", "ACE", "Other"];

export function ResultScreen({ assessment: a, saved, onBack, backLabel, onNew, onRetake, onDelete, onUpdate }: Props) {
  const r = a.result;
  const [slot, setSlot] = useState<ImageSlot>(a.images[0]?.slot ?? "front");
  const [focus, setFocus] = useState<{ id: string | null; n: number }>({ id: null, n: 0 });
  const viewerRef = useRef<HTMLDivElement>(null);

  const ordered = useMemo(() => FINDING_KINDS.flatMap((k) => r.findings.filter((f) => f.kind === k)), [r.findings]);
  const numbers = useMemo(() => new Map(ordered.map((f, i) => [f.id, i + 1])), [ordered]);

  const goTo = (id: string, image: ImageSlot) => {
    setSlot(image);
    setFocus((f) => ({ id, n: f.n + 1 }));
    viewerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const front = a.images.find((i) => i.slot === "front");
  const back = a.images.find((i) => i.slot === "back");
  const modelLabel = ANTHROPIC_MODELS.find((m) => a.model.startsWith(m.id))?.label ?? a.model;

  return (
    <main className="screen result">
      <nav className="topbar">
        <button className="link" onClick={onBack}>
          ‹ {backLabel}
        </button>
        {a.demo ? <span className="badge demo">DEMO</span> : <span className="pill">{saved ? "Saved on device" : "Not saved"}</span>}
      </nav>

      {a.demo && (
        <p className="notice info" data-testid="demo-banner">
          This is a pre-written example result for a fictional card. No AI looked at the photos.
        </p>
      )}

      <section className="verdict" data-testid="verdict">
        <p className="eyebrow">Unofficial pre-assessment</p>
        <RarityBadge range={r.status === "graded" ? r.gradeRange : null} />
        {r.status === "graded" ? (
          <p className="grade-note dim small">An estimated range, not an official grade and not a probability.</p>
        ) : (
          <p className="abstain-reason">{r.abstainReason}</p>
        )}
        {r.summary && <p className="summary">{r.summary}</p>}
      </section>

      <div ref={viewerRef} className="viewer-anchor">
        <ImageViewer
          images={a.images}
          findings={r.findings}
          numbers={numbers}
          activeSlot={slot}
          onSlotChange={(s) => {
            setSlot(s);
            setFocus((f) => ({ id: null, n: f.n }));
          }}
          focusId={focus.id}
          focusNonce={focus.n}
        />
      </div>

      {FINDING_KINDS.map((k) => {
        const list = ordered.filter((f) => f.kind === k);
        if (!list.length) return null;
        return (
          <section key={k} className="findings">
            <h3 className={`h3 kind-title kind-${k}`}>{KIND_GROUP[k]}</h3>
            <ul>
              {list.map((f) => (
                <li key={f.id}>
                  <button
                    className={`finding kind-${f.kind}${focus.id === f.id ? " is-focus" : ""}`}
                    onClick={() => goTo(f.id, f.image)}
                    data-testid={`finding-${f.id}`}
                  >
                    <span className="finding-num">{numbers.get(f.id)}</span>
                    <span className="finding-body">
                      <span className="finding-title">{f.title}</span>
                      <span className="finding-meta small">
                        <span className={`chip kind-${f.kind}`}>{KIND_LABEL[f.kind]}</span>
                        {SLOT_LABELS[f.image]} · {f.location}
                        {f.kind === "defect" && <> · {SEVERITY_LABEL[f.severity]}</>}
                      </span>
                      {f.description && <span className="finding-desc small">{f.description}</span>}
                      {!f.box && <span className="small dim">No exact spot given.</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {r.findings.length === 0 && <p className="dim">No specific findings were reported.</p>}

      <section>
        <h3 className="h3">Subgrades</h3>
        <div className="subgrades">
          {(Object.keys(SUBGRADE_LABELS) as (keyof typeof SUBGRADE_LABELS)[]).map((k) => {
            const s = r.subgrades[k];
            const energy = SUBGRADE_ENERGY[k];
            return (
              <article key={k} className={`subgrade energy-card-${energy}`}>
                <header>
                  <EnergyIcon type={energy} />
                  <span className="sub-label">{SUBGRADE_LABELS[k]}</span>
                  <span className="sub-range">{s.range ? fmtRange(s.range) : "–"}</span>
                </header>
                {k === "centering" && (
                  <div className="measured mono small" data-testid="centering-measured">
                    {[front, back].map((img) => {
                      if (!img) return null;
                      const c = img.quality.centering;
                      const lr = formatAxis(c.leftRight);
                      const tb = formatAxis(c.topBottom);
                      return (
                        <p key={img.slot}>
                          {SLOT_LABELS[img.slot]}:{" "}
                          {lr || tb ? (
                            <>
                              {lr && <>L/R {lr} </>}
                              {tb && <>T/B {tb}</>}
                            </>
                          ) : (
                            <span className="dim">not measured{c.note ? ` (${c.note.replace(/\.$/, "")})` : ""}</span>
                          )}
                        </p>
                      );
                    })}
                    <p className="dim">Measured on your phone. Only shown when the measurement was reliable.</p>
                  </div>
                )}
                <p className="small">{s.assessment}</p>
                <p className="small dim">{CONFIDENCE_LABEL[s.confidence]}</p>
              </article>
            );
          })}
        </div>
      </section>

      {r.hardToAssess.length > 0 && (
        <section>
          <h3 className="h3">Hard to judge from photos</h3>
          <ul className="plain">
            {r.hardToAssess.map((h, i) => (
              <li key={i}>
                <strong>{h.aspect}.</strong> {h.reason}
              </li>
            ))}
          </ul>
        </section>
      )}

      {r.imageIssues.length > 0 && (
        <section>
          <h3 className="h3">Photos to retake</h3>
          <ul className="plain">
            {r.imageIssues.map((h, i) => (
              <li key={i} className="issue warn">
                <p className="issue-msg">
                  {h.image ? `${SLOT_LABELS[h.image]}: ` : ""}
                  {h.problem}
                </p>
                <p className="issue-advice">{h.advice}</p>
              </li>
            ))}
          </ul>
          <button className="btn" onClick={onRetake}>
            Retake photos
          </button>
        </section>
      )}

      <CardEditor card={a.card} onSave={(card) => onUpdate({ card })} />
      <ActualGradeForm actual={a.actual} range={r.gradeRange} onSave={(actual) => onUpdate({ actual })} />

      <section className="meta mono small">
        <p>{fmtDate(a.createdAt)}</p>
        <p>
          {a.demo ? "Demo mode, no model" : `Model: ${modelLabel}${a.servedBy && !a.servedBy.startsWith(a.model) ? ` (answered by: ${a.servedBy})` : ""}`}
        </p>
        {a.usage && (
          <p>
            {a.usage.inputTokens.toLocaleString("en-US")} tokens in · {a.usage.outputTokens.toLocaleString("en-US")} out
            {a.costUsd != null && <> · ≈ {fmtUsd(a.costUsd)} at list price</>}
          </p>
        )}
        <p className="dim">Opening a saved result makes no new requests.</p>
      </section>

      <div className="row stack-sm">
        <button className="btn primary" onClick={onNew}>
          Grade another card
        </button>
        {r.imageIssues.length === 0 && (
          <button className="btn" onClick={onRetake}>
            Retake photos
          </button>
        )}
        {saved && (
          <button
            className="btn danger-ghost"
            onClick={() => {
              if (confirm("Delete this result and its photos from your device?")) onDelete();
            }}
            data-testid="delete"
          >
            Delete result
          </button>
        )}
      </div>

      <footer className="fineprint">
        <p>
          This assessment is based on photos and can miss things you only notice in hand or under a loupe: micro scratches,
          print dots, bending, thickness and authenticity. It does not replace a real grading.
        </p>
      </footer>
    </main>
  );
}

function CardEditor({ card, onSave }: { card: CardIdentity; onSave: (c: CardIdentity) => Promise<void> }) {
  const [c, setC] = useState(card);
  const [state, setState] = useState<"idle" | "saved">("idle");
  const set = (patch: Partial<CardIdentity>) => {
    setC((x) => ({ ...x, ...patch }));
    setState("idle");
  };
  return (
    <section className="form-block">
      <h3 className="h3">The card</h3>
      <p className="small dim">Read from the photo ({CONFIDENCE_LABEL[card.confidence]}). Fix anything that is wrong. Unknown cards are fine too.</p>
      <div className="grid2">
        <label>
          <span className="label">Name</span>
          <input className="input" value={c.name} onChange={(e) => set({ name: e.target.value })} placeholder="Unknown" data-testid="card-name" />
        </label>
        <label>
          <span className="label">Number</span>
          <input className="input mono" value={c.number} onChange={(e) => set({ number: e.target.value })} placeholder="e.g. 025/165" />
        </label>
        <label>
          <span className="label">Set</span>
          <input className="input" value={c.setName} onChange={(e) => set({ setName: e.target.value })} placeholder="Unknown" />
        </label>
        <label>
          <span className="label">Language</span>
          <select className="input" value={c.language} onChange={(e) => set({ language: e.target.value as CardLanguage })}>
            {(Object.keys(LANGUAGES) as CardLanguage[]).map((l) => (
              <option key={l} value={l}>
                {LANGUAGES[l]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        className="btn small"
        onClick={async () => {
          await onSave(c);
          setState("saved");
        }}
        data-testid="save-card"
      >
        {state === "saved" ? "✓ Saved" : "Save details"}
      </button>
    </section>
  );
}

function ActualGradeForm({
  actual,
  range,
  onSave,
}: {
  actual: ActualGrade | null;
  range: { low: number; high: number } | null;
  onSave: (a: ActualGrade | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [company, setCompany] = useState(actual?.company ?? "PSA");
  const [grade, setGrade] = useState(actual ? String(actual.grade) : "");
  const [date, setDate] = useState(actual?.date ?? "");
  const g = Number(grade.replace(",", "."));
  const valid = grade !== "" && g >= 1 && g <= 10 && Math.round(g * 2) === g * 2;

  const verdict = (a: ActualGrade) => {
    if (!range) return "No estimate to compare with.";
    if (a.grade < range.low) return `${fmtGrade(range.low - a.grade)} below the estimate.`;
    if (a.grade > range.high) return `${fmtGrade(a.grade - range.high)} above the estimate.`;
    return "Within the estimate.";
  };

  return (
    <section className="form-block">
      <h3 className="h3">Actual grade</h3>
      {actual && !open ? (
        <div className="actual" data-testid="actual">
          <p className="actual-grade">
            {actual.company} <strong>{fmtGrade(actual.grade)}</strong>
            {actual.date && <span className="dim small"> · {actual.date}</span>}
          </p>
          <p className="small">
            Estimated {fmtRange(range)}. {verdict(actual)}
          </p>
          <div className="row">
            <button className="btn small" onClick={() => setOpen(true)}>
              Edit
            </button>
            <button className="btn small danger-ghost" onClick={() => onSave(null)}>
              Remove
            </button>
          </div>
        </div>
      ) : open ? (
        <form
          className="grid2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!valid) return;
            await onSave({ company, grade: g, date });
            setOpen(false);
          }}
        >
          <label>
            <span className="label">Company</span>
            <select className="input" value={company} onChange={(e) => setCompany(e.target.value)}>
              {COMPANIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Grade (1–10)</span>
            <input
              className="input mono"
              inputMode="decimal"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="e.g. 8 or 8.5"
              data-testid="actual-grade"
            />
          </label>
          <label>
            <span className="label">Date (optional)</span>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <div className="row end span2">
            <button type="button" className="btn ghost small" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn small primary" disabled={!valid} data-testid="actual-save">
              Save
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="small dim">If you send the card in later, add the real grade here and compare it with the estimate.</p>
          <button className="btn small" onClick={() => setOpen(true)} data-testid="actual-add">
            Add actual grade
          </button>
        </>
      )}
    </section>
  );
}

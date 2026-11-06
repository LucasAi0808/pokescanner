import { useEffect, useState } from "react";
import type { GradingResult } from "../grading/types";
import { Logo } from "./Logo";
import { RarityBadge } from "./RarityBadge";

/**
 * A fresh result opens like a booster pack: tap to tear it open and the grade
 * comes out as a rarity card. Only shown right after an analysis, never when a
 * saved result is reopened. Can always be skipped.
 */
export function BoosterReveal({ result, demo, onDone }: { result: GradingResult; demo: boolean; onDone: () => void }) {
  const reduced =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [stage, setStage] = useState<"sealed" | "opening" | "revealed">(reduced ? "revealed" : "sealed");

  useEffect(() => {
    if (stage !== "opening") return;
    const t = setTimeout(() => setStage("revealed"), 900);
    return () => clearTimeout(t);
  }, [stage]);

  return (
    <div className={`booster stage-${stage}`} role="dialog" aria-modal="true" aria-label="Your result" data-testid="booster">
      <div className="booster-rays" aria-hidden="true" />
      <button className="booster-skip" onClick={onDone} data-testid="booster-skip">
        Skip
      </button>

      {stage !== "revealed" ? (
        <button
          className="pack"
          onClick={() => setStage("opening")}
          disabled={stage === "opening"}
          aria-label="Tap to open your grade pack"
          data-testid="booster-open"
        >
          <span className="pack-top" aria-hidden="true">
            <span className="pack-crimp" />
          </span>
          <span className="pack-body">
            <span className="pack-shine" aria-hidden="true" />
            <Logo size={64} />
            <span className="pack-title">Grade Pack</span>
            <span className="pack-sub">{demo ? "Demo edition" : "1 card inside"}</span>
          </span>
          <span className="pack-crimp bottom" aria-hidden="true" />
        </button>
      ) : (
        <div className="booster-card">
          <RarityBadge range={result.gradeRange} />
          <p className="booster-note">Unofficial pre-assessment{demo ? " · demo" : ""}</p>
          <button className="btn primary big" onClick={onDone} data-testid="booster-continue">
            See what pulls it down
          </button>
        </div>
      )}

      {stage === "sealed" && <p className="booster-hint">Tap the pack to open it</p>}
    </div>
  );
}

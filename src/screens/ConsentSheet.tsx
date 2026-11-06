import { useState } from "react";
import { ANTHROPIC_MODELS, estimateCost, type GradingProvider } from "../grading/provider";
import { fmtUsd } from "../ui/format";

interface Props {
  provider: GradingProvider;
  images: { width: number; height: number }[];
  model: string;
  hasKey: boolean;
  onModel: (m: string) => void;
  onConfirm: (key: string | null) => void;
  onCancel: () => void;
}

export function ConsentSheet({ provider, images, model, hasKey, onModel, onConfirm, onCancel }: Props) {
  const [key, setKey] = useState("");
  const [understood, setUnderstood] = useState(false);
  const m = ANTHROPIC_MODELS.find((x) => x.id === model) ?? ANTHROPIC_MODELS[0]!;
  const est = estimateCost(images, m);
  const keyOk = hasKey || /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key.trim());
  const looksWrong = key.trim().length > 0 && !keyOk;

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="consent-title">
      <form
        className="sheet"
        onSubmit={(e) => {
          e.preventDefault();
          if (keyOk && understood) onConfirm(hasKey && !key ? null : key.trim());
        }}
      >
        <div className="sheet-grip" />
        <h2 id="consent-title" className="h2">
          Before the analysis
        </h2>

        <dl className="facts">
          <div>
            <dt>Your photos go to</dt>
            <dd>
              {provider.recipient}, model <strong>{m.label}</strong>
            </dd>
          </div>
          <div>
            <dt>What is sent</dt>
            <dd>
              {images.length} photos, downscaled and without location data (EXIF), plus the grading instructions. Nothing else.
            </dd>
          </div>
          <div>
            <dt>Cost</dt>
            <dd>
              {provider.costNote} Estimate for this analysis: about <strong>{fmtUsd(est.usd)}</strong> (
              {(est.inputTokens / 1000).toFixed(1)}k tokens in, up to ~{Math.round(est.outputTokens / 1000)}k out).
            </dd>
          </div>
        </dl>

        <fieldset className="models">
          <legend className="label">Model</legend>
          {ANTHROPIC_MODELS.map((x) => (
            <label key={x.id} className={`model${x.id === model ? " is-on" : ""}`}>
              <input type="radio" name="model" value={x.id} checked={x.id === model} onChange={() => onModel(x.id)} />
              <span>
                <strong>{x.label}</strong>
                <span className="dim small"> {x.note}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <label className="label" htmlFor="apikey">
          Your Anthropic API key
        </label>
        {hasKey && <p className="small ok">A key is already in memory for this tab. Leave the field empty to use it.</p>}
        <input
          id="apikey"
          className="input mono"
          type="password"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="sk-ant-…"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          data-testid="api-key"
        />
        {looksWrong && <p className="small warn-text">That does not look like an Anthropic key (it starts with sk-ant-).</p>}
        <p className="small dim">
          The key only lives in memory while this page is open. It is not stored, not logged and never saved with your
          results. Create a key at console.anthropic.com.
        </p>

        <label className="check">
          <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} data-testid="consent-check" />
          <span>I understand that my photos are sent to {provider.label} and that Anthropic may charge me for the request.</span>
        </label>

        <div className="row end">
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={!keyOk || !understood}>
            Analyze
          </button>
        </div>
      </form>
    </div>
  );
}

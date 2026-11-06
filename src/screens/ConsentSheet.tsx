import { useState } from "react";
import { ANTHROPIC_MODELS, estimateCost, type GradingProvider } from "../grading/provider";
import { fmtSek } from "../ui/format";

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
          Innan analysen
        </h2>

        <dl className="facts">
          <div>
            <dt>Bilderna skickas till</dt>
            <dd>
              {provider.recipient}, modell <strong>{m.label}</strong>
            </dd>
          </div>
          <div>
            <dt>Vad skickas</dt>
            <dd>
              {images.length} bilder, nedskalade och utan platsdata (EXIF), samt instruktionerna för bedömningen. Inget annat.
            </dd>
          </div>
          <div>
            <dt>Kostnad</dt>
            <dd>
              {provider.costNote} Uppskattning för den här analysen: ungefär <strong>{fmtSek(est.sek)}</strong> (
              {(est.inputTokens / 1000).toFixed(1).replace(".", ",")}k tokens in, upp till ~{Math.round(est.outputTokens / 1000)}k ut).
            </dd>
          </div>
        </dl>

        <fieldset className="models">
          <legend className="label">Modell</legend>
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
          Din Anthropic API-nyckel
        </label>
        {hasKey && <p className="small ok">En nyckel finns redan i minnet för den här fliken. Lämna fältet tomt för att använda den.</p>}
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
        {looksWrong && <p className="small warn-text">Det ser inte ut som en Anthropic-nyckel (den börjar med sk-ant-).</p>}
        <p className="small dim">
          Nyckeln ligger bara i minnet så länge sidan är öppen. Den sparas inte, loggas inte och följer inte med resultatet.
          Skapa en nyckel på console.anthropic.com.
        </p>

        <label className="check">
          <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} data-testid="consent-check" />
          <span>Jag förstår att bilderna skickas till {provider.label} och att Anthropic kan ta betalt för anropet.</span>
        </label>

        <div className="row end">
          <button type="button" className="btn ghost" onClick={onCancel}>
            Avbryt
          </button>
          <button type="submit" className="btn primary" disabled={!keyOk || !understood}>
            Analysera
          </button>
        </div>
      </form>
    </div>
  );
}

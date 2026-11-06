interface Props {
  onGrade: () => void;
  onDemo: () => void;
  onHistory: () => void;
  historyCount: number;
  storageError: boolean;
}

export function StartScreen({ onGrade, onDemo, onHistory, historyCount, storageError }: Props) {
  return (
    <main className="screen start">
      <header className="hero">
        <div className="logo" aria-hidden="true">
          <span className="corner tl" />
          <span className="corner tr" />
          <span className="corner bl" />
          <span className="corner br" />
          <span className="logo-mark">PS</span>
        </div>
        <p className="eyebrow">Inofficiell förhandsbedömning av samlarkort</p>
        <h1 className="title">
          Poke<em>Scanner</em>
        </h1>
        <p className="lede">Fota kortet och få veta vilken grade som verkar rimlig, och exakt vad på kortet som drar ner den.</p>
      </header>

      <div className="actions stack">
        <button className="btn primary big" onClick={onGrade}>
          Gradera kort
        </button>
        <button className="btn ghost" onClick={onDemo}>
          Prova demo utan nyckel
        </button>
        <button className="btn ghost" onClick={onHistory}>
          Historik{historyCount > 0 ? ` (${historyCount})` : ""}
        </button>
      </div>

      {storageError && (
        <p className="notice warn">
          Den här webbläsaren tillåter inte lokal lagring (t.ex. privat läge). Analyser fungerar, men historiken sparas inte.
        </p>
      )}

      <ol className="steps">
        <li>
          <span className="step-n mono">01</span>
          <span>Fota fram- och baksida. Lägg till närbild eller snett ljus vid behov.</span>
        </li>
        <li>
          <span className="step-n mono">02</span>
          <span>Appen kontrollerar bilderna lokalt: blänk, skärpa, hörn och centrering.</span>
        </li>
        <li>
          <span className="step-n mono">03</span>
          <span>Tryck Analysera. Först då skickas bilderna till AI-leverantören du valt.</span>
        </li>
      </ol>

      <footer className="fineprint">
        <p>
          Gratis och öppen källkod. Inget konto. Din API-nyckel ligger bara i minnet medan sidan är öppen. Bedömningar sparas
          lokalt på enheten.
        </p>
        <p>
          PokeScanner är ett inofficiellt projekt och har ingen koppling till Nintendo, The Pokémon Company, Creatures, GAME
          FREAK, PSA, BGS eller CGC.
        </p>
      </footer>
    </main>
  );
}

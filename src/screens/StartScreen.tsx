import { EnergyIcon } from "../ui/EnergyIcon";
import { Logo } from "../ui/Logo";

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
        <div className="hero-inner">
          <Logo size={72} />
          <h1 className="title">PokeScanner</h1>
          <p className="lede">Snap your Pokémon card and see which grade looks realistic, and exactly what pulls it down.</p>
        </div>
      </header>

      <div className="actions stack">
        <button className="btn primary big" onClick={onGrade}>
          Grade a card
        </button>
        <button className="btn big" onClick={onDemo}>
          Try the demo (no key needed)
        </button>
        <button className="btn ghost" onClick={onHistory}>
          My cards{historyCount > 0 ? ` (${historyCount})` : ""}
        </button>
      </div>

      {storageError && (
        <p className="notice warn">
          This browser does not allow local storage (e.g. private mode). Analyses still work, but your history will not be saved.
        </p>
      )}

      <ol className="steps">
        <li>
          <EnergyIcon type="fire" />
          <span>
            <strong>Snap the front and back.</strong> Add a close-up or an angled-light photo if you want.
          </span>
        </li>
        <li>
          <EnergyIcon type="electric" />
          <span>
            <strong>Instant photo check.</strong> Glare, focus, corners and centering are checked right on your phone.
          </span>
        </li>
        <li>
          <EnergyIcon type="water" />
          <span>
            <strong>Tap Analyze.</strong> Only then are the photos sent to the AI provider you chose.
          </span>
        </li>
      </ol>

      <footer className="fineprint">
        <p>Free and open source. No account. Your API key only lives in memory while the page is open, and results are saved on your device.</p>
        <p>
          PokeScanner is an unofficial fan project and is not affiliated with Nintendo, The Pokémon Company, Creatures, GAME
          FREAK, PSA, BGS or CGC.
        </p>
      </footer>
    </main>
  );
}

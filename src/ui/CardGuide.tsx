/** Placeringsguide: kortet rakt i bild, alla fyra hörn synliga med marginal. */
export function CardGuide() {
  return (
    <figure className="guide">
      <svg viewBox="0 0 220 260" role="img" aria-label="Kortet ska ligga rakt i bild med alla fyra hörn synliga">
        <defs>
          <pattern id="mat" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M10 0H0V10" fill="none" stroke="var(--grid)" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="220" height="260" rx="14" fill="url(#mat)" />
        {/* telefonens bildruta */}
        <rect x="18" y="14" width="184" height="232" rx="10" fill="none" stroke="var(--muted)" strokeDasharray="4 4" />
        {/* kortet */}
        <rect x="50" y="40" width="120" height="168" rx="6" fill="var(--panel-2)" stroke="var(--text)" strokeWidth="1.5" />
        <rect x="58" y="48" width="104" height="80" rx="2" fill="none" stroke="var(--muted)" />
        <line x1="58" y1="140" x2="140" y2="140" stroke="var(--muted)" />
        <line x1="58" y1="150" x2="120" y2="150" stroke="var(--muted)" />
        {/* hörnmarkörer */}
        {[
          [44, 34, 1, 1],
          [176, 34, -1, 1],
          [44, 214, 1, -1],
          [176, 214, -1, -1],
        ].map(([x, y, dx, dy], i) => (
          <path
            key={i}
            d={`M${x} ${y! + 14 * dy!}V${y}H${x! + 14 * dx!}`}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        ))}
        <text x="110" y="234" textAnchor="middle" className="guide-label">
          marginal runt alla fyra hörn
        </text>
      </svg>
      <figcaption>
        <ul className="tips">
          <li>Lägg kortet på en mörk, matt och jämn yta.</li>
          <li>Ingen blixt. Jämnt ljus från sidan ger minst blänk.</li>
          <li>Håll telefonen rakt ovanför kortet, parallellt med det.</li>
          <li>Kortet ska fylla ungefär 80 % av bilden, med alla fyra hörn synliga.</li>
          <li>Ta gärna kortet ur plastfickan, plasten ger reflexer.</li>
        </ul>
      </figcaption>
    </figure>
  );
}

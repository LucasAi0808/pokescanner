/** Placement guide: card straight in frame, all four corners visible with a margin. */
export function CardGuide() {
  return (
    <figure className="guide">
      <svg viewBox="0 0 220 260" role="img" aria-label="Keep the card straight in the frame with all four corners visible">
        <rect x="0" y="0" width="220" height="260" rx="16" fill="#2b3044" />
        {/* the phone frame */}
        <rect x="18" y="14" width="184" height="232" rx="12" fill="none" stroke="#ffffff" strokeOpacity=".5" strokeDasharray="5 5" />
        {/* the card */}
        <rect x="50" y="40" width="120" height="168" rx="7" fill="#ffffff" stroke="#1d2340" strokeWidth="2" />
        <rect x="58" y="50" width="104" height="72" rx="3" fill="#ffe1dc" />
        <rect x="58" y="134" width="70" height="7" rx="3.5" fill="#d9dce6" />
        <rect x="58" y="148" width="90" height="7" rx="3.5" fill="#d9dce6" />
        {/* corner markers */}
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
            stroke="#ffcb05"
            strokeWidth="4"
            strokeLinecap="round"
          />
        ))}
        <text x="110" y="236" textAnchor="middle" className="guide-label">
          margin around all 4 corners
        </text>
      </svg>
      <figcaption>
        <ul className="tips">
          <li>Place the card on a dark, matte, flat surface.</li>
          <li>No flash. Soft light from the side gives the least glare.</li>
          <li>Hold the phone straight above the card, parallel to it.</li>
          <li>The card should fill about 80% of the photo, with all four corners visible.</li>
          <li>Take the card out of its sleeve, plastic causes reflections.</li>
        </ul>
      </figcaption>
    </figure>
  );
}

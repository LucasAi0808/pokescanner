/**
 * PokeScanner logo: a card with red scan corners and a sparkle.
 * Original design for this project.
 */
export function Logo({ size = 48 }: { size?: number }) {
  return (
    <svg className="logo-svg" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="18" y="10" width="28" height="40" rx="4" fill="#fff" stroke="#1d2340" strokeWidth="3" transform="rotate(-8 32 30)" />
      <rect x="22" y="15" width="20" height="14" rx="2" fill="#ffe1dc" transform="rotate(-8 32 30)" />
      <g fill="none" stroke="#e3241b" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 18V8h10" />
        <path d="M56 18V8H46" />
        <path d="M8 46v10h10" />
        <path d="M56 46v10H46" />
      </g>
      <path d="M47 33l2.2 5.3L54.5 40l-5.3 2.2L47 47.5l-2.2-5.3L39.5 40l5.3-1.7Z" fill="#ffcb05" stroke="#1d2340" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

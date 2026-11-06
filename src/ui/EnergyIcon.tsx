import type { ReactNode } from "react";

/**
 * Original energy-type style icons used for the four subgrades.
 * Simple shapes drawn for this project.
 */
export type Energy = "fire" | "electric" | "water" | "psychic";

export const SUBGRADE_ENERGY = {
  corners: "fire",
  edges: "electric",
  surface: "water",
  centering: "psychic",
} as const satisfies Record<string, Energy>;

const GLYPHS: Record<Energy, ReactNode> = {
  fire: <path d="M12 3c1 3.2-1.6 4.6-1.6 7.2 0 1.3.9 2.3 2 2.3s1.9-.8 1.9-2c1.8 1.4 2.7 3.3 2.7 5.1A5 5 0 0 1 12 20.5a5 5 0 0 1-5-4.9C7 10.8 11.6 8.4 12 3Z" />,
  electric: <path d="M13.5 2.5 6 13.2h5l-1.5 8.3L18 10.6h-5.2l.7-8.1Z" />,
  water: <path d="M12 3.2c2.8 3.9 5.6 7.1 5.6 10.4a5.6 5.6 0 1 1-11.2 0C6.4 10.3 9.2 7.1 12 3.2Z" />,
  psychic: (
    <>
      <circle cx="12" cy="12" r="7.2" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
};

export function EnergyIcon({ type, size = 28 }: { type: Energy; size?: number }) {
  return (
    <span className={`energy energy-${type}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 24 24" width={size * 0.66} height={size * 0.66} fill="currentColor">
        {GLYPHS[type]}
      </svg>
    </span>
  );
}

import type { FindingKind } from "../grading/types";

export const fmtGrade = (g: number) => (Number.isInteger(g) ? String(g) : g.toFixed(1));

export function fmtRange(r: { low: number; high: number } | null): string {
  if (!r) return "–";
  return r.low === r.high ? fmtGrade(r.low) : `${fmtGrade(r.low)}–${fmtGrade(r.high)}`;
}

export const KIND_LABEL: Record<FindingKind, string> = {
  defect: "Flaw",
  possible_reflection: "Maybe glare",
  print_feature: "Print",
};

export const KIND_GROUP: Record<FindingKind, string> = {
  defect: "Visible flaws that lower the grade",
  possible_reflection: "Possible reflections from the photo",
  print_feature: "Part of the card's print",
};

export const CONFIDENCE_LABEL = { low: "low confidence", medium: "medium confidence", high: "high confidence" } as const;

export const SEVERITY_LABEL = { minor: "minor", moderate: "moderate", major: "major" } as const;

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export const fmtUsd = (usd: number) => (usd < 0.01 ? "under $0.01" : `$${usd.toFixed(2)}`);

export interface Rarity {
  stars: number;
  label: string;
  holo: boolean;
}

/**
 * Turns the estimated range into a rarity-style badge. Purely visual: it is
 * based on the middle of the range and is not an official grade.
 */
export function rarityOf(range: { low: number; high: number } | null): Rarity | null {
  if (!range) return null;
  const mid = (range.low + range.high) / 2;
  if (mid >= 8.75) return { stars: 4, label: "Mint candidate", holo: true };
  if (mid >= 6.75) return { stars: 3, label: "Near mint", holo: false };
  if (mid >= 3.75) return { stars: 2, label: "Played", holo: false };
  return { stars: 1, label: "Heavily played", holo: false };
}

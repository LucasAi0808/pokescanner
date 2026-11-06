import type { FindingKind } from "../grading/types";

export const fmtGrade = (g: number) => (Number.isInteger(g) ? String(g) : g.toFixed(1).replace(".", ","));

export function fmtRange(r: { low: number; high: number } | null): string {
  if (!r) return "–";
  return r.low === r.high ? fmtGrade(r.low) : `${fmtGrade(r.low)}–${fmtGrade(r.high)}`;
}

export const KIND_LABEL: Record<FindingKind, string> = {
  defect: "Fel",
  possible_reflection: "Möjlig reflex",
  print_feature: "Tryck",
};

export const KIND_GROUP: Record<FindingKind, string> = {
  defect: "Synliga fel som drar ner",
  possible_reflection: "Möjliga reflexer från fotot",
  print_feature: "Hör till kortets tryck",
};

export const CONFIDENCE_LABEL = { low: "låg säkerhet", medium: "medelhög säkerhet", high: "hög säkerhet" } as const;

export const SEVERITY_LABEL = { minor: "liten", moderate: "måttlig", major: "stor" } as const;

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("sv-SE", { dateStyle: "medium", timeStyle: "short" });
}

export const fmtSek = (sek: number) =>
  sek < 0.1 ? "under 10 öre" : `${sek.toFixed(sek < 10 ? 2 : 0).replace(".", ",")} kr`;

import { z } from "zod";

/**
 * Två lager:
 * 1. `ModelOutputSchema` är det modellen ombeds svara med (structured outputs).
 *    Det är medvetet "löst" (inga min/max), eftersom JSON-schemat som skickas
 *    till API:t bara stöder en delmängd av begränsningar. Allt är obligatoriskt
 *    men nullbart, vilket structured outputs kräver.
 * 2. `GradingResult` är appens egen, normaliserade form. `normalizeModelOutput`
 *    klipper värden, kastar ogiltiga fynd och gör resultatet internt konsekvent.
 */

export const IMAGE_SLOTS = ["front", "back", "closeup", "raking"] as const;
export type ImageSlot = (typeof IMAGE_SLOTS)[number];

export const SLOT_LABELS: Record<ImageSlot, string> = {
  front: "Framsida",
  back: "Baksida",
  closeup: "Närbild",
  raking: "Snett ljus",
};

export const LANGUAGES = {
  ja: "Japanska",
  en: "Engelska",
  ko: "Koreanska",
  zh: "Kinesiska",
  de: "Tyska",
  fr: "Franska",
  it: "Italienska",
  es: "Spanska",
  pt: "Portugisiska",
  nl: "Nederländska",
  sv: "Svenska",
  other: "Annat språk",
  unknown: "Okänt",
} as const;
export type CardLanguage = keyof typeof LANGUAGES;
const languageKeys = Object.keys(LANGUAGES) as [CardLanguage, ...CardLanguage[]];

const Confidence = z.enum(["low", "medium", "high"]);
export type Confidence = z.infer<typeof Confidence>;

const ModelBox = z.object({
  x: z.number().describe("Vänsterkant i pixlar i den bild fyndet gäller"),
  y: z.number().describe("Överkant i pixlar"),
  width: z.number(),
  height: z.number(),
});

const ModelSubgrade = z.object({
  assessment: z.string().describe("Kort motivering på svenska"),
  low: z.number().nullable().describe("Lägsta rimliga delbetyg 1-10, eller null om det inte går att bedöma"),
  high: z.number().nullable(),
  confidence: Confidence,
});

export const FINDING_KINDS = ["defect", "possible_reflection", "print_feature"] as const;
export type FindingKind = (typeof FINDING_KINDS)[number];
export const FINDING_CATEGORIES = ["corners", "edges", "surface", "centering", "other"] as const;
export type FindingCategory = (typeof FINDING_CATEGORIES)[number];
export const SEVERITIES = ["minor", "moderate", "major"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const ModelOutputSchema = z.object({
  status: z.enum(["graded", "abstained"]),
  abstain_reason: z.string().nullable(),
  grade_low: z.number().nullable(),
  grade_high: z.number().nullable(),
  summary: z.string(),
  subgrades: z.object({
    centering: ModelSubgrade,
    corners: ModelSubgrade,
    edges: ModelSubgrade,
    surface: ModelSubgrade,
  }),
  findings: z.array(
    z.object({
      image: z.string().describe("Bildens id, t.ex. front eller back"),
      kind: z.enum(FINDING_KINDS),
      category: z.enum(FINDING_CATEGORIES),
      severity: z.enum(SEVERITIES),
      title: z.string(),
      description: z.string(),
      location: z.string().describe("Plats i ord, t.ex. 'övre vänstra hörnet'"),
      box: ModelBox.nullable(),
    }),
  ),
  hard_to_assess: z.array(z.object({ aspect: z.string(), reason: z.string() })),
  image_issues: z.array(
    z.object({ image: z.string(), problem: z.string(), advice: z.string() }),
  ),
  card: z.object({
    name: z.string().nullable(),
    number: z.string().nullable(),
    set_name: z.string().nullable(),
    language: z.enum(languageKeys),
    confidence: Confidence,
  }),
});
export type ModelOutput = z.infer<typeof ModelOutputSchema>;

/* ---------- Appens normaliserade form ---------- */

export interface NormBox {
  /** 0–1 relativt bildens bredd/höjd */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Subgrade {
  assessment: string;
  range: { low: number; high: number } | null;
  confidence: Confidence;
}

export interface Finding {
  id: string;
  image: ImageSlot;
  kind: FindingKind;
  category: FindingCategory;
  severity: Severity;
  title: string;
  description: string;
  location: string;
  box: NormBox | null;
}

export interface CardIdentity {
  name: string;
  number: string;
  setName: string;
  language: CardLanguage;
  confidence: Confidence;
}

export interface GradingResult {
  status: "graded" | "abstained";
  abstainReason: string | null;
  gradeRange: { low: number; high: number } | null;
  summary: string;
  subgrades: Record<"centering" | "corners" | "edges" | "surface", Subgrade>;
  findings: Finding[];
  hardToAssess: { aspect: string; reason: string }[];
  imageIssues: { image: ImageSlot | null; problem: string; advice: string }[];
  card: CardIdentity;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

/** Bild som skickas till en leverantör. */
export interface ProviderImage {
  slot: ImageSlot;
  mediaType: "image/jpeg";
  base64: string;
  width: number;
  height: number;
}

/* ---------- Normalisering ---------- */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Betyg 1–10 i halvsteg. */
const toGrade = (v: number) => clamp(Math.round(v * 2) / 2, 1, 10);

function normRange(low: number | null, high: number | null): { low: number; high: number } | null {
  if (low == null && high == null) return null;
  const a = toGrade(low ?? high!);
  const b = toGrade(high ?? low!);
  return { low: Math.min(a, b), high: Math.max(a, b) };
}

function isSlot(s: string): s is ImageSlot {
  return (IMAGE_SLOTS as readonly string[]).includes(s);
}

export function normalizeModelOutput(
  raw: ModelOutput,
  images: { slot: ImageSlot; width: number; height: number }[],
): GradingResult {
  const dims = new Map(images.map((i) => [i.slot, i]));

  const findings: Finding[] = [];
  raw.findings.forEach((f, idx) => {
    const slot = f.image.trim().toLowerCase();
    if (!isSlot(slot) || !dims.has(slot)) return; // fynd på en bild vi inte skickade
    const d = dims.get(slot)!;
    let box: NormBox | null = null;
    if (f.box && [f.box.x, f.box.y, f.box.width, f.box.height].every(Number.isFinite)) {
      const x0 = clamp(f.box.x / d.width, 0, 1);
      const y0 = clamp(f.box.y / d.height, 0, 1);
      const x1 = clamp((f.box.x + Math.abs(f.box.width)) / d.width, 0, 1);
      const y1 = clamp((f.box.y + Math.abs(f.box.height)) / d.height, 0, 1);
      if (x1 > x0 && y1 > y0) box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    findings.push({
      id: `f${idx + 1}`,
      image: slot,
      kind: f.kind,
      category: f.category,
      severity: f.severity,
      title: f.title.trim(),
      description: f.description.trim(),
      location: f.location.trim(),
      box,
    });
  });

  const abstained = raw.status === "abstained";
  const gradeRange = abstained ? null : normRange(raw.grade_low, raw.grade_high);
  // En "graded" utan intervall är inte ett betyg: behandla som avstått.
  const status = abstained || !gradeRange ? "abstained" : "graded";

  const sub = (s: ModelOutput["subgrades"]["corners"]): Subgrade => ({
    assessment: s.assessment.trim(),
    range: normRange(s.low, s.high),
    confidence: s.confidence,
  });

  return {
    status,
    abstainReason:
      status === "abstained"
        ? raw.abstain_reason?.trim() || "Underlaget räckte inte för en bedömning."
        : null,
    gradeRange: status === "graded" ? gradeRange : null,
    summary: raw.summary.trim(),
    subgrades: {
      centering: sub(raw.subgrades.centering),
      corners: sub(raw.subgrades.corners),
      edges: sub(raw.subgrades.edges),
      surface: sub(raw.subgrades.surface),
    },
    findings,
    hardToAssess: raw.hard_to_assess,
    imageIssues: raw.image_issues.map((i) => {
      const s = i.image.trim().toLowerCase();
      return { image: isSlot(s) ? s : null, problem: i.problem, advice: i.advice };
    }),
    card: {
      name: raw.card.name?.trim() ?? "",
      number: raw.card.number?.trim() ?? "",
      setName: raw.card.set_name?.trim() ?? "",
      language: raw.card.language,
      confidence: raw.card.confidence,
    },
  };
}

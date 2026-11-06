import type { GradingProvider } from "./provider";
import { GradingError } from "./errors";
import { normalizeModelOutput, type ModelOutput } from "./types";

/**
 * Demo mode: no model looks at the photos. The result is pre-written and
 * matches the flaws that `scripts/make-demo-images.mjs` draws on the demo card
 * (the images are 1500×2000 px, the card sits at x 163, y 180, 1174×1640 px).
 */
export const DEMO_IMAGES = {
  front: "demo/front.jpg",
  back: "demo/back.jpg",
} as const;

export const DEMO_OUTPUT: ModelOutput = {
  status: "graded",
  abstain_reason: null,
  grade_low: 7,
  grade_high: 8,
  summary:
    "DEMO: The card looks clean overall, but a small white dot on the top left corner of the back and light edge wear on the right edge of the front pull the grade down. The front is noticeably off-center to the right. A light streak across the artwork looks like a reflection from the photo, not damage.",
  subgrades: {
    centering: {
      assessment: "The left border on the front is visibly wider than the right. The back looks even.",
      low: 7,
      high: 8,
      confidence: "medium",
    },
    corners: {
      assessment: "Three corners look sharp. The top left corner of the back has a small white dot.",
      low: 7,
      high: 8,
      confidence: "medium",
    },
    edges: {
      assessment: "A few small white wear marks along the right edge of the front.",
      low: 7,
      high: 8,
      confidence: "medium",
    },
    surface: {
      assessment:
        "No clear scratches. A light streak on the front is most likely a reflection. The surface under it cannot be fully assessed.",
      low: 8,
      high: 9,
      confidence: "low",
    },
  },
  findings: [
    {
      image: "back",
      kind: "defect",
      category: "corners",
      severity: "moderate",
      title: "Small white dot on the top left corner of the back",
      description:
        "A white dot just inside the corner where the color seems worn away. Marks like this show clearly in a slab and often lower the corner grade.",
      location: "top left corner of the back",
      box: { x: 168, y: 186, width: 64, height: 64 },
    },
    {
      image: "front",
      kind: "defect",
      category: "edges",
      severity: "minor",
      title: "Light edge wear on the right edge",
      description: "Three small white marks along the right edge of the front, lower half.",
      location: "right edge of the front, lower half",
      box: { x: 1296, y: 1060, width: 60, height: 230 },
    },
    {
      image: "front",
      kind: "possible_reflection",
      category: "surface",
      severity: "minor",
      title: "Light streak across the artwork",
      description:
        "A diagonal light streak that follows the light in the room. Most likely a reflection, but the surface underneath cannot be assessed with certainty. An angled-light photo would help.",
      location: "artwork on the front, upper part",
      box: { x: 420, y: 330, width: 560, height: 420 },
    },
    {
      image: "front",
      kind: "print_feature",
      category: "surface",
      severity: "minor",
      title: "Diagonal lines in the holo pattern",
      description: "Even, parallel lines across the whole artwork that are part of the print. They do not lower the grade.",
      location: "artwork on the front",
      box: { x: 290, y: 320, width: 920, height: 640 },
    },
  ],
  hard_to_assess: [
    {
      aspect: "Surface under the light streak",
      reason: "The reflection may hide fine scratches. An angled-light photo would help.",
    },
    {
      aspect: "Bending and thickness",
      reason: "Not visible in photos taken straight from above.",
    },
  ],
  image_issues: [
    {
      image: "front",
      problem: "A light streak from a lamp falls across the artwork.",
      advice: "Tilt the card or the lamp slightly and retake the front, or add an angled-light photo.",
    },
  ],
  card: {
    name: "Quartzling (fictional demo card)",
    number: "DEMO 001/100",
    set_name: "PokeScanner demo",
    language: "en",
    confidence: "high",
  },
};

export const demoProvider: GradingProvider = {
  id: "demo",
  label: "Demo mode (no AI)",
  recipient: "Nobody. The photos never leave your device.",
  needsKey: false,
  costNote: "Free. The result is a pre-written example.",
  analyze: (req, signal) =>
    new Promise((resolve, reject) => {
      const t = setTimeout(
        () =>
          resolve({
            result: normalizeModelOutput(DEMO_OUTPUT, req.images),
            usage: null,
            servedBy: "demo",
          }),
        1200,
      );
      signal.addEventListener("abort", () => {
        clearTimeout(t);
        reject(new GradingError("aborted"));
      });
    }),
};

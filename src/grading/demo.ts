import type { GradingProvider } from "./provider";
import { GradingError } from "./errors";
import { normalizeModelOutput, type ModelOutput } from "./types";

/**
 * Demoläge: ingen modell tittar på bilderna. Resultatet är förskrivet och
 * matchar de fel som `scripts/make-demo-images.mjs` ritar in i demokortet
 * (bilderna är 1500×2000 px, kortet ligger i x 163, y 180, 1174×1640 px).
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
    "DEMO: Kortet ser rent ut i stort, men en vit prick i baksidans övre vänstra hörn och lätt kantnötning på framsidans högra kant drar ner betyget. Framsidan är märkbart förskjuten åt höger. Ett ljust stråk över bilden ser ut att vara en reflex från fotot, inte en skada.",
  subgrades: {
    centering: {
      assessment: "Framsidans vänsterram är synligt bredare än högerramen. Baksidan ser jämn ut.",
      low: 7,
      high: 8,
      confidence: "medium",
    },
    corners: {
      assessment: "Tre hörn ser skarpa ut. Baksidans övre vänstra hörn har en liten vit prick.",
      low: 7,
      high: 8,
      confidence: "medium",
    },
    edges: {
      assessment: "Några små vita nötningsmärken längs framsidans högra kant.",
      low: 7,
      high: 8,
      confidence: "medium",
    },
    surface: {
      assessment:
        "Inga tydliga repor. Ett ljust stråk på framsidan är troligen en reflex. Ytan kan inte bedömas helt under stråket.",
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
      title: "Liten vit prick i baksidans övre vänstra hörn",
      description:
        "En vit prick precis innanför hörnet där färgen verkar ha nötts bort. Sådana märken syns tydligt under plast och drar ofta ner hörnbetyget.",
      location: "baksidans övre vänstra hörn",
      box: { x: 168, y: 186, width: 64, height: 64 },
    },
    {
      image: "front",
      kind: "defect",
      category: "edges",
      severity: "minor",
      title: "Lätt kantnötning på högra kanten",
      description: "Tre små vita märken längs framsidans högra kant, nedre halvan.",
      location: "framsidans högra kant, nedre halvan",
      box: { x: 1296, y: 1060, width: 60, height: 230 },
    },
    {
      image: "front",
      kind: "possible_reflection",
      category: "surface",
      severity: "minor",
      title: "Ljust stråk över bildrutan",
      description:
        "Ett diagonalt ljust stråk som följer ljuset i rummet. Troligen en reflex, men ytan under går inte att bedöma säkert. Ta gärna en bild i snett ljus.",
      location: "framsidans bildruta, övre delen",
      box: { x: 420, y: 330, width: 560, height: 420 },
    },
    {
      image: "front",
      kind: "print_feature",
      category: "surface",
      severity: "minor",
      title: "Diagonala linjer i holomönstret",
      description: "Jämna, parallella linjer över hela bildrutan som hör till kortets tryck. Drar inte ner betyget.",
      location: "framsidans bildruta",
      box: { x: 290, y: 320, width: 920, height: 640 },
    },
  ],
  hard_to_assess: [
    {
      aspect: "Ytan under det ljusa stråket",
      reason: "Reflexen kan dölja fina repor. En bild i snett ljus skulle hjälpa.",
    },
    {
      aspect: "Böjning och tjocklek",
      reason: "Går inte att se på rakt framifrån tagna foton.",
    },
  ],
  image_issues: [
    {
      image: "front",
      problem: "Ett ljust stråk från en lampa ligger över bildrutan.",
      advice: "Vrid kortet eller lampan lite och ta om framsidan, eller lägg till en bild i snett ljus.",
    },
  ],
  card: {
    name: "Quartzling (fiktivt demokort)",
    number: "DEMO 001/100",
    set_name: "PokeScanner demo",
    language: "en",
    confidence: "high",
  },
};

export const demoProvider: GradingProvider = {
  id: "demo",
  label: "Demoläge (ingen AI)",
  recipient: "Ingen. Bilderna lämnar inte enheten.",
  needsKey: false,
  costNote: "Gratis. Resultatet är ett förskrivet exempel.",
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

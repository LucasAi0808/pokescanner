import type { ImageSlot } from "../grading/types";
import { analyzeQuality, type QualityReport } from "../quality/checks";

/**
 * Gränser för Claude 4.7 och senare (högupplöst nivå): högst 2 576 px långsida
 * och 4 784 visuella tokens (28×28 px per token). Vi skalar själva till strax
 * under gränsen. Då skalar inte API:t om bilden, och modellens pixelkoordinater
 * gäller exakt den bild som visas i appen.
 */
export const MAX_LONG_EDGE = 2576;
export const MAX_VISUAL_TOKENS = 4700;
const ANALYSIS_LONG_EDGE = 1000;

export interface PreparedImage {
  slot: ImageSlot;
  /** JPEG utan EXIF/GPS, i den storlek som skickas till modellen. */
  blob: Blob;
  width: number;
  height: number;
  origWidth: number;
  origHeight: number;
  quality: QualityReport;
}

export function fitLimits(w: number, h: number): { width: number; height: number } {
  let scale = Math.min(1, MAX_LONG_EDGE / Math.max(w, h));
  const tokens = (s: number) => Math.ceil((w * s) / 28) * Math.ceil((h * s) / 28);
  while (tokens(scale) > MAX_VISUAL_TOKENS) scale *= 0.98;
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  release(): void;
}

async function decode(file: Blob): Promise<Decoded> {
  if ("createImageBitmap" in window) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
    } catch {
      /* t.ex. HEIC i vissa Safari-versioner: prova <img> */
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("Bilden kunde inte läsas. Prova JPEG eller ta bilden med kameran.");
  }
  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    release: () => URL.revokeObjectURL(url),
  };
}

function canvasOf(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function toJpeg(c: HTMLCanvasElement, quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("Kunde inte koda bilden."))), "image/jpeg", quality),
  );
}

export async function prepareImage(file: Blob, slot: ImageSlot): Promise<PreparedImage> {
  const d = await decode(file);
  try {
    const { width, height } = fitLimits(d.width, d.height);
    const out = canvasOf(width, height);
    const ctx = out.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(d.source, 0, 0, width, height);
    // Omkodningen via canvas tar bort all EXIF-data, inklusive GPS-position.
    const blob = await toJpeg(out);

    const s = Math.min(1, ANALYSIS_LONG_EDGE / Math.max(width, height));
    const aw = Math.round(width * s);
    const ah = Math.round(height * s);
    const small = canvasOf(aw, ah);
    const sctx = small.getContext("2d", { willReadFrequently: true })!;
    sctx.drawImage(out, 0, 0, aw, ah);
    const pixels = sctx.getImageData(0, 0, aw, ah);
    const quality = analyzeQuality(
      { width: aw, height: ah, data: pixels.data },
      slot,
      { width: d.width, height: d.height },
    );
    return { slot, blob, width, height, origWidth: d.width, origHeight: d.height, quality };
  } finally {
    d.release();
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

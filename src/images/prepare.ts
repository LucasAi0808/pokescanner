import type { ImageSlot } from "../grading/types";
import { analyzeQuality, type QualityReport } from "../quality/checks";

/**
 * Limits for Claude 4.7 and later (high-resolution tier): at most 2,576 px on
 * the long edge and 4,784 visual tokens (28×28 px per token). We resize to just
 * under the limit ourselves. Then the API does not resize the image, and the
 * model's pixel coordinates match the exact image shown in the app.
 */
export const MAX_LONG_EDGE = 2576;
export const MAX_VISUAL_TOKENS = 4700;
const ANALYSIS_LONG_EDGE = 1000;

export interface PreparedImage {
  slot: ImageSlot;
  /** JPEG without EXIF/GPS, at the size sent to the model. */
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
      /* e.g. HEIC in some Safari versions: fall back to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("The photo could not be read. Try a JPEG or take the photo with the camera.");
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
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the photo."))), "image/jpeg", quality),
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
    // Re-encoding via canvas strips all EXIF data, including GPS location.
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

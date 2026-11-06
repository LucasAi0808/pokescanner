import type { CardIdentity, GradingResult, ImageSlot, Usage } from "../grading/types";
import type { PreparedImage } from "../images/prepare";

/**
 * Lokal lagring i IndexedDB. Allt stannar på enheten. API-nyckeln sparas aldrig här.
 */

export interface ActualGrade {
  company: string;
  grade: number;
  date: string;
}

export interface Assessment {
  id: string;
  createdAt: string;
  providerId: string;
  model: string;
  servedBy: string;
  demo: boolean;
  images: PreparedImage[];
  result: GradingResult;
  /** Användarens (eventuellt rättade) kortuppgifter. */
  card: CardIdentity;
  usage: Usage | null;
  costSek: number | null;
  actual: ActualGrade | null;
}

export interface Draft {
  providerId: string;
  images: Partial<Record<ImageSlot, PreparedImage>>;
  updatedAt: string;
}

const DB_NAME = "pokescanner";
const VERSION = 1;
const DRAFT = "draft";
const ASSESSMENTS = "assessments";

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB saknas"));
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DRAFT)) db.createObjectStore(DRAFT);
        if (!db.objectStoreNames.contains(ASSESSMENTS)) db.createObjectStore(ASSESSMENTS, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbPromise.catch(() => (dbPromise = null));
  }
  return dbPromise;
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error ?? req.error);
        tx.onabort = () => reject(tx.error ?? new Error("Transaktionen avbröts"));
      }),
  );
}

export function newId(): string {
  // crypto.randomUUID kräver säker kontext (https); appen ska fungera över http på LAN.
  const rnd = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");
  return `${Date.now().toString(36)}-${rnd}`;
}

/*
 * Safari/WebKit kan vägra lagra Blob i IndexedDB ("Error preparing Blob/File
 * data to be stored"). Därför sparas bilderna som ArrayBuffer och görs om
 * till Blob när de läses.
 */
type StoredImage = Omit<PreparedImage, "blob"> & { bytes: ArrayBuffer; type: string };

async function packImage(i: PreparedImage): Promise<StoredImage> {
  const { blob, ...rest } = i;
  return { ...rest, bytes: await blob.arrayBuffer(), type: blob.type || "image/jpeg" };
}
function unpackImage(i: StoredImage | PreparedImage): PreparedImage {
  if ("blob" in i && i.blob instanceof Blob) return i as PreparedImage;
  const { bytes, type, ...rest } = i as StoredImage;
  return { ...rest, blob: new Blob([bytes], { type }) };
}

async function packImages<T extends Partial<Record<string, PreparedImage>>>(m: T) {
  const out: Record<string, StoredImage> = {};
  for (const [k, v] of Object.entries(m)) if (v) out[k] = await packImage(v);
  return out;
}
function unpackImages(m: Record<string, StoredImage | PreparedImage>) {
  const out: Record<string, PreparedImage> = {};
  for (const [k, v] of Object.entries(m)) out[k] = unpackImage(v);
  return out;
}

const unpackAssessment = (a: any): Assessment => ({ ...a, images: a.images.map(unpackImage) });

export async function saveDraft(d: Draft) {
  const packed = { ...d, images: await packImages(d.images) };
  return run(DRAFT, "readwrite", (s) => s.put(packed, "current"));
}
export async function loadDraft(): Promise<Draft | undefined> {
  const d = await run<any>(DRAFT, "readonly", (s) => s.get("current"));
  return d ? { ...d, images: unpackImages(d.images) } : undefined;
}
export const clearDraft = () => run(DRAFT, "readwrite", (s) => s.delete("current"));

export async function saveAssessment(a: Assessment) {
  const packed = { ...a, images: await Promise.all(a.images.map(packImage)) };
  return run(ASSESSMENTS, "readwrite", (s) => s.put(packed));
}
export async function getAssessment(id: string): Promise<Assessment | undefined> {
  const a = await run<any>(ASSESSMENTS, "readonly", (s) => s.get(id));
  return a ? unpackAssessment(a) : undefined;
}
export async function listAssessments(): Promise<Assessment[]> {
  const all = await run<any[]>(ASSESSMENTS, "readonly", (s) => s.getAll());
  return all.map(unpackAssessment).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function updateAssessment(id: string, patch: Partial<Assessment>): Promise<Assessment | undefined> {
  const a = await getAssessment(id);
  if (!a) return undefined;
  const next = { ...a, ...patch, id };
  await saveAssessment(next);
  return next;
}
export const deleteAssessment = (id: string) => run(ASSESSMENTS, "readwrite", (s) => s.delete(id));
export const deleteAllAssessments = () => run(ASSESSMENTS, "readwrite", (s) => s.clear());

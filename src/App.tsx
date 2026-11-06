import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO_IMAGES } from "./grading/demo";
import { asGradingError } from "./grading/errors";
import { ANTHROPIC_MODELS, actualCost } from "./grading/provider";
import { getProvider } from "./grading/registry";
import { IMAGE_SLOTS, type ImageSlot, type ProviderImage } from "./grading/types";
import { blobToBase64, prepareImage, type PreparedImage } from "./images/prepare";
import { AnalyzingScreen } from "./screens/AnalyzingScreen";
import { CaptureScreen } from "./screens/CaptureScreen";
import { ConsentSheet } from "./screens/ConsentSheet";
import { HistoryScreen } from "./screens/HistoryScreen";
import { ResultScreen } from "./screens/ResultScreen";
import { StartScreen } from "./screens/StartScreen";
import { loadModel, saveModel, session } from "./session";
import * as db from "./storage/db";

type Screen =
  | { name: "start" }
  | { name: "capture" }
  | { name: "analyzing" }
  | { name: "result"; from: "analysis" | "history" }
  | { name: "history" };

type Images = Partial<Record<ImageSlot, PreparedImage>>;

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: "start" });
  const [providerId, setProviderId] = useState("anthropic");
  const [images, setImages] = useState<Images>({});
  const [busy, setBusy] = useState<Partial<Record<ImageSlot, boolean>>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [model, setModel] = useState(loadModel);
  const [current, setCurrent] = useState<{ a: db.Assessment; saved: boolean } | null>(null);
  const [history, setHistory] = useState<db.Assessment[]>([]);
  const [storageError, setStorageError] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const restored = useRef(false);

  const refreshHistory = useCallback(async () => {
    try {
      setHistory(await db.listAssessments());
    } catch {
      setStorageError(true);
    }
  }, []);

  // Återställ utkast (iOS kan ladda om fliken efter kameran) och läs historiken.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    refreshHistory();
    db.loadDraft()
      .then((d) => {
        if (d && Object.keys(d.images).length) {
          setImages(d.images);
          setProviderId(d.providerId);
          setNotice("Dina bilder från förra gången återställdes.");
          setScreen({ name: "capture" });
        }
      })
      .catch(() => setStorageError(true))
      .finally(() => setDraftLoaded(true));
  }, [refreshHistory]);

  // Spara utkastet när bilderna ändras (först efter att det gamla lästs in).
  useEffect(() => {
    if (!draftLoaded) return;
    const has = Object.keys(images).length > 0;
    const p = has
      ? db.saveDraft({ providerId, images, updatedAt: new Date().toISOString() })
      : db.clearDraft();
    p.catch(() => setStorageError(true));
  }, [images, providerId, draftLoaded]);

  const scrollTop = () => window.scrollTo({ top: 0 });

  const startGrading = () => {
    if (providerId === "demo") setImages({});
    setProviderId("anthropic");
    setError(null);
    setNotice(null);
    setScreen({ name: "capture" });
    scrollTop();
  };

  const startDemo = async () => {
    setProviderId("demo");
    setError(null);
    setNotice(null);
    setImages({});
    setScreen({ name: "capture" });
    setBusy({ front: true, back: true });
    try {
      const entries = await Promise.all(
        (["front", "back"] as const).map(async (slot) => {
          const res = await fetch(DEMO_IMAGES[slot]);
          if (!res.ok) throw new Error("Demobilden kunde inte laddas.");
          return [slot, await prepareImage(await res.blob(), slot)] as const;
        }),
      );
      setImages(Object.fromEntries(entries));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Demobilderna kunde inte laddas.");
    } finally {
      setBusy({});
    }
  };

  const onFile = async (slot: ImageSlot, file: File) => {
    setBusy((b) => ({ ...b, [slot]: true }));
    setError(null);
    try {
      const img = await prepareImage(file, slot);
      setImages((cur) => ({ ...cur, [slot]: img }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilden kunde inte läsas.");
    } finally {
      setBusy((b) => ({ ...b, [slot]: false }));
    }
  };

  const onRemove = (slot: ImageSlot) =>
    setImages((cur) => {
      const next = { ...cur };
      delete next[slot];
      return next;
    });

  const ordered = (imgs: Images) => IMAGE_SLOTS.map((s) => imgs[s]).filter((x): x is PreparedImage => !!x);

  const runAnalysis = async () => {
    const provider = getProvider(providerId);
    const list = ordered(images);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setError(null);
    setNotice(null);
    setScreen({ name: "analyzing" });
    scrollTop();
    try {
      // Bilderna kodas och skickas först nu, när användaren tryckt Analysera.
      const payload: ProviderImage[] = await Promise.all(
        list.map(async (i) => ({
          slot: i.slot,
          mediaType: "image/jpeg" as const,
          base64: await blobToBase64(i.blob),
          width: i.width,
          height: i.height,
        })),
      );
      const res = await provider.analyze(
        { images: payload, apiKey: provider.needsKey ? (session.getKey() ?? undefined) : undefined, model },
        ctrl.signal,
      );
      const a: db.Assessment = {
        id: db.newId(),
        createdAt: new Date().toISOString(),
        providerId,
        model: provider.id === "demo" ? "demo" : model,
        servedBy: res.servedBy,
        demo: provider.id === "demo",
        images: list,
        result: res.result,
        card: res.result.card,
        usage: res.usage,
        costSek: res.usage ? (actualCost(res.usage, model)?.sek ?? null) : null,
        actual: null,
      };
      let saved = true;
      try {
        await db.saveAssessment(a);
        await db.clearDraft();
      } catch {
        saved = false;
        setStorageError(true);
      }
      setImages({});
      setCurrent({ a, saved });
      await refreshHistory();
      setScreen({ name: "result", from: "analysis" });
      scrollTop();
    } catch (e) {
      const err = asGradingError(e);
      if (err.code === "invalid_key") session.clearKey();
      setError(err.message);
      setScreen({ name: "capture" });
    } finally {
      abortRef.current = null;
    }
  };

  const onAnalyze = () => {
    const provider = getProvider(providerId);
    if (provider.needsKey && (!session.getKey() || !session.hasConsent())) setConsentOpen(true);
    else void runAnalysis();
  };

  const openAssessment = async (id: string) => {
    // Bara lokal läsning. Inga anrop till någon leverantör.
    const a = await db.getAssessment(id);
    if (!a) return;
    setCurrent({ a, saved: true });
    setScreen({ name: "result", from: "history" });
    scrollTop();
  };

  const retake = () => {
    if (!current) return;
    const imgs: Images = {};
    for (const i of current.a.images) imgs[i.slot] = i;
    setProviderId(current.a.demo ? "demo" : "anthropic");
    setImages(imgs);
    setError(null);
    setNotice("Bilderna från bedömningen är ifyllda. Byt ut de som behöver tas om.");
    setScreen({ name: "capture" });
    scrollTop();
  };

  const provider = getProvider(providerId);

  return (
    <>
      {screen.name === "start" && (
        <StartScreen
          onGrade={startGrading}
          onDemo={startDemo}
          onHistory={() => {
            refreshHistory();
            setScreen({ name: "history" });
          }}
          historyCount={history.length}
          storageError={storageError}
        />
      )}
      {screen.name === "capture" && (
        <CaptureScreen
          images={images}
          busy={busy}
          demo={providerId === "demo"}
          error={error}
          notice={notice}
          onFile={onFile}
          onRemove={onRemove}
          onAnalyze={onAnalyze}
          onBack={() => setScreen({ name: "start" })}
          onDismissError={() => setError(null)}
        />
      )}
      {screen.name === "analyzing" && (
        <AnalyzingScreen
          front={images.front}
          label={
            provider.id === "demo"
              ? "Demoläge: inga bilder skickas."
              : `Skickat till ${provider.recipient}, ${ANTHROPIC_MODELS.find((m) => m.id === model)?.label ?? model}.`
          }
          onCancel={() => abortRef.current?.abort()}
        />
      )}
      {screen.name === "result" && current && (
        <ResultScreen
          key={current.a.id}
          assessment={current.a}
          saved={current.saved}
          backLabel={screen.from === "history" ? "Historik" : "Start"}
          onBack={() => setScreen(screen.from === "history" ? { name: "history" } : { name: "start" })}
          onNew={startGrading}
          onRetake={retake}
          onDelete={async () => {
            await db.deleteAssessment(current.a.id);
            setCurrent(null);
            await refreshHistory();
            setScreen({ name: "history" });
          }}
          onUpdate={async (patch) => {
            const next = await db.updateAssessment(current.a.id, patch);
            if (next) setCurrent({ a: next, saved: true });
            await refreshHistory();
          }}
        />
      )}
      {screen.name === "history" && (
        <HistoryScreen
          items={history}
          onOpen={openAssessment}
          onBack={() => setScreen({ name: "start" })}
          onDeleteAll={async () => {
            await db.deleteAllAssessments();
            await refreshHistory();
          }}
        />
      )}
      {consentOpen && (
        <ConsentSheet
          provider={provider}
          images={ordered(images)}
          model={model}
          hasKey={!!session.getKey()}
          onModel={(m) => {
            setModel(m);
            saveModel(m);
          }}
          onCancel={() => setConsentOpen(false)}
          onConfirm={(key) => {
            if (key) session.setKey(key);
            session.giveConsent();
            setConsentOpen(false);
            void runAnalysis();
          }}
        />
      )}
    </>
  );
}

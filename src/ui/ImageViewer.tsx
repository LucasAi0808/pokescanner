import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { SLOT_LABELS, type Finding, type ImageSlot } from "../grading/types";
import { useObjectUrl } from "./useObjectUrl";

export interface ViewerImage {
  slot: ImageSlot;
  blob: Blob;
  width: number;
  height: number;
}

interface Props {
  images: ViewerImage[];
  findings: Finding[];
  /** Fyndnummer att visa i markörerna (samma som i listan). */
  numbers: Map<string, number>;
  activeSlot: ImageSlot;
  onSlotChange: (s: ImageSlot) => void;
  focusId: string | null;
  /** Ökas för att zooma till samma fynd igen. */
  focusNonce: number;
}

interface T {
  s: number;
  x: number;
  y: number;
}
const ID: T = { s: 1, x: 0, y: 0 };
const MAX_S = 8;

export function ImageViewer({ images, findings, numbers, activeSlot, onSlotChange, focusId, focusNonce }: Props) {
  const img = images.find((i) => i.slot === activeSlot) ?? images[0]!;
  const url = useObjectUrl(img.blob);
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const [t, setT] = useState<T>(ID);
  const [animate, setAnimate] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; mid: { x: number; y: number }; t: T } | null>(null);
  const lastTap = useRef(0);
  const moved = useRef(false);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [activeSlot]);

  const clamp = useCallback(
    (n: T): T => {
      const s = Math.min(MAX_S, Math.max(1, n.s));
      return {
        s,
        x: Math.min(0, Math.max(size.w - size.w * s, n.x)),
        y: Math.min(0, Math.max(size.h - size.h * s, n.y)),
      };
    },
    [size],
  );

  // Byt bild => återställ zoom.
  useEffect(() => setT(ID), [activeSlot]);

  // Zooma till valt fynd.
  useEffect(() => {
    const f = findings.find((x) => x.id === focusId);
    if (!f || f.image !== activeSlot) return;
    if (!f.box) {
      setAnimate(true);
      setT(ID);
      return;
    }
    const b = f.box;
    const s = Math.min(6, Math.max(1.6, Math.min(0.5 / b.w, 0.5 / b.h)));
    const cx = (b.x + b.w / 2) * size.w * s;
    const cy = (b.y + b.h / 2) * size.h * s;
    setAnimate(true);
    setT(clamp({ s, x: size.w / 2 - cx, y: size.h / 2 - cy }));
  }, [focusId, focusNonce, activeSlot, size, findings, clamp]);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const zoomAt = (p: { x: number; y: number }, s: number, from: T) => {
    const cx = (p.x - from.x) / from.s;
    const cy = (p.y - from.y) / from.s;
    return clamp({ s, x: p.x - cx * s, y: p.y - cy * s });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    box.current!.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    setAnimate(false);
    moved.current = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      gesture.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        t,
      };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (Math.hypot(p.x - prev.x, p.y - prev.y) > 2) moved.current = true;
    if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const g = gesture.current;
      const s = (g.t.s * Math.hypot(a.x - b.x, a.y - b.y)) / Math.max(1, g.dist);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const cx = (g.mid.x - g.t.x) / g.t.s;
      const cy = (g.mid.y - g.t.y) / g.t.s;
      const ns = Math.min(MAX_S, Math.max(1, s));
      setT(clamp({ s: ns, x: mid.x - cx * ns, y: mid.y - cy * ns }));
    } else if (pointers.current.size === 1 && t.s > 1) {
      setT((cur) => clamp({ ...cur, x: cur.x + p.x - prev.x, y: cur.y + p.y - prev.y }));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
    if (!moved.current && pointers.current.size === 0) {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        setAnimate(true);
        setT(t.s > 1.05 ? ID : zoomAt(local(e), 2.5, t));
        lastTap.current = 0;
      } else lastTap.current = now;
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    setAnimate(false);
    const s = t.s * Math.exp(-e.deltaY * 0.0015);
    setT(zoomAt(local(e), s, t));
  };

  const step = (factor: number) => {
    setAnimate(true);
    setT(zoomAt({ x: size.w / 2, y: size.h / 2 }, t.s * factor, t));
  };

  const here = findings.filter((f) => f.image === img.slot && f.box);
  const aspect = img.width / img.height;

  return (
    <div className="viewer">
      {images.length > 1 && (
        <div className="viewer-tabs" role="tablist" aria-label="Välj bild">
          {images.map((i) => {
            const n = findings.filter((f) => f.image === i.slot).length;
            return (
              <button
                key={i.slot}
                role="tab"
                aria-selected={i.slot === img.slot}
                className="viewer-tab"
                onClick={() => onSlotChange(i.slot)}
              >
                {SLOT_LABELS[i.slot]}
                {n > 0 && <span className="tab-count">{n}</span>}
              </button>
            );
          })}
        </div>
      )}
      <div
        ref={box}
        className="viewer-stage"
        style={{ aspectRatio: `${img.width} / ${img.height}`, width: `min(100%, calc(64svh * ${aspect}))` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        data-testid="viewer-stage"
        data-scale={t.s.toFixed(2)}
      >
        <div
          className={`viewer-layer${animate ? " is-animating" : ""}`}
          style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})`, ["--s" as string]: t.s }}
        >
          {url && <img src={url} alt={SLOT_LABELS[img.slot]} draggable={false} />}
          {here.map((f) => (
            <div
              key={f.id}
              className={`fbox kind-${f.kind}${f.id === focusId ? " is-focus" : ""}`}
              style={{
                left: `${f.box!.x * 100}%`,
                top: `${f.box!.y * 100}%`,
                width: `${f.box!.w * 100}%`,
                height: `${f.box!.h * 100}%`,
              }}
            >
              <span className="fbox-num">{numbers.get(f.id)}</span>
            </div>
          ))}
        </div>
        <span className="corner tl" />
        <span className="corner tr" />
        <span className="corner bl" />
        <span className="corner br" />
      </div>
      <div className="viewer-tools">
        <span className="mono dim">{(t.s * 100).toFixed(0)} %</span>
        <div className="viewer-buttons">
          <button className="icon-btn" onClick={() => step(1 / 1.6)} aria-label="Zooma ut">
            −
          </button>
          <button className="icon-btn" onClick={() => step(1.6)} aria-label="Zooma in">
            +
          </button>
          <button
            className="icon-btn wide"
            onClick={() => {
              setAnimate(true);
              setT(ID);
            }}
          >
            Hela bilden
          </button>
        </div>
      </div>
      <p className="hint">Nyp eller dubbeltryck för att zooma. Tryck på ett fynd nedan för att hoppa dit.</p>
    </div>
  );
}

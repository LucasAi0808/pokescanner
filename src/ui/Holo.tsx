import { useRef, type ReactNode } from "react";

/**
 * Holo foil shimmer, like a holographic trading card. The shine drifts on its
 * own and follows your finger (or mouse) when you drag across it.
 */
export function Holo({ children, className = "", strong = false }: { children: ReactNode; className?: string; strong?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--hx", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--hy", `${((e.clientY - r.top) / r.height) * 100}%`);
    el.classList.add("is-touched");
  };
  const leave = () => ref.current?.classList.remove("is-touched");
  return (
    <div
      ref={ref}
      className={`holo${strong ? " holo-strong" : ""} ${className}`}
      onPointerMove={move}
      onPointerLeave={leave}
      onPointerUp={leave}
    >
      {children}
      <span className="holo-shine" aria-hidden="true" />
      <span className="holo-glitter" aria-hidden="true" />
    </div>
  );
}

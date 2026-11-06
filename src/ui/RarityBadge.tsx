import { fmtRange, rarityOf } from "./format";
import { Holo } from "./Holo";

/** The estimated grade shown as a rarity-style badge with stars. */
export function RarityBadge({
  range,
  size = "large",
}: {
  range: { low: number; high: number } | null;
  size?: "large" | "small";
}) {
  const r = rarityOf(range);
  const body = (
    <div className={`rarity rarity-${size}${r ? ` stars-${r.stars}` : " rarity-none"}`} data-testid="rarity">
      <div className="rarity-stars" aria-label={r ? `${r.stars} of 4 stars` : "No grade"}>
        {r ? Array.from({ length: 4 }, (_, i) => <span key={i} className={i < r.stars ? "star on" : "star"}>★</span>) : <span className="star on">?</span>}
      </div>
      <div className="rarity-grade" data-testid="grade">
        {range ? fmtRange(range) : "No grade"}
        {range && <span className="rarity-of">/10</span>}
      </div>
      <div className="rarity-label">{r ? r.label : "Photos not good enough"}</div>
    </div>
  );
  return r?.holo ? <Holo strong>{body}</Holo> : body;
}

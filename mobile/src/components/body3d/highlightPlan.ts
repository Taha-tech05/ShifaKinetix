// What to tint and what to ghost, as plain data (no three.js), so it can be tested.
//  - The candidate muscles are tinted with a distinct colour. The base material of the model is never made transparent.
//  - If a candidate lies deep, the superficial muscles over it (same side, same area) are ghosted: only those meshes fade,
//    by their own material, so the candidate can be seen. Everything else keeps the base look.
import { REGION_MAP } from '../../regions/regionMap';

export interface Emphasis {
  /** structure id -> 0..1 amount of tint */
  tint: Record<string, number>;
  /** structure id -> 0..1 amount of ghosting (0 = as the picker draws it) */
  ghost: Record<string, number>;
}

export const NO_EMPHASIS: Emphasis = { tint: {}, ghost: {} };

/** Opacity of a fully ghosted muscle. The base material stays at 1. */
export const GHOST_OPACITY = 0.18;

/** Superficial muscles over a structure: same side, sharing a sub-region, in the muscle kind, and not deep themselves. */
export function overlyingOf(id: string, isDeep: (id: string) => boolean): string[] {
  const s = REGION_MAP.structures[id];
  if (!s) return [];
  const mine = new Set(s.subRegions);
  return Object.entries(REGION_MAP.structures)
    .filter(([other, o]) => other !== id && o.kind === 'muscle' && o.side === s.side && !isDeep(other) && o.subRegions.some((r) => mine.has(r)))
    .map(([other]) => other);
}

/** Emphasis for a set of candidates. `isDeep` tells whether a structure lies in the pack's deep soft-tissue layer. */
export function planEmphasis(candidates: string[], isDeep: (id: string) => boolean): Emphasis {
  const tint: Record<string, number> = {};
  const ghost: Record<string, number> = {};
  for (const c of candidates) tint[c] = 1;
  for (const c of candidates) {
    if (!isDeep(c)) continue;
    for (const o of overlyingOf(c, isDeep)) if (!(o in tint)) ghost[o] = 1;
  }
  return { tint, ghost };
}

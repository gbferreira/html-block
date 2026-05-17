import type { EndpointSide } from "../types.js";

export interface RouteRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoutePoint {
  x: number;
  y: number;
}

export interface RouteOptions {
  /** Length of the perpendicular stub each endpoint exits with. */
  stub?: number;
  /** Padding added around obstacles before routing. */
  padding?: number;
  /** Extra clearance for detour paths above/below the obstacles' union. */
  detourOffset?: number;
}

const DEFAULT_STUB = 18;
const DEFAULT_PADDING = 12;
const DEFAULT_DETOUR_OFFSET = 8;

/**
 * Compute an orthogonal (Manhattan) route from `from` to `to` that contours
 * around any obstacle rectangles (including the source and target blocks
 * themselves). Returns the polyline waypoints.
 *
 * The endpoints sit on the source/target edges; a perpendicular "stub" steps
 * out by `stub` units before routing begins, so the immediate exit/entry
 * segment is exempt from the collision check. Routing happens stub-to-stub.
 *
 * Strategy: build candidate orthogonal paths (HVH/VHV/HV/VH) plus "detour"
 * candidates that route around the union of in-the-way obstacles. Pick the
 * shortest collision-free candidate. If none is clean, fall back to the
 * shortest candidate (still orthogonal).
 */
export function routeOrthogonal(
  from: RoutePoint,
  fromSide: EndpointSide,
  to: RoutePoint,
  toSide: EndpointSide,
  obstacles: RouteRect[],
  options: RouteOptions = {},
): RoutePoint[] {
  const stub = options.stub ?? DEFAULT_STUB;
  const padding = options.padding ?? DEFAULT_PADDING;
  const detourOffset = options.detourOffset ?? DEFAULT_DETOUR_OFFSET;
  const inflated = obstacles.map((r) => inflate(r, padding));

  const sf = stubPoint(from, fromSide, stub);
  const st = stubPoint(to, toSide, stub);

  const candidates: RoutePoint[][] = [];
  candidates.push(...directCandidates(sf, fromSide, st, toSide));
  candidates.push(...detourCandidates(sf, fromSide, st, toSide, inflated, detourOffset));

  // Collision check is run on the stub-to-stub portion only. The exit/entry
  // segments (from -> sf and st -> to) intentionally cross the inflated
  // source/target obstacles; that's how the line attaches to the block.
  let best: RoutePoint[] | null = null;
  let bestLen = Infinity;
  for (const c of candidates) {
    if (pathIntersectsAny(c, inflated)) continue;
    const full: RoutePoint[] = [from, ...c, to];
    const len = pathLength(full);
    if (len < bestLen) {
      bestLen = len;
      best = full;
    }
  }
  if (best) return dedupe(best);

  let fallback = candidates[0] ?? [];
  let fLen = pathLength([from, ...fallback, to]);
  for (let i = 1; i < candidates.length; i++) {
    const len = pathLength([from, ...candidates[i], to]);
    if (len < fLen) {
      fLen = len;
      fallback = candidates[i];
    }
  }
  return dedupe([from, ...fallback, to]);
}

/** Drop consecutive identical waypoints AND collinear midpoints. */
function dedupe(path: RoutePoint[]): RoutePoint[] {
  if (path.length < 2) return path;
  const out: RoutePoint[] = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const prev = out[out.length - 1];
    const curr = path[i];
    if (prev.x === curr.x && prev.y === curr.y) continue;
    if (out.length >= 2) {
      const mid = out[out.length - 1];
      const before = out[out.length - 2];
      const collinearH = before.y === mid.y && mid.y === curr.y;
      const collinearV = before.x === mid.x && mid.x === curr.x;
      if (collinearH || collinearV) {
        out[out.length - 1] = curr;
        continue;
      }
    }
    out.push(curr);
  }
  return out;
}

export function pointsToSvgPath(points: RoutePoint[]): string {
  if (points.length === 0) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

/** Midpoint along the polyline by total path length, plus the local segment direction. */
export function pathMidpoint(points: RoutePoint[]): {
  point: RoutePoint;
  direction: { dx: number; dy: number };
} {
  if (points.length === 0) {
    return { point: { x: 0, y: 0 }, direction: { dx: 1, dy: 0 } };
  }
  if (points.length === 1) {
    return { point: { ...points[0] }, direction: { dx: 1, dy: 0 } };
  }
  const total = pathLength(points);
  if (total === 0) {
    return { point: { ...points[0] }, direction: { dx: 1, dy: 0 } };
  }
  let target = total / 2;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const segLen = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    if (segLen >= target) {
      const t = segLen === 0 ? 0 : target / segLen;
      return {
        point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
        direction: { dx: b.x - a.x, dy: b.y - a.y },
      };
    }
    target -= segLen;
  }
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  return {
    point: { ...last },
    direction: { dx: last.x - prev.x, dy: last.y - prev.y },
  };
}

// ----- internals -----------------------------------------------------------

function directCandidates(
  sf: RoutePoint,
  fromSide: EndpointSide,
  st: RoutePoint,
  toSide: EndpointSide,
): RoutePoint[][] {
  const cands: RoutePoint[][] = [];
  const fh = isHorizontal(fromSide);
  const th = isHorizontal(toSide);

  if (fh && th) {
    const midX = (sf.x + st.x) / 2;
    cands.push([sf, { x: midX, y: sf.y }, { x: midX, y: st.y }, st]);
    cands.push([sf, { x: st.x, y: sf.y }, st]);
  } else if (!fh && !th) {
    const midY = (sf.y + st.y) / 2;
    cands.push([sf, { x: sf.x, y: midY }, { x: st.x, y: midY }, st]);
    cands.push([sf, { x: sf.x, y: st.y }, st]);
  } else if (fh) {
    cands.push([sf, { x: st.x, y: sf.y }, st]);
    cands.push([sf, { x: sf.x, y: st.y }, st]);
  } else {
    cands.push([sf, { x: sf.x, y: st.y }, st]);
    cands.push([sf, { x: st.x, y: sf.y }, st]);
  }
  return cands;
}

function detourCandidates(
  sf: RoutePoint,
  fromSide: EndpointSide,
  st: RoutePoint,
  toSide: EndpointSide,
  obstacles: RouteRect[],
  detour: number,
): RoutePoint[][] {
  if (obstacles.length === 0) return [];
  const cands: RoutePoint[][] = [];
  const fh = isHorizontal(fromSide);
  const th = isHorizontal(toSide);

  // Horizontal flow → route above / below the union of in-the-way obstacles.
  if (fh && th) {
    const xMin = Math.min(sf.x, st.x);
    const xMax = Math.max(sf.x, st.x);
    const blocking = obstacles.filter((o) => o.x + o.width >= xMin && o.x <= xMax);
    if (blocking.length > 0) {
      const minY = Math.min(...blocking.map((o) => o.y)) - detour;
      const maxY = Math.max(...blocking.map((o) => o.y + o.height)) + detour;
      cands.push([sf, { x: sf.x, y: minY }, { x: st.x, y: minY }, st]);
      cands.push([sf, { x: sf.x, y: maxY }, { x: st.x, y: maxY }, st]);
    }
  }

  // Vertical flow → route left / right of the union.
  if (!fh && !th) {
    const yMin = Math.min(sf.y, st.y);
    const yMax = Math.max(sf.y, st.y);
    const blocking = obstacles.filter((o) => o.y + o.height >= yMin && o.y <= yMax);
    if (blocking.length > 0) {
      const minX = Math.min(...blocking.map((o) => o.x)) - detour;
      const maxX = Math.max(...blocking.map((o) => o.x + o.width)) + detour;
      cands.push([sf, { x: minX, y: sf.y }, { x: minX, y: st.y }, st]);
      cands.push([sf, { x: maxX, y: sf.y }, { x: maxX, y: st.y }, st]);
    }
  }

  // Mixed flow → bend through one extreme of the obstacle union.
  if (fh !== th) {
    const xMin = Math.min(sf.x, st.x);
    const xMax = Math.max(sf.x, st.x);
    const yMin = Math.min(sf.y, st.y);
    const yMax = Math.max(sf.y, st.y);
    const blockingH = obstacles.filter((o) => o.x + o.width >= xMin && o.x <= xMax);
    const blockingV = obstacles.filter((o) => o.y + o.height >= yMin && o.y <= yMax);
    if (blockingH.length > 0) {
      const above = Math.min(...blockingH.map((o) => o.y)) - detour;
      const below = Math.max(...blockingH.map((o) => o.y + o.height)) + detour;
      // From horizontal exit, sweep above/below before approaching target.
      if (fh) {
        cands.push([sf, { x: sf.x, y: above }, { x: st.x, y: above }, st]);
        cands.push([sf, { x: sf.x, y: below }, { x: st.x, y: below }, st]);
      } else {
        cands.push([sf, { x: st.x, y: above }, { x: st.x, y: sf.y }, st]);
        cands.push([sf, { x: st.x, y: below }, { x: st.x, y: sf.y }, st]);
      }
    }
    if (blockingV.length > 0) {
      const leftSide = Math.min(...blockingV.map((o) => o.x)) - detour;
      const rightSide = Math.max(...blockingV.map((o) => o.x + o.width)) + detour;
      if (!fh) {
        cands.push([sf, { x: leftSide, y: sf.y }, { x: leftSide, y: st.y }, st]);
        cands.push([sf, { x: rightSide, y: sf.y }, { x: rightSide, y: st.y }, st]);
      } else {
        cands.push([sf, { x: leftSide, y: sf.y }, { x: leftSide, y: st.y }, st]);
        cands.push([sf, { x: rightSide, y: sf.y }, { x: rightSide, y: st.y }, st]);
      }
    }
  }

  return cands;
}

function stubPoint(p: RoutePoint, side: EndpointSide, stub: number): RoutePoint {
  switch (side) {
    case "top":
      return { x: p.x, y: p.y - stub };
    case "right":
      return { x: p.x + stub, y: p.y };
    case "bottom":
      return { x: p.x, y: p.y + stub };
    case "left":
      return { x: p.x - stub, y: p.y };
  }
}

function isHorizontal(side: EndpointSide): boolean {
  return side === "left" || side === "right";
}

function inflate(r: RouteRect, p: number): RouteRect {
  return { x: r.x - p, y: r.y - p, width: r.width + 2 * p, height: r.height + 2 * p };
}

function pathLength(path: RoutePoint[]): number {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    total += Math.abs(path[i + 1].x - path[i].x) + Math.abs(path[i + 1].y - path[i].y);
  }
  return total;
}

function pathIntersectsAny(path: RoutePoint[], obstacles: RouteRect[]): boolean {
  for (let i = 0; i < path.length - 1; i++) {
    for (const o of obstacles) {
      if (segmentIntersectsRect(path[i], path[i + 1], o)) return true;
    }
  }
  return false;
}

function segmentIntersectsRect(a: RoutePoint, b: RoutePoint, r: RouteRect): boolean {
  const xmin = Math.min(a.x, b.x);
  const xmax = Math.max(a.x, b.x);
  const ymin = Math.min(a.y, b.y);
  const ymax = Math.max(a.y, b.y);
  // Use strict inequalities so a segment that just grazes an inflated edge
  // doesn't count as intersecting.
  if (xmax <= r.x || xmin >= r.x + r.width) return false;
  if (ymax <= r.y || ymin >= r.y + r.height) return false;
  return true;
}

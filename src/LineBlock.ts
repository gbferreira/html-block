import { Block, SVG_NS, type BlockHost, type ConnectorBlock } from "./Block.js";
import type {
  ArrowDirection,
  EndpointSide,
  LineBlockState,
  LineEndpoint,
  RectBlockState,
} from "./types.js";
import {
  pathMidpoint,
  pointsToSvgPath,
  routeOrthogonal,
  type RoutePoint,
} from "./utils/routing.js";

const LABEL_OFFSET = 14;

export class LineBlock extends Block<LineBlockState> implements ConnectorBlock {
  private hitPath!: SVGPathElement;
  private visiblePath!: SVGPathElement;
  private labelText!: SVGTextElement;
  private isSelected = false;

  constructor(state: LineBlockState, host: BlockHost) {
    super(state, host);
  }

  getState(): LineBlockState {
    return {
      ...this.state,
      from: { ...this.state.from },
      to: { ...this.state.to },
    };
  }

  isAnchoredTo(blockId: string): boolean {
    return this.state.from.blockId === blockId || this.state.to.blockId === blockId;
  }

  mount(parent: SVGGElement): void {
    this.group.classList.add("hb-line");
    this.group.dataset.id = this.id;

    this.hitPath = document.createElementNS(SVG_NS, "path");
    this.hitPath.classList.add("hb-line__hit");
    this.hitPath.setAttribute("fill", "none");

    this.visiblePath = document.createElementNS(SVG_NS, "path");
    this.visiblePath.classList.add("hb-line__visible");
    this.visiblePath.setAttribute("fill", "none");

    this.labelText = document.createElementNS(SVG_NS, "text");
    this.labelText.classList.add("hb-line__label");
    this.labelText.setAttribute("text-anchor", "middle");
    this.labelText.setAttribute("dominant-baseline", "hanging");

    this.group.appendChild(this.hitPath);
    this.group.appendChild(this.visiblePath);
    this.group.appendChild(this.labelText);
    parent.appendChild(this.group);

    this.applyState(this.state);
    this.attachInteractions();
  }

  unmount(): void {
    this.group.remove();
  }

  applyState(next: LineBlockState): void {
    this.state = next;
    this.refresh();
  }

  /**
   * Recomputes the rendered route, contouring around any other rect blocks
   * that sit between the source and target endpoints.
   */
  refresh(): void {
    const from = this.resolveEndpoint(this.state.from);
    const to = this.resolveEndpoint(this.state.to);
    const fromSide = this.state.from.side ?? "right";
    const toSide = this.state.to.side ?? "left";
    // Treat every rect block as an obstacle (including the source and target),
    // so the line contours around them. The router still attaches to the
    // chosen endpoint side via a perpendicular stub.
    const obstacles = this.host.getObstacleRects([]);
    const points: RoutePoint[] = routeOrthogonal(from, fromSide, to, toSide, obstacles);
    const d = pointsToSvgPath(points);
    this.visiblePath.setAttribute("d", d);
    this.hitPath.setAttribute("d", d);
    this.visiblePath.setAttribute("stroke", this.state.stroke);
    // Marker shapes use fill="currentColor"; that resolves from the computed
    // `color` property on the referencing path, not from the stroke attribute.
    this.visiblePath.style.color = this.state.stroke;
    this.visiblePath.setAttribute("stroke-width", String(this.state.strokeWidth));
    applyArrowMarkers(this.visiblePath, this.state.arrow);

    const mid = pathMidpoint(points);
    const offset = perpendicularOffset(mid.direction, LABEL_OFFSET);
    this.labelText.setAttribute("x", String(mid.point.x + offset.x));
    this.labelText.setAttribute("y", String(mid.point.y + offset.y));
    this.labelText.style.fontSize = `${this.state.fontSize}px`;
    this.labelText.style.fontFamily = this.state.fontFamily;
    this.labelText.textContent = this.state.text;
  }

  setSelected(selected: boolean): void {
    if (this.isSelected === selected) return;
    this.isSelected = selected;
    this.group.classList.toggle("is-selected", selected);
  }

  setText(text: string): void {
    if (this.state.text === text) return;
    this.state = { ...this.state, text };
    this.refresh();
    this.host.notifyBlockChanged(this.id);
  }

  setArrow(arrow: ArrowDirection): void {
    if (this.state.arrow === arrow) return;
    this.state = { ...this.state, arrow };
    applyArrowMarkers(this.visiblePath, arrow);
    this.host.notifyBlockChanged(this.id);
  }

  setStroke(color: string): void {
    if (this.state.stroke === color) return;
    this.state = { ...this.state, stroke: color };
    this.visiblePath.setAttribute("stroke", color);
    this.visiblePath.style.color = color;
    this.host.notifyBlockChanged(this.id);
  }

  private attachInteractions(): void {
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      this.host.selectBlock(this.id);
    };
    this.hitPath.addEventListener("pointerdown", onPointerDown);
    this.visiblePath.addEventListener("pointerdown", onPointerDown);
    this.labelText.addEventListener("pointerdown", onPointerDown);
  }

  private resolveEndpoint(ep: LineEndpoint): { x: number; y: number } {
    if (ep.blockId) {
      const target = this.host.getBlockState(ep.blockId);
      if (target && target.type === "rect") {
        return endpointForRect(target, ep.side ?? "right");
      }
    }
    return { x: ep.x, y: ep.y };
  }
}

export function endpointForRect(state: RectBlockState, side: EndpointSide): { x: number; y: number } {
  switch (side) {
    case "top":
      return { x: state.x + state.width / 2, y: state.y };
    case "right":
      return { x: state.x + state.width, y: state.y + state.height / 2 };
    case "bottom":
      return { x: state.x + state.width / 2, y: state.y + state.height };
    case "left":
      return { x: state.x, y: state.y + state.height / 2 };
  }
}

export function nearestSide(
  state: RectBlockState,
  point: { x: number; y: number },
): EndpointSide {
  const sides: EndpointSide[] = ["top", "right", "bottom", "left"];
  let best: EndpointSide = "right";
  let bestDist = Infinity;
  for (const side of sides) {
    const p = endpointForRect(state, side);
    const dx = p.x - point.x;
    const dy = p.y - point.y;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      best = side;
    }
  }
  return best;
}

function perpendicularOffset(
  direction: { dx: number; dy: number },
  amount: number,
): { x: number; y: number } {
  const len = Math.hypot(direction.dx, direction.dy) || 1;
  // Unit perpendicular pointing "below" the line (positive y in screen space).
  let nx = -direction.dy / len;
  let ny = direction.dx / len;
  if (ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  return { x: nx * amount, y: ny * amount };
}

function applyArrowMarkers(path: SVGPathElement, arrow: ArrowDirection): void {
  const startUrl = "url(#hb-arrow-start)";
  const endUrl = "url(#hb-arrow-end)";
  switch (arrow) {
    case "ltr":
      path.removeAttribute("marker-start");
      path.setAttribute("marker-end", endUrl);
      break;
    case "rtl":
      path.setAttribute("marker-start", startUrl);
      path.removeAttribute("marker-end");
      break;
    case "both":
      path.setAttribute("marker-start", startUrl);
      path.setAttribute("marker-end", endUrl);
      break;
    case "none":
      path.removeAttribute("marker-start");
      path.removeAttribute("marker-end");
      break;
  }
}

import { Block, SVG_NS, type BlockHost, type ConnectorBlock } from "./Block.js";
import type {
  ArrowDirection,
  EndpointSide,
  LineBlockState,
  LineEndpoint,
  RectBlockState,
} from "./types.js";

const LABEL_OFFSET = 14;

export class LineBlock extends Block<LineBlockState> implements ConnectorBlock {
  private hitLine!: SVGLineElement;
  private visibleLine!: SVGLineElement;
  private labelText!: SVGTextElement;
  private isSelected = false;
  private currentFrom = { x: 0, y: 0 };
  private currentTo = { x: 0, y: 0 };

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

    this.hitLine = document.createElementNS(SVG_NS, "line");
    this.hitLine.classList.add("hb-line__hit");

    this.visibleLine = document.createElementNS(SVG_NS, "line");
    this.visibleLine.classList.add("hb-line__visible");

    this.labelText = document.createElementNS(SVG_NS, "text");
    this.labelText.classList.add("hb-line__label");
    this.labelText.setAttribute("text-anchor", "middle");
    this.labelText.setAttribute("dominant-baseline", "hanging");

    this.group.appendChild(this.hitLine);
    this.group.appendChild(this.visibleLine);
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
   * Recomputes the rendered endpoints from the logical `from`/`to` (which may
   * reference other blocks). Called on every mutation and whenever a
   * connected rect block moves or resizes.
   */
  refresh(): void {
    this.currentFrom = this.resolveEndpoint(this.state.from);
    this.currentTo = this.resolveEndpoint(this.state.to);
    this.visibleLine.setAttribute("x1", String(this.currentFrom.x));
    this.visibleLine.setAttribute("y1", String(this.currentFrom.y));
    this.visibleLine.setAttribute("x2", String(this.currentTo.x));
    this.visibleLine.setAttribute("y2", String(this.currentTo.y));
    this.hitLine.setAttribute("x1", String(this.currentFrom.x));
    this.hitLine.setAttribute("y1", String(this.currentFrom.y));
    this.hitLine.setAttribute("x2", String(this.currentTo.x));
    this.hitLine.setAttribute("y2", String(this.currentTo.y));
    this.visibleLine.setAttribute("stroke", this.state.stroke);
    // `color` is inherited by referenced markers (which use fill="currentColor"),
    // so each line tints its own arrowheads.
    this.visibleLine.setAttribute("color", this.state.stroke);
    this.visibleLine.setAttribute("stroke-width", String(this.state.strokeWidth));
    applyArrowMarkers(this.visibleLine, this.state.arrow);

    const mid = midpoint(this.currentFrom, this.currentTo);
    const offset = perpendicularOffset(this.currentFrom, this.currentTo, LABEL_OFFSET);
    const labelX = mid.x + offset.x;
    const labelY = mid.y + offset.y;
    this.labelText.setAttribute("x", String(labelX));
    this.labelText.setAttribute("y", String(labelY));
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
    applyArrowMarkers(this.visibleLine, arrow);
    this.host.notifyBlockChanged(this.id);
  }

  setStroke(color: string): void {
    if (this.state.stroke === color) return;
    this.state = { ...this.state, stroke: color };
    this.visibleLine.setAttribute("stroke", color);
    this.visibleLine.setAttribute("color", color);
    this.host.notifyBlockChanged(this.id);
  }

  private attachInteractions(): void {
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      this.host.selectBlock(this.id);
    };
    this.hitLine.addEventListener("pointerdown", onPointerDown);
    this.visibleLine.addEventListener("pointerdown", onPointerDown);
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

function midpoint(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function perpendicularOffset(
  a: { x: number; y: number },
  b: { x: number; y: number },
  amount: number,
): { x: number; y: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // Unit perpendicular pointing "below" the line in screen-space (positive y).
  // Rotate (dx,dy) by +90deg => (-dy, dx). Pick the variant with positive y.
  let nx = -dy / len;
  let ny = dx / len;
  if (ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  return { x: nx * amount, y: ny * amount };
}

function applyArrowMarkers(line: SVGLineElement, arrow: ArrowDirection): void {
  const startUrl = "url(#hb-arrow-start)";
  const endUrl = "url(#hb-arrow-end)";
  switch (arrow) {
    case "ltr":
      line.removeAttribute("marker-start");
      line.setAttribute("marker-end", endUrl);
      break;
    case "rtl":
      line.setAttribute("marker-start", startUrl);
      line.removeAttribute("marker-end");
      break;
    case "both":
      line.setAttribute("marker-start", startUrl);
      line.setAttribute("marker-end", endUrl);
      break;
    case "none":
      line.removeAttribute("marker-start");
      line.removeAttribute("marker-end");
      break;
  }
}

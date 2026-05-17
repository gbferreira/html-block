import { Block, SVG_NS, type BlockHost, type BoxBlock } from "./Block.js";
import type { EndpointSide, RectBlockState } from "./types.js";

const HANDLE_SIZE = 8;
const HANDLE_KEYS = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
type HandleKey = (typeof HANDLE_KEYS)[number];

const CONNECTION_KEYS: EndpointSide[] = ["top", "right", "bottom", "left"];
const CONNECTION_RADIUS = 5;

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
}

interface ResizeState {
  pointerId: number;
  handle: HandleKey;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
}

export class RectBlock extends Block<RectBlockState> implements BoxBlock {
  private rect!: SVGRectElement;
  private foreign!: SVGForeignObjectElement;
  private textDiv!: HTMLDivElement;
  private selectionRect: SVGRectElement | null = null;
  private handleEls: Partial<Record<HandleKey, SVGRectElement>> = {};
  private connectionEls: Partial<Record<EndpointSide, SVGCircleElement>> = {};
  private isSelected = false;
  private isEditingText = false;
  private dragState: DragState | null = null;
  private resizeState: ResizeState | null = null;

  constructor(state: RectBlockState, host: BlockHost) {
    super(state, host);
  }

  getState(): RectBlockState {
    return { ...this.state, border: { ...this.state.border } };
  }

  getRectState(): RectBlockState {
    return this.getState();
  }

  setFill(fill: string): void {
    if (this.state.fill === fill) return;
    this.state = { ...this.state, fill };
    this.applyState(this.state);
    this.host.notifyBlockChanged(this.id);
  }

  setFontSize(size: number): void {
    if (this.state.fontSize === size) return;
    this.state = { ...this.state, fontSize: size };
    this.applyState(this.state);
    this.host.notifyBlockChanged(this.id);
  }

  setText(text: string): void {
    if (this.state.text === text) return;
    this.state = { ...this.state, text };
    this.applyState(this.state);
    this.host.notifyBlockChanged(this.id);
  }

  mount(parent: SVGGElement): void {
    this.rect = document.createElementNS(SVG_NS, "rect");
    this.rect.classList.add("hb-block__rect");
    this.rect.setAttribute("rx", "4");
    this.rect.setAttribute("ry", "4");

    this.foreign = document.createElementNS(SVG_NS, "foreignObject");
    this.foreign.setAttribute("x", "0");
    this.foreign.setAttribute("y", "0");

    this.textDiv = document.createElement("div");
    this.textDiv.className = "hb-block__text";
    this.textDiv.setAttribute("contenteditable", "false");
    this.textDiv.spellcheck = false;
    this.foreign.appendChild(this.textDiv);

    this.group.appendChild(this.rect);
    this.group.appendChild(this.foreign);
    parent.appendChild(this.group);

    this.applyState(this.state);
    this.attachInteractions();
  }

  unmount(): void {
    this.removeSelectionVisuals();
    this.group.remove();
  }

  applyState(next: RectBlockState): void {
    this.state = next;
    this.group.setAttribute("transform", `translate(${next.x} ${next.y})`);
    this.rect.setAttribute("width", String(next.width));
    this.rect.setAttribute("height", String(next.height));
    this.rect.setAttribute("fill", next.fill);
    this.rect.setAttribute("stroke", next.border.color);
    this.rect.setAttribute("stroke-width", String(next.border.width));
    this.foreign.setAttribute("width", String(next.width));
    this.foreign.setAttribute("height", String(next.height));
    this.textDiv.style.fontSize = `${next.fontSize}px`;
    this.textDiv.style.fontFamily = next.fontFamily;
    if (!this.isEditingText && this.textDiv.textContent !== next.text) {
      this.textDiv.textContent = next.text;
    }
    if (this.isSelected) this.updateSelectionVisuals();
  }

  setSelected(selected: boolean): void {
    if (this.isSelected === selected) return;
    this.isSelected = selected;
    if (selected) {
      this.ensureSelectionVisuals();
      this.updateSelectionVisuals();
    } else {
      this.removeSelectionVisuals();
      this.exitTextEdit(false);
    }
  }

  private attachInteractions(): void {
    this.group.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if (this.isEditingText) return;
      const target = event.target as Element | null;
      if (target?.classList.contains("hb-handle")) return;
      if (target?.classList.contains("hb-conn")) return;
      event.stopPropagation();
      this.host.selectBlock(this.id);
      this.startDrag(event);
    });

    this.group.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      this.enterTextEdit();
    });

    this.textDiv.addEventListener("blur", () => {
      this.exitTextEdit(true);
    });
    this.textDiv.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        this.exitTextEdit(true);
      }
    });
  }

  private startDrag(event: PointerEvent): void {
    const board = this.host.clientToBoard(event.clientX, event.clientY);
    this.dragState = {
      pointerId: event.pointerId,
      startX: board.x,
      startY: board.y,
      origX: this.state.x,
      origY: this.state.y,
    };
    this.group.setPointerCapture(event.pointerId);

    const onMove = (e: PointerEvent) => {
      if (!this.dragState || e.pointerId !== this.dragState.pointerId) return;
      const cur = this.host.clientToBoard(e.clientX, e.clientY);
      const dx = cur.x - this.dragState.startX;
      const dy = cur.y - this.dragState.startY;
      const nextX = Math.max(0, this.dragState.origX + dx);
      const nextY = Math.max(0, this.dragState.origY + dy);
      this.state = { ...this.state, x: nextX, y: nextY };
      this.group.setAttribute("transform", `translate(${nextX} ${nextY})`);
      if (this.isSelected) this.updateSelectionVisuals();
      this.host.requestGrow(nextX + this.state.width, nextY + this.state.height);
      this.host.notifyBlockChanged(this.id);
    };
    const onUp = (e: PointerEvent) => {
      if (!this.dragState || e.pointerId !== this.dragState.pointerId) return;
      try {
        this.group.releasePointerCapture(this.dragState.pointerId);
      } catch {
        // ignore — capture may already be released
      }
      this.dragState = null;
      this.group.removeEventListener("pointermove", onMove);
      this.group.removeEventListener("pointerup", onUp);
      this.group.removeEventListener("pointercancel", onUp);
      this.host.notifyBlockChanged(this.id);
    };
    this.group.addEventListener("pointermove", onMove);
    this.group.addEventListener("pointerup", onUp);
    this.group.addEventListener("pointercancel", onUp);
  }

  private ensureSelectionVisuals(): void {
    if (this.selectionRect) return;
    this.selectionRect = document.createElementNS(SVG_NS, "rect");
    this.selectionRect.classList.add("hb-block__selection");
    this.group.appendChild(this.selectionRect);
    for (const key of HANDLE_KEYS) {
      const h = document.createElementNS(SVG_NS, "rect");
      h.classList.add("hb-handle", `hb-handle--${key}`);
      h.setAttribute("width", String(HANDLE_SIZE));
      h.setAttribute("height", String(HANDLE_SIZE));
      h.dataset.handle = key;
      this.attachHandleInteractions(h, key);
      this.group.appendChild(h);
      this.handleEls[key] = h;
    }
    for (const side of CONNECTION_KEYS) {
      const c = document.createElementNS(SVG_NS, "circle");
      c.classList.add("hb-conn", `hb-conn--${side}`);
      c.setAttribute("r", String(CONNECTION_RADIUS));
      c.dataset.side = side;
      this.attachConnectionInteractions(c, side);
      this.group.appendChild(c);
      this.connectionEls[side] = c;
    }
  }

  private removeSelectionVisuals(): void {
    if (this.selectionRect) {
      this.selectionRect.remove();
      this.selectionRect = null;
    }
    for (const key of HANDLE_KEYS) {
      this.handleEls[key]?.remove();
      this.handleEls[key] = undefined;
    }
    for (const side of CONNECTION_KEYS) {
      this.connectionEls[side]?.remove();
      this.connectionEls[side] = undefined;
    }
  }

  private updateSelectionVisuals(): void {
    if (!this.selectionRect) return;
    const w = this.state.width;
    const h = this.state.height;
    this.selectionRect.setAttribute("x", "-1");
    this.selectionRect.setAttribute("y", "-1");
    this.selectionRect.setAttribute("width", String(w + 2));
    this.selectionRect.setAttribute("height", String(h + 2));

    const positions: Record<HandleKey, { x: number; y: number }> = {
      nw: { x: 0, y: 0 },
      n: { x: w / 2, y: 0 },
      ne: { x: w, y: 0 },
      e: { x: w, y: h / 2 },
      se: { x: w, y: h },
      s: { x: w / 2, y: h },
      sw: { x: 0, y: h },
      w: { x: 0, y: h / 2 },
    };
    const half = HANDLE_SIZE / 2;
    for (const key of HANDLE_KEYS) {
      const el = this.handleEls[key];
      if (!el) continue;
      const p = positions[key];
      el.setAttribute("x", String(p.x - half));
      el.setAttribute("y", String(p.y - half));
    }
    const connPositions: Record<EndpointSide, { x: number; y: number }> = {
      top: { x: w / 2, y: 0 },
      right: { x: w, y: h / 2 },
      bottom: { x: w / 2, y: h },
      left: { x: 0, y: h / 2 },
    };
    for (const side of CONNECTION_KEYS) {
      const el = this.connectionEls[side];
      if (!el) continue;
      const p = connPositions[side];
      el.setAttribute("cx", String(p.x));
      el.setAttribute("cy", String(p.y));
    }
  }

  private attachHandleInteractions(el: SVGRectElement, key: HandleKey): void {
    el.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      event.preventDefault();
      const board = this.host.clientToBoard(event.clientX, event.clientY);
      this.resizeState = {
        pointerId: event.pointerId,
        handle: key,
        startX: board.x,
        startY: board.y,
        origX: this.state.x,
        origY: this.state.y,
        origW: this.state.width,
        origH: this.state.height,
      };
      el.setPointerCapture(event.pointerId);

      const onMove = (e: PointerEvent) => {
        if (!this.resizeState || e.pointerId !== this.resizeState.pointerId) return;
        const cur = this.host.clientToBoard(e.clientX, e.clientY);
        const dx = cur.x - this.resizeState.startX;
        const dy = cur.y - this.resizeState.startY;
        const next = computeResize(this.resizeState, dx, dy, this.host.config.minBlockSize);
        this.state = { ...this.state, ...next };
        this.applyStateNoNotify();
        this.host.requestGrow(next.x + next.width, next.y + next.height);
        this.host.notifyBlockChanged(this.id);
      };
      const onUp = (e: PointerEvent) => {
        if (!this.resizeState || e.pointerId !== this.resizeState.pointerId) return;
        try {
          el.releasePointerCapture(this.resizeState.pointerId);
        } catch {
          // ignore
        }
        this.resizeState = null;
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.removeEventListener("pointercancel", onUp);
        this.host.notifyBlockChanged(this.id);
      };
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);
    });
  }

  private attachConnectionInteractions(el: SVGCircleElement, side: EndpointSide): void {
    el.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      event.preventDefault();
      this.host.startConnectionDrag(this.id, side, event);
    });
  }

  /** Like applyState but skips storage notification (used during drag/resize). */
  private applyStateNoNotify(): void {
    this.group.setAttribute("transform", `translate(${this.state.x} ${this.state.y})`);
    this.rect.setAttribute("width", String(this.state.width));
    this.rect.setAttribute("height", String(this.state.height));
    this.foreign.setAttribute("width", String(this.state.width));
    this.foreign.setAttribute("height", String(this.state.height));
    if (this.isSelected) this.updateSelectionVisuals();
  }

  private enterTextEdit(): void {
    if (this.isEditingText) return;
    this.isEditingText = true;
    this.textDiv.setAttribute("contenteditable", "true");
    this.textDiv.focus();
    const range = document.createRange();
    range.selectNodeContents(this.textDiv);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  private exitTextEdit(commit: boolean): void {
    if (!this.isEditingText) return;
    this.isEditingText = false;
    this.textDiv.setAttribute("contenteditable", "false");
    if (commit) {
      const text = this.textDiv.textContent ?? "";
      if (text !== this.state.text) {
        this.state = { ...this.state, text };
        this.host.notifyBlockChanged(this.id);
      }
    } else {
      this.textDiv.textContent = this.state.text;
    }
  }
}

function computeResize(
  start: ResizeState,
  dx: number,
  dy: number,
  min: { width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  let x = start.origX;
  let y = start.origY;
  let width = start.origW;
  let height = start.origH;

  if (start.handle.includes("e")) {
    width = Math.max(min.width, start.origW + dx);
  }
  if (start.handle.includes("s")) {
    height = Math.max(min.height, start.origH + dy);
  }
  if (start.handle.includes("w")) {
    const newW = Math.max(min.width, start.origW - dx);
    x = start.origX + (start.origW - newW);
    width = newW;
  }
  if (start.handle.includes("n")) {
    const newH = Math.max(min.height, start.origH - dy);
    y = start.origY + (start.origH - newH);
    height = newH;
  }
  if (x < 0) {
    width = Math.max(min.width, width + x);
    x = 0;
  }
  if (y < 0) {
    height = Math.max(min.height, height + y);
    y = 0;
  }
  return { x, y, width, height };
}

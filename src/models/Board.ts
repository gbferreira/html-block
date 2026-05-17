import { SVG_NS, type Block, type BlockHost, type ConnectorBlock } from "./Block.js";
import { RectBlock } from "./RectBlock.js";
import { LineBlock, endpointForRect, nearestSide } from "./LineBlock.js";
import { resolveConfig } from "../common/config.js";
import { ContextMenu } from "../common/ContextMenu.js";
import { ColorPopover } from "../common/ColorPopover.js";
import { Inspector, type InspectorTarget } from "../common/Inspector.js";
import { DebouncedStorage, LocalStorageAdapter } from "../common/storage.js";
import { injectStyles } from "../styles/injectStyles.js";
import { rasterizeSvg, serializeSvg } from "../common/png.js";
import type {
  ArrowDirection,
  BlockState,
  BoardConfig,
  BoardEvent,
  BoardEventListener,
  BoardSize,
  BoardState,
  EndpointSide,
  LineBlockState,
  LineEndpoint,
  PanOffset,
  RectBlockState,
  ResolvedBoardConfig,
  StateStorage,
} from "../common/types.js";
import type { RouteRect } from "../common/routing.js";

export interface AddRectOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  fill?: string;
  fontSize?: number;
}

export interface AddLineOptions {
  from: LineEndpointInput;
  to: LineEndpointInput;
  text?: string;
  arrow?: ArrowDirection;
  stroke?: string;
  strokeWidth?: number;
  fontSize?: number;
}

export type LineEndpointInput =
  | { blockId: string; side: EndpointSide; x?: number; y?: number }
  | { blockId: null; x: number; y: number };

const PAN_THRESHOLD = 4;
const CONNECTION_DROP_RADIUS = 12;

let blockIdCounter = 0;
function nextId(): string {
  blockIdCounter += 1;
  return `b_${Date.now().toString(36)}_${blockIdCounter}`;
}

export class Board implements BlockHost {
  readonly config: ResolvedBoardConfig;
  private container: HTMLDivElement;
  private svg: SVGSVGElement;
  private defs: SVGDefsElement;
  private bgRect: SVGRectElement;
  private blocksLayer: SVGGElement;
  private blocks: Block[] = [];
  private blockIndex = new Map<string, Block>();
  private size: BoardSize;
  private pan: PanOffset = { x: 0, y: 0 };
  private backgroundColor: string;
  private selectedId: string | null = null;
  private listeners = new Set<BoardEventListener>();
  private menu: ContextMenu;
  private inspector: Inspector;
  private bgPopover: ColorPopover;
  private storage: StateStorage;
  private debouncedStorage: DebouncedStorage;
  private destroyed = false;
  private keyHandler = (event: KeyboardEvent) => this.onKeyDown(event);
  private hostMouseDown = (event: MouseEvent) => this.onHostMouseDown(event);
  private lastMenuBoardPos: { x: number; y: number } | null = null;
  private connDrag: ConnDragState | null = null;

  constructor(target: HTMLElement, config: BoardConfig = {}) {
    this.config = resolveConfig(config);
    this.size = { ...this.config.initialSize };
    this.backgroundColor = this.config.defaultBackgroundColor;

    injectStyles(target.ownerDocument ?? document);

    this.container = (target.ownerDocument ?? document).createElement("div");
    this.container.className = "hb-board";
    if (this.config.className) this.container.classList.add(this.config.className);
    target.appendChild(this.container);

    this.svg = document.createElementNS(SVG_NS, "svg");
    this.svg.classList.add("hb-board__svg");
    this.svg.setAttribute("xmlns", SVG_NS);
    this.container.appendChild(this.svg);

    this.defs = document.createElementNS(SVG_NS, "defs");
    this.svg.appendChild(this.defs);

    this.bgRect = document.createElementNS(SVG_NS, "rect");
    this.bgRect.classList.add("hb-board__bg");
    this.svg.appendChild(this.bgRect);

    this.blocksLayer = document.createElementNS(SVG_NS, "g");
    this.blocksLayer.classList.add("hb-board__blocks");
    this.svg.appendChild(this.blocksLayer);

    this.applySize();

    this.menu = new ContextMenu(this.container);
    this.menu.setItems([
      {
        id: "add-rect",
        label: "Add rectangle",
        onSelect: () => {
          if (this.lastMenuBoardPos) {
            this.addRect({ x: this.lastMenuBoardPos.x, y: this.lastMenuBoardPos.y });
          } else {
            this.addRect();
          }
        },
      },
    ]);

    this.inspector = new Inspector(this.container, this.config, {
      onFontSizeChange: (size) => {
        const block = this.selectedBlock();
        if (!block) return;
        if (block instanceof RectBlock) block.setFontSize(size);
        else if (block instanceof LineBlock) {
          const state = { ...block.getState(), fontSize: size };
          block.applyState(state);
          this.notifyBlockChanged(block.id);
        }
      },
      onFillChange: (color) => {
        const block = this.selectedBlock();
        if (block instanceof RectBlock) block.setFill(color);
      },
      onLineTextChange: (text) => {
        const block = this.selectedBlock();
        if (block instanceof LineBlock) block.setText(text);
      },
      onArrowChange: (direction) => {
        const block = this.selectedBlock();
        if (block instanceof LineBlock) block.setArrow(direction);
      },
      onStrokeChange: (color) => {
        const block = this.selectedBlock();
        if (block instanceof LineBlock) block.setStroke(color);
      },
      onDelete: () => {
        if (this.selectedId) this.removeBlock(this.selectedId);
      },
    });

    this.bgPopover = new ColorPopover(this.container);

    this.storage = this.config.storage ?? new LocalStorageAdapter();
    this.debouncedStorage = new DebouncedStorage(this.storage);

    this.attachInteractions();
    this.loadFromStorage();
  }

  // ---------- public API -------------------------------------------------

  addBlock(state: BlockState): BlockState {
    const block = this.instantiate(state);
    this.blocks.push(block);
    this.blockIndex.set(block.id, block);
    block.mount(this.blocksLayer);
    if (state.type === "rect") {
      this.requestGrow(state.x + state.width, state.y + state.height);
    }
    this.emit({ type: "block:add", block: state });
    this.persist();
    return state;
  }

  addRect(opts: AddRectOptions = {}): RectBlockState {
    const initial: RectBlockState = {
      id: nextId(),
      type: "rect",
      x: opts.x ?? 40,
      y: opts.y ?? 40,
      width: opts.width ?? 160,
      height: opts.height ?? 90,
      text: opts.text ?? "",
      fill: opts.fill ?? this.config.defaultColor,
      border: { ...this.config.border },
      fontSize: opts.fontSize ?? this.config.defaultFontSize,
      fontFamily: this.config.fontFamily,
    };
    return this.addBlock(initial) as RectBlockState;
  }

  addLine(opts: AddLineOptions): LineBlockState {
    const from = this.resolveEndpointInput(opts.from);
    const to = this.resolveEndpointInput(opts.to);
    const initial: LineBlockState = {
      id: nextId(),
      type: "line",
      from,
      to,
      arrow: opts.arrow ?? this.config.defaultArrow,
      stroke: opts.stroke ?? this.config.defaultLineColor,
      strokeWidth: opts.strokeWidth ?? this.config.defaultLineWidth,
      text: opts.text ?? "",
      fontSize: opts.fontSize ?? this.config.defaultFontSize,
      fontFamily: this.config.fontFamily,
    };
    return this.addBlock(initial) as LineBlockState;
  }

  removeBlock(id: string): void {
    const block = this.blockIndex.get(id);
    if (!block) return;
    block.unmount();
    this.blockIndex.delete(id);
    this.blocks = this.blocks.filter((b) => b.id !== id);
    if (this.selectedId === id) this.selectBlock(null);
    // Cascade: also remove lines anchored to a removed rect.
    if (block instanceof RectBlock) {
      const orphans = this.blocks.filter(
        (b) => b instanceof LineBlock && (b as LineBlock).isAnchoredTo(id),
      );
      for (const o of orphans) {
        o.unmount();
        this.blockIndex.delete(o.id);
        this.blocks = this.blocks.filter((b) => b.id !== o.id);
        this.emit({ type: "block:remove", id: o.id });
      }
    }
    this.emit({ type: "block:remove", id });
    this.persist();
  }

  getState(): BoardState {
    return {
      version: 1,
      size: { ...this.size },
      pan: { ...this.pan },
      backgroundColor: this.backgroundColor,
      blocks: this.blocks.map((b) => b.getState()),
    };
  }

  loadState(state: BoardState): void {
    for (const block of this.blocks) block.unmount();
    this.blocks = [];
    this.blockIndex.clear();
    this.selectedId = null;
    this.size = { ...state.size };
    this.pan = state.pan ? { ...state.pan } : { x: 0, y: 0 };
    this.backgroundColor = state.backgroundColor ?? this.config.defaultBackgroundColor;
    this.applySize();
    for (const blockState of state.blocks) {
      const block = this.instantiate(blockState);
      this.blocks.push(block);
      this.blockIndex.set(block.id, block);
      block.mount(this.blocksLayer);
    }
    this.refreshAllConnectors();
    this.emit({ type: "state:change", state: this.getState() });
    this.persist();
  }

  exportSVG(): string {
    return serializeSvg(this.svg);
  }

  exportPNG(options: { background?: string } = {}): Promise<Blob> {
    return rasterizeSvg(this.svg, {
      width: this.size.width,
      height: this.size.height,
      background: options.background ?? this.backgroundColor,
    });
  }

  on(listener: BoardEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Persist current state to storage immediately (bypass debounce coalescing). */
  save(): void {
    if (this.destroyed) return;
    this.persist();
    this.debouncedStorage.flush();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.debouncedStorage.flush();
    this.menu.destroy();
    this.inspector.destroy();
    this.bgPopover.destroy();
    this.container.remove();
    document.removeEventListener("keydown", this.keyHandler);
    document.removeEventListener("mousedown", this.hostMouseDown, true);
  }

  // ---------- BlockHost --------------------------------------------------

  clientToBoard(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.svg.getBoundingClientRect();
    const sx = rect.width === 0 ? 1 : this.size.width / rect.width;
    const sy = rect.height === 0 ? 1 : this.size.height / rect.height;
    return {
      x: this.pan.x + (clientX - rect.left) * sx,
      y: this.pan.y + (clientY - rect.top) * sy,
    };
  }

  notifyBlockChanged(id: string): void {
    const block = this.blockIndex.get(id);
    if (!block) return;
    if (block instanceof RectBlock) {
      // Any rect mutation can change endpoints (anchored lines) AND the
      // obstacle set (so other lines may re-route). Refresh every line.
      for (const b of this.blocks) {
        if (b instanceof LineBlock) b.refresh();
      }
    }
    this.emit({ type: "block:update", block: block.getState() });
    this.persist();
    this.repositionInspector();
  }

  selectBlock(id: string | null): void {
    if (this.selectedId === id) {
      this.repositionInspector();
      return;
    }
    if (this.selectedId) {
      const prev = this.blockIndex.get(this.selectedId);
      prev?.setSelected(false);
    }
    this.selectedId = id;
    if (id) {
      const block = this.blockIndex.get(id);
      if (block) {
        block.setSelected(true);
        this.showInspectorFor(block);
      }
    } else {
      this.inspector.hide();
    }
    this.emit({ type: "block:select", id });
  }

  requestGrow(right: number, bottom: number): void {
    let grew = false;
    while (right + 8 > this.size.width) {
      this.size = { ...this.size, width: this.size.width + this.config.growStep };
      grew = true;
    }
    while (bottom + 8 > this.size.height) {
      this.size = { ...this.size, height: this.size.height + this.config.growStep };
      grew = true;
    }
    if (grew) this.applySize();
  }

  getBlockState(id: string): BlockState | undefined {
    return this.blockIndex.get(id)?.getState();
  }

  getObstacleRects(excludeIds: ReadonlyArray<string>): RouteRect[] {
    const exclude = new Set(excludeIds);
    const out: RouteRect[] = [];
    for (const b of this.blocks) {
      if (!(b instanceof RectBlock)) continue;
      if (exclude.has(b.id)) continue;
      const s = b.getRectState();
      out.push({ x: s.x, y: s.y, width: s.width, height: s.height });
    }
    return out;
  }

  getSvgDefs(): SVGDefsElement {
    return this.defs;
  }

  startConnectionDrag(fromBlockId: string, side: EndpointSide, event: PointerEvent): void {
    const fromBlock = this.blockIndex.get(fromBlockId);
    if (!(fromBlock instanceof RectBlock)) return;
    const sourceState = fromBlock.getRectState();
    const start = endpointForRect(sourceState, side);
    const cur = this.clientToBoard(event.clientX, event.clientY);

    const preview = document.createElementNS(SVG_NS, "line");
    preview.classList.add("hb-line", "hb-line--preview");
    preview.setAttribute("x1", String(start.x));
    preview.setAttribute("y1", String(start.y));
    preview.setAttribute("x2", String(cur.x));
    preview.setAttribute("y2", String(cur.y));
    this.svg.appendChild(preview);

    this.connDrag = {
      pointerId: event.pointerId,
      fromBlockId,
      fromSide: side,
      startBoard: start,
      lastBoard: cur,
    };
    try {
      this.svg.setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }

    const onMove = (e: PointerEvent) => {
      if (!this.connDrag || e.pointerId !== this.connDrag.pointerId) return;
      const p = this.clientToBoard(e.clientX, e.clientY);
      this.connDrag.lastBoard = p;
      preview.setAttribute("x2", String(p.x));
      preview.setAttribute("y2", String(p.y));
    };
    const onUp = (e: PointerEvent) => {
      if (!this.connDrag || e.pointerId !== this.connDrag.pointerId) return;
      try {
        this.svg.releasePointerCapture(this.connDrag.pointerId);
      } catch {
        // ignore
      }
      this.svg.removeEventListener("pointermove", onMove);
      this.svg.removeEventListener("pointerup", onUp);
      this.svg.removeEventListener("pointercancel", onUp);
      const drop = this.clientToBoard(e.clientX, e.clientY);
      const target = this.findRectAtBoardPoint(drop, this.connDrag.fromBlockId);
      preview.remove();
      const drag = this.connDrag;
      this.connDrag = null;
      if (!drag || !target) return;
      const targetSide = nearestSide(target, drop);
      this.addLine({
        from: { blockId: drag.fromBlockId, side: drag.fromSide },
        to: { blockId: target.id, side: targetSide },
      });
    };
    this.svg.addEventListener("pointermove", onMove);
    this.svg.addEventListener("pointerup", onUp);
    this.svg.addEventListener("pointercancel", onUp);
  }

  // ---------- internals --------------------------------------------------

  private selectedBlock(): Block | null {
    return (this.selectedId && this.blockIndex.get(this.selectedId)) || null;
  }

  private attachInteractions(): void {
    this.svg.addEventListener("contextmenu", (event) => {
      const target = event.target as Element | null;
      const isBackground =
        target === this.svg || target === this.bgRect || target === this.blocksLayer;
      if (!isBackground) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      this.selectBlock(null);
      const hostRect = this.container.getBoundingClientRect();
      this.bgPopover.open(event.clientX - hostRect.left, event.clientY - hostRect.top, {
        title: "Background color",
        colors: this.config.backgroundColors,
        current: this.backgroundColor,
        onPick: (color) => this.setBackgroundColor(color),
      });
    });

    this.svg.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if (this.connDrag) return;
      const target = event.target as Element | null;
      const isBackground =
        target === this.svg || target === this.bgRect || target === this.blocksLayer;
      if (!isBackground) return;
      this.beginBackgroundInteraction(event);
    });

    document.addEventListener("keydown", this.keyHandler);
    document.addEventListener("mousedown", this.hostMouseDown, true);
    this.container.addEventListener("scroll", () => this.repositionInspector());
  }

  private beginBackgroundInteraction(event: PointerEvent): void {
    this.selectBlock(null);
    // If the toolbox is open, the first background pointerdown closes it; the
    // same gesture's pointerup must not reopen (outside mousedown also closes,
    // which would leave isOpen false and cause an unwanted reopen).
    const skipToolboxOpen = this.menu.isOpen();
    if (skipToolboxOpen) {
      this.menu.close();
    }
    const startClientX = event.clientX;
    const startClientY = event.clientY;
    const startPan = { ...this.pan };
    let exceeded = false;
    let cancelled = false;
    try {
      this.svg.setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }

    const rect = this.svg.getBoundingClientRect();
    const sx = rect.width === 0 ? 1 : this.size.width / rect.width;
    const sy = rect.height === 0 ? 1 : this.size.height / rect.height;

    const onMove = (e: PointerEvent) => {
      if (cancelled || e.pointerId !== event.pointerId) return;
      const dx = e.clientX - startClientX;
      const dy = e.clientY - startClientY;
      if (!exceeded && Math.hypot(dx, dy) > PAN_THRESHOLD) {
        exceeded = true;
        this.svg.classList.add("is-panning");
      }
      if (exceeded) {
        this.pan = {
          x: Math.max(0, startPan.x - dx * sx),
          y: Math.max(0, startPan.y - dy * sy),
        };
        this.applySize();
        this.repositionInspector();
      }
    };
    const onUp = (e: PointerEvent) => {
      if (cancelled || e.pointerId !== event.pointerId) return;
      cancelled = true;
      try {
        this.svg.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
      this.svg.removeEventListener("pointermove", onMove);
      this.svg.removeEventListener("pointerup", onUp);
      this.svg.removeEventListener("pointercancel", onUp);
      this.svg.classList.remove("is-panning");
      if (exceeded) {
        // Pan ended; persist new pan.
        this.persist();
      } else if (!skipToolboxOpen) {
        // Short left-button gesture on empty board → toolbox (add items).
        const board = this.clientToBoard(e.clientX, e.clientY);
        this.lastMenuBoardPos = board;
        const hostRect = this.container.getBoundingClientRect();
        this.menu.open(e.clientX - hostRect.left, e.clientY - hostRect.top);
      }
    };
    this.svg.addEventListener("pointermove", onMove);
    this.svg.addEventListener("pointerup", onUp);
    this.svg.addEventListener("pointercancel", onUp);
  }

  private setBackgroundColor(color: string): void {
    if (this.backgroundColor === color) return;
    this.backgroundColor = color;
    this.bgRect.setAttribute("fill", color);
    this.persist();
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (this.destroyed) return;
    const target = event.target as HTMLElement | null;
    if (target && target.isContentEditable) return;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      if (this.selectedId) {
        event.preventDefault();
        this.removeBlock(this.selectedId);
      }
    } else if (event.key === "Escape") {
      this.selectBlock(null);
    }
  }

  private onHostMouseDown(event: MouseEvent): void {
    if (this.destroyed) return;
    const node = event.target as Node | null;
    if (!node) return;
    if (this.container.contains(node)) return;
    this.selectBlock(null);
  }

  private resolveEndpointInput(input: LineEndpointInput): LineEndpoint {
    if (input.blockId !== null) {
      const target = this.blockIndex.get(input.blockId);
      if (target instanceof RectBlock) {
        const side = input.side;
        const point = endpointForRect(target.getRectState(), side);
        return { blockId: input.blockId, side, x: point.x, y: point.y };
      }
      return { blockId: input.blockId, side: input.side, x: input.x ?? 0, y: input.y ?? 0 };
    }
    return { blockId: null, x: input.x, y: input.y };
  }

  private findRectAtBoardPoint(
    point: { x: number; y: number },
    excludeId: string,
  ): RectBlockState | null {
    for (let i = this.blocks.length - 1; i >= 0; i--) {
      const b = this.blocks[i];
      if (!(b instanceof RectBlock)) continue;
      if (b.id === excludeId) continue;
      const s = b.getRectState();
      if (
        point.x >= s.x - CONNECTION_DROP_RADIUS &&
        point.x <= s.x + s.width + CONNECTION_DROP_RADIUS &&
        point.y >= s.y - CONNECTION_DROP_RADIUS &&
        point.y <= s.y + s.height + CONNECTION_DROP_RADIUS
      ) {
        return s;
      }
    }
    return null;
  }

  private instantiate(state: BlockState): Block {
    if (state.type === "rect") return new RectBlock(state, this);
    if (state.type === "line") return new LineBlock(state, this);
    throw new Error(`Unsupported block type: ${String((state as BlockState).type)}`);
  }

  private applySize(): void {
    this.svg.setAttribute("width", String(this.size.width));
    this.svg.setAttribute("height", String(this.size.height));
    this.svg.setAttribute(
      "viewBox",
      `${this.pan.x} ${this.pan.y} ${this.size.width} ${this.size.height}`,
    );
    this.bgRect.setAttribute("x", String(this.pan.x));
    this.bgRect.setAttribute("y", String(this.pan.y));
    this.bgRect.setAttribute("width", String(this.size.width));
    this.bgRect.setAttribute("height", String(this.size.height));
    this.bgRect.setAttribute("fill", this.backgroundColor);
  }

  private emit(event: BoardEvent): void {
    for (const l of this.listeners) {
      try {
        l(event);
      } catch (err) {
        console.error("[html-block] board listener threw", err);
      }
    }
  }

  private persist(): void {
    const state = this.getState();
    this.debouncedStorage.save(this.config.storageKey, state);
    this.emit({ type: "state:change", state });
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const loaded = await Promise.resolve(this.storage.load(this.config.storageKey));
      if (this.destroyed) return;
      if (!loaded) {
        this.persist();
        return;
      }
      this.loadState(loaded);
    } catch (err) {
      console.error("[html-block] failed to load board state", err);
    }
  }

  private refreshAllConnectors(): void {
    for (const b of this.blocks) {
      if ((b as unknown as ConnectorBlock).refresh && (b as unknown as ConnectorBlock).isAnchoredTo) {
        (b as unknown as ConnectorBlock).refresh();
      }
    }
  }

  private showInspectorFor(block: Block): void {
    const hostRect = this.container.getBoundingClientRect();
    const svgRect = this.svg.getBoundingClientRect();
    const sx = this.size.width === 0 ? 1 : svgRect.width / this.size.width;
    const sy = this.size.height === 0 ? 1 : svgRect.height / this.size.height;
    const state = block.getState();

    let anchor: { x: number; y: number };
    let target: InspectorTarget;
    if (state.type === "rect") {
      anchor = {
        x: svgRect.left - hostRect.left + (state.x + state.width - this.pan.x) * sx + 8,
        y: svgRect.top - hostRect.top + (state.y - this.pan.y) * sy,
      };
      target = { kind: "rect", fontSize: state.fontSize, fill: state.fill };
    } else {
      const fromState = state.from.blockId
        ? this.blockIndex.get(state.from.blockId)?.getState()
        : null;
      const toState = state.to.blockId
        ? this.blockIndex.get(state.to.blockId)?.getState()
        : null;
      const a =
        fromState && fromState.type === "rect" && state.from.side
          ? endpointForRect(fromState, state.from.side)
          : { x: state.from.x, y: state.from.y };
      const b =
        toState && toState.type === "rect" && state.to.side
          ? endpointForRect(toState, state.to.side)
          : { x: state.to.x, y: state.to.y };
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      anchor = {
        x: svgRect.left - hostRect.left + (mx - this.pan.x) * sx + 12,
        y: svgRect.top - hostRect.top + (my - this.pan.y) * sy + 12,
      };
      target = {
        kind: "line",
        text: state.text,
        arrow: state.arrow,
        stroke: state.stroke,
        fontSize: state.fontSize,
      };
    }
    this.inspector.show(anchor.x, anchor.y, target);
  }

  private repositionInspector(): void {
    if (!this.selectedId) return;
    const block = this.blockIndex.get(this.selectedId);
    if (block) this.showInspectorFor(block);
  }
}

interface ConnDragState {
  pointerId: number;
  fromBlockId: string;
  fromSide: EndpointSide;
  startBoard: { x: number; y: number };
  lastBoard: { x: number; y: number };
}

export function createBoard(target: HTMLElement, config: BoardConfig = {}): Board {
  return new Board(target, config);
}

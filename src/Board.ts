import { SVG_NS, type Block, type BlockHost } from "./Block.js";
import { RectBlock } from "./RectBlock.js";
import { resolveConfig } from "./config.js";
import { ContextMenu } from "./ContextMenu.js";
import { Inspector } from "./Inspector.js";
import { DebouncedStorage, LocalStorageAdapter } from "./storage.js";
import { injectStyles } from "./style.js";
import { rasterizeSvg, serializeSvg } from "./utils/png.js";
import type {
  BlockState,
  BoardConfig,
  BoardEvent,
  BoardEventListener,
  BoardSize,
  BoardState,
  RectBlockState,
  ResolvedBoardConfig,
  StateStorage,
} from "./types.js";

export interface AddRectOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  fill?: string;
  fontSize?: number;
}

let blockIdCounter = 0;
function nextId(): string {
  blockIdCounter += 1;
  return `b_${Date.now().toString(36)}_${blockIdCounter}`;
}

export class Board implements BlockHost {
  readonly config: ResolvedBoardConfig;
  private container: HTMLDivElement;
  private svg: SVGSVGElement;
  private blocksLayer: SVGGElement;
  private blocks: Block[] = [];
  private blockIndex = new Map<string, Block>();
  private size: BoardSize;
  private selectedId: string | null = null;
  private listeners = new Set<BoardEventListener>();
  private menu: ContextMenu;
  private inspector: Inspector;
  private storage: StateStorage;
  private debouncedStorage: DebouncedStorage;
  private mountedTarget: HTMLElement;
  private destroyed = false;
  private keyHandler = (event: KeyboardEvent) => this.onKeyDown(event);
  private hostMouseDown = (event: MouseEvent) => this.onHostMouseDown(event);

  constructor(target: HTMLElement, config: BoardConfig = {}) {
    this.mountedTarget = target;
    this.config = resolveConfig(config);
    this.size = { ...this.config.initialSize };

    injectStyles(target.ownerDocument ?? document);

    this.container = (target.ownerDocument ?? document).createElement("div");
    this.container.className = "hb-board";
    if (this.config.className) this.container.classList.add(this.config.className);
    target.appendChild(this.container);

    this.svg = document.createElementNS(SVG_NS, "svg");
    this.svg.classList.add("hb-board__svg");
    this.svg.setAttribute("xmlns", SVG_NS);
    this.applySize();
    this.container.appendChild(this.svg);

    this.blocksLayer = document.createElementNS(SVG_NS, "g");
    this.blocksLayer.classList.add("hb-board__blocks");
    this.svg.appendChild(this.blocksLayer);

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
        const block = this.selectedId ? this.blockIndex.get(this.selectedId) : null;
        block?.setFontSize(size);
      },
      onFillChange: (color) => {
        const block = this.selectedId ? this.blockIndex.get(this.selectedId) : null;
        block?.setFill(color);
      },
      onDelete: () => {
        if (this.selectedId) this.removeBlock(this.selectedId);
      },
    });

    this.storage = this.config.storage ?? new LocalStorageAdapter();
    this.debouncedStorage = new DebouncedStorage(this.storage);

    this.attachInteractions();
    this.loadFromStorage();
  }

  // ---------- public API -------------------------------------------------

  addBlock(state: Partial<BlockState> & { type?: BlockState["type"] } = {}): BlockState {
    const next = this.normalizeNewBlock({ ...state, type: state.type ?? "rect" });
    const block = this.instantiate(next);
    this.blocks.push(block);
    this.blockIndex.set(block.id, block);
    block.mount(this.blocksLayer);
    this.host_requestGrowFor(next);
    this.emit({ type: "block:add", block: next });
    this.persist();
    return next;
  }

  addRect(opts: AddRectOptions = {}): RectBlockState {
    const fontSize = opts.fontSize ?? this.config.defaultFontSize;
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
      fontSize,
      fontFamily: this.config.fontFamily,
    };
    return this.addBlock(initial) as RectBlockState;
  }

  removeBlock(id: string): void {
    const block = this.blockIndex.get(id);
    if (!block) return;
    block.unmount();
    this.blockIndex.delete(id);
    this.blocks = this.blocks.filter((b) => b.id !== id);
    if (this.selectedId === id) this.selectBlock(null);
    this.emit({ type: "block:remove", id });
    this.persist();
  }

  getState(): BoardState {
    return {
      version: 1,
      size: { ...this.size },
      blocks: this.blocks.map((b) => b.getState()),
    };
  }

  loadState(state: BoardState): void {
    for (const block of this.blocks) block.unmount();
    this.blocks = [];
    this.blockIndex.clear();
    this.selectedId = null;
    this.size = { ...state.size };
    this.applySize();
    for (const blockState of state.blocks) {
      const block = this.instantiate(blockState);
      this.blocks.push(block);
      this.blockIndex.set(block.id, block);
      block.mount(this.blocksLayer);
    }
    this.emit({ type: "state:change", state: this.getState() });
    this.persist();
  }

  /** Serialize the SVG snapshot (state-of-the-image). */
  exportSVG(): string {
    return serializeSvg(this.svg);
  }

  /** Rasterize the SVG to a PNG Blob the developer can upload anywhere. */
  exportPNG(options: { background?: string } = {}): Promise<Blob> {
    return rasterizeSvg(this.svg, {
      width: this.size.width,
      height: this.size.height,
      background: options.background ?? "#ffffff",
    });
  }

  on(listener: BoardEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.debouncedStorage.flush();
    this.menu.destroy();
    this.inspector.destroy();
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
      x: (clientX - rect.left) * sx,
      y: (clientY - rect.top) * sy,
    };
  }

  notifyBlockChanged(id: string): void {
    const block = this.blockIndex.get(id);
    if (!block) return;
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

  // ---------- internals --------------------------------------------------

  private lastMenuBoardPos: { x: number; y: number } | null = null;

  private attachInteractions(): void {
    this.svg.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      const board = this.clientToBoard(event.clientX, event.clientY);
      this.lastMenuBoardPos = board;
      const hostRect = this.container.getBoundingClientRect();
      this.menu.open(event.clientX - hostRect.left, event.clientY - hostRect.top);
    });

    this.svg.addEventListener("pointerdown", (event) => {
      if (event.target === this.svg || event.target === this.blocksLayer) {
        this.selectBlock(null);
      }
    });

    document.addEventListener("keydown", this.keyHandler);
    document.addEventListener("mousedown", this.hostMouseDown, true);
    this.container.addEventListener("scroll", () => this.repositionInspector());
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

  private host_requestGrowFor(state: BlockState): void {
    this.requestGrow(state.x + state.width, state.y + state.height);
  }

  private normalizeNewBlock(input: Partial<BlockState> & { type: BlockState["type"] }): BlockState {
    if (input.type !== "rect") {
      throw new Error(`Unsupported block type: ${String(input.type)}`);
    }
    const id = input.id ?? nextId();
    return {
      id,
      type: "rect",
      x: input.x ?? 40,
      y: input.y ?? 40,
      width: input.width ?? 160,
      height: input.height ?? 90,
      text: input.text ?? "",
      fill: input.fill ?? this.config.defaultColor,
      border: input.border ?? { ...this.config.border },
      fontSize: input.fontSize ?? this.config.defaultFontSize,
      fontFamily: input.fontFamily ?? this.config.fontFamily,
    };
  }

  private instantiate(state: BlockState): Block {
    if (state.type === "rect") return new RectBlock(state, this);
    throw new Error(`Unsupported block type: ${String(state.type)}`);
  }

  private applySize(): void {
    this.svg.setAttribute("width", String(this.size.width));
    this.svg.setAttribute("height", String(this.size.height));
    this.svg.setAttribute("viewBox", `0 0 ${this.size.width} ${this.size.height}`);
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
      if (!loaded || this.destroyed) return;
      this.loadState(loaded);
    } catch (err) {
      console.error("[html-block] failed to load board state", err);
    }
  }

  private showInspectorFor(block: Block): void {
    const state = block.getState();
    const hostRect = this.container.getBoundingClientRect();
    const svgRect = this.svg.getBoundingClientRect();
    const sx = this.size.width === 0 ? 1 : svgRect.width / this.size.width;
    const sy = this.size.height === 0 ? 1 : svgRect.height / this.size.height;
    const x = svgRect.left - hostRect.left + (state.x + state.width) * sx + 8;
    const y = svgRect.top - hostRect.top + state.y * sy;
    this.inspector.show(x, y, { fontSize: state.fontSize, fill: state.fill });
  }

  private repositionInspector(): void {
    if (!this.selectedId) return;
    const block = this.blockIndex.get(this.selectedId);
    if (block) this.showInspectorFor(block);
  }
}

export function createBoard(target: HTMLElement, config: BoardConfig = {}): Board {
  return new Board(target, config);
}

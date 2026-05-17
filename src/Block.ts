import type {
  BlockState,
  EndpointSide,
  RectBlockState,
  ResolvedBoardConfig,
} from "./types.js";
import type { RouteRect } from "./utils/routing.js";

export const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Minimal contract a Block needs from the board it lives in. Defined as an
 * interface (rather than importing Board) to avoid a hard dependency cycle.
 */
export interface BlockHost {
  readonly config: ResolvedBoardConfig;
  /** Convert a client-space pointer event to board-space coordinates. */
  clientToBoard(clientX: number, clientY: number): { x: number; y: number };
  /** Notify the board that a block was modified (for events + persistence). */
  notifyBlockChanged(id: string): void;
  /** Notify the board that a block was clicked / wants to be selected. */
  selectBlock(id: string | null): void;
  /** Request the board to expand if the given bounds exceed its size. */
  requestGrow(right: number, bottom: number): void;
  /** Look up the latest state of any block by id (used by lines for endpoints). */
  getBlockState(id: string): BlockState | undefined;
  /** Begin dragging a connection out of a rect's edge handle. */
  startConnectionDrag(fromBlockId: string, side: EndpointSide, event: PointerEvent): void;
  /** Bounding rectangles of all rect blocks except those in `excludeIds`. */
  getObstacleRects(excludeIds: ReadonlyArray<string>): RouteRect[];
}

export abstract class Block<TState extends BlockState = BlockState> {
  readonly id: string;
  readonly type: string;
  protected state: TState;
  protected host: BlockHost;
  protected group: SVGGElement;

  constructor(state: TState, host: BlockHost) {
    this.id = state.id;
    this.type = state.type;
    this.state = state;
    this.host = host;
    this.group = document.createElementNS(SVG_NS, "g");
    this.group.classList.add("hb-block");
    this.group.dataset.id = state.id;
  }

  get element(): SVGGElement {
    return this.group;
  }

  abstract getState(): TState;

  abstract mount(parent: SVGGElement): void;
  abstract unmount(): void;
  abstract applyState(next: TState): void;
  abstract setSelected(selected: boolean): void;
}

/** Subset of methods only meaningful for blocks that have a 2D bounding box. */
export interface BoxBlock {
  getRectState(): RectBlockState;
  setFill(color: string): void;
  setFontSize(size: number): void;
  setText(text: string): void;
}

/** A block whose endpoints depend on other blocks (e.g. line connectors). */
export interface ConnectorBlock {
  refresh(): void;
  isAnchoredTo(blockId: string): boolean;
}

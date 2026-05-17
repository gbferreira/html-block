import type { BlockState, ResolvedBoardConfig } from "./types.js";

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
}

export abstract class Block {
  readonly id: string;
  readonly type: string;
  protected state: BlockState;
  protected host: BlockHost;
  protected group: SVGGElement;

  constructor(state: BlockState, host: BlockHost) {
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

  getState(): BlockState {
    return { ...this.state, border: { ...this.state.border } };
  }

  abstract mount(parent: SVGGElement): void;
  abstract unmount(): void;
  abstract applyState(next: BlockState): void;

  setPosition(x: number, y: number): void {
    this.state = { ...this.state, x, y };
    this.applyState(this.state);
    this.host.notifyBlockChanged(this.id);
  }

  setSize(width: number, height: number): void {
    this.state = { ...this.state, width, height };
    this.applyState(this.state);
    this.host.notifyBlockChanged(this.id);
  }

  setText(text: string): void {
    if (this.state.text === text) return;
    this.state = { ...this.state, text };
    this.applyState(this.state);
    this.host.notifyBlockChanged(this.id);
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

  abstract setSelected(selected: boolean): void;
}

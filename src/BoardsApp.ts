import { Board, createBoard } from "./Board.js";
import type { BoardConfig } from "./types.js";

export interface BoardsAppOptions {
  /** Container into which board hosts will be appended. */
  root: HTMLElement;
  /** Default config merged into every board created through the app. */
  defaults?: BoardConfig;
  /** Optional builder for the per-board host element (e.g. wrap in a card). */
  createHost?: (name: string) => HTMLElement;
}

interface BoardEntry {
  board: Board;
  host: HTMLElement;
  ownsHost: boolean;
}

/**
 * Lightweight registry that lets a host application create and manage
 * multiple boards on the same page. Each board gets its own host element
 * and its own storageKey by default (`<defaults.storageKey>:<name>`).
 */
export class BoardsApp {
  private root: HTMLElement;
  private defaults: BoardConfig;
  private createHost?: (name: string) => HTMLElement;
  private boards = new Map<string, BoardEntry>();

  constructor(options: BoardsAppOptions) {
    this.root = options.root;
    this.defaults = options.defaults ?? {};
    this.createHost = options.createHost;
  }

  createBoard(name: string, config: BoardConfig = {}): Board {
    if (this.boards.has(name)) {
      throw new Error(`Board "${name}" already exists.`);
    }
    let host: HTMLElement;
    let ownsHost: boolean;
    if (this.createHost) {
      host = this.createHost(name);
      this.root.appendChild(host);
      ownsHost = true;
    } else {
      host = (this.root.ownerDocument ?? document).createElement("div");
      host.dataset.boardName = name;
      host.style.position = "relative";
      host.style.width = "100%";
      host.style.minHeight = "400px";
      this.root.appendChild(host);
      ownsHost = true;
    }
    const merged: BoardConfig = {
      ...this.defaults,
      ...config,
      storageKey: config.storageKey ?? this.defaultStorageKeyFor(name),
    };
    const board = createBoard(host, merged);
    this.boards.set(name, { board, host, ownsHost });
    return board;
  }

  getBoard(name: string): Board | undefined {
    return this.boards.get(name)?.board;
  }

  list(): { name: string; board: Board }[] {
    return Array.from(this.boards, ([name, entry]) => ({ name, board: entry.board }));
  }

  removeBoard(name: string): void {
    const entry = this.boards.get(name);
    if (!entry) return;
    entry.board.destroy();
    if (entry.ownsHost) entry.host.remove();
    this.boards.delete(name);
  }

  destroy(): void {
    for (const name of [...this.boards.keys()]) this.removeBoard(name);
  }

  private defaultStorageKeyFor(name: string): string {
    const base = this.defaults.storageKey ?? "html-block";
    return `${base}:${name}`;
  }
}

export function createBoardsApp(options: BoardsAppOptions): BoardsApp {
  return new BoardsApp(options);
}

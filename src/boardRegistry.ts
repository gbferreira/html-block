import { LocalStorageAdapter } from "./common/storage.js";

const MANIFEST_VERSION = 1 as const;

interface ManifestPayload {
  version: typeof MANIFEST_VERSION;
  boards: { id: string; title: string }[];
}

export interface PersistedBoardRecord {
  id: string;
  title: string;
  storageKey: string;
}

export interface BoardRegistryOptions {
  storagePrefix?: string;
  /** Defaults to `{storagePrefix}:board-registry-manifest` */
  manifestKey?: string;
}

function getLs(): Storage | null {
  try {
    if (typeof globalThis === "undefined") return null;
    const ls = (globalThis as { localStorage?: Storage }).localStorage;
    return ls ?? null;
  } catch {
    return null;
  }
}

function newUuid(): string {
  try {
    const c = (globalThis as { crypto?: Crypto }).crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch {
    /* ignore */
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export function boardPayloadStorageKey(storagePrefix: string, id: string): string {
  return `${storagePrefix}:board:${id}`;
}

function defaultManifestKey(storagePrefix: string): string {
  return `${storagePrefix}:board-registry-manifest`;
}

/**
 * Registry of board slots: manifest in localStorage plus one payload key per board
 * for {@link Board} / {@link HtmlBlockBoard} `storageKey`.
 */
export class BoardRegistry {
  private readonly storagePrefix: string;
  private readonly manifestKey: string;
  private readonly storage = new LocalStorageAdapter();

  constructor(options: BoardRegistryOptions = {}) {
    this.storagePrefix = options.storagePrefix ?? "html-block";
    this.manifestKey = options.manifestKey ?? defaultManifestKey(this.storagePrefix);
  }

  /** Key used for the canvas JSON payload in localStorage. */
  payloadStorageKey(id: string): string {
    return boardPayloadStorageKey(this.storagePrefix, id);
  }

  private readManifest(): ManifestPayload {
    const ls = getLs();
    if (!ls) return { version: MANIFEST_VERSION, boards: [] };
    try {
      const raw = ls.getItem(this.manifestKey);
      if (!raw) return { version: MANIFEST_VERSION, boards: [] };
      const parsed = JSON.parse(raw) as unknown;
      if (
        !parsed ||
        typeof parsed !== "object" ||
        (parsed as ManifestPayload).version !== MANIFEST_VERSION ||
        !Array.isArray((parsed as ManifestPayload).boards)
      ) {
        return { version: MANIFEST_VERSION, boards: [] };
      }
      const boards = (parsed as ManifestPayload).boards.filter(
        (e): e is { id: string; title: string } =>
          typeof e?.id === "string" && typeof e?.title === "string",
      );
      return { version: MANIFEST_VERSION, boards };
    } catch {
      return { version: MANIFEST_VERSION, boards: [] };
    }
  }

  private writeManifest(m: ManifestPayload): void {
    const ls = getLs();
    if (!ls) return;
    try {
      ls.setItem(this.manifestKey, JSON.stringify(m));
    } catch {
      // quota or serialization errors: ignore like LocalStorageAdapter
    }
  }

  /** Boards with stable ids, titles, and payload storage keys (sorted by title). */
  list(): PersistedBoardRecord[] {
    const boards = [...this.readManifest().boards];
    boards.sort((a, b) => a.title.localeCompare(b.title));
    return boards.map((b) => ({
      id: b.id,
      title: b.title,
      storageKey: this.payloadStorageKey(b.id),
    }));
  }

  create(opts: { title?: string } = {}): PersistedBoardRecord {
    const manifest = this.readManifest();
    const id = newUuid();
    const title = opts.title ?? `Board ${manifest.boards.length + 1}`;
    manifest.boards.push({ id, title });
    this.writeManifest(manifest);
    return {
      id,
      title,
      storageKey: this.payloadStorageKey(id),
    };
  }

/**
 * Remove a board entry and its persisted canvas state.
 * When unmounting a live {@link Board} (e.g. React `Board` wrapper), call this after React
 * has committed the unmount (e.g. `setTimeout(0)`) so `destroy()`'s storage flush does not
 * recreate the key.
 */
  deleteBoard(id: string): void {
    const manifest = this.readManifest();
    manifest.boards = manifest.boards.filter((b) => b.id !== id);
    this.writeManifest(manifest);
    this.storage.remove(this.payloadStorageKey(id));
  }
}

export function createBoardRegistry(options?: BoardRegistryOptions): BoardRegistry {
  return new BoardRegistry(options);
}

import { createBoardsApp, type Board } from "../../dist/index.js";

const tabsStrip = document.querySelector<HTMLElement>("#tabs");
const tabsBody = document.querySelector<HTMLElement>("#tabs-body");
const newBoardBtn = document.querySelector<HTMLButtonElement>("#new-board");
const archiveEl = document.querySelector<HTMLElement>("#archive");
const archiveChipsEl = document.querySelector<HTMLElement>("#archive-chips");

if (!tabsStrip || !tabsBody || !newBoardBtn || !archiveEl || !archiveChipsEl) {
  throw new Error("Demo markup is missing required elements.");
}

interface TabEntry {
  name: string;
  tabBtn: HTMLButtonElement;
  panel: HTMLElement;
}

interface TabsManifest {
  open: string[];
  archived: string[];
  active: string | null;
  counter: number;
}

const STORAGE_PREFIX = "html-block:demo";
const TABS_MANIFEST_KEY = `${STORAGE_PREFIX}:tabs`;

const tabs = new Map<string, TabEntry>();
const archived: string[] = [];
let activeName: string | null = null;
let counter = 0;

const app = createBoardsApp({
  root: tabsBody,
  defaults: {
    storageKey: STORAGE_PREFIX,
    initialSize: { width: 1100, height: 600 },
    growStep: 200,
  },
  // Each board is hosted inside a tab panel with an action bar above it.
  createHost: (name) => {
    const panel = document.createElement("section");
    panel.className = "tab-panel";
    panel.dataset.boardName = name;

    const actions = document.createElement("div");
    actions.className = "tab-panel__actions";

    const title = document.createElement("span");
    title.className = "tab-panel__title";
    title.textContent = name;

    const exportPng = document.createElement("button");
    exportPng.type = "button";
    exportPng.textContent = "Export PNG";
    exportPng.addEventListener("click", () => {
      const board = app.getBoard(name);
      if (board) void downloadPng(board, name);
    });

    const exportJson = document.createElement("button");
    exportJson.type = "button";
    exportJson.textContent = "Export JSON";
    exportJson.addEventListener("click", () => {
      const board = app.getBoard(name);
      if (board) downloadJson(board, name);
    });

    actions.append(title, exportPng, exportJson);
    panel.append(actions);
    return panel;
  },
});

newBoardBtn.addEventListener("click", () => {
  const name = freshBoardName();
  // Wipe any stale storage for this name so the new board is truly empty.
  clearBoardStorage(name);
  const board = app.createBoard(name);
  registerTab(name);
  setActive(name);
  if (tabs.size === 1 && archived.length === 0 && board.getState().blocks.length === 0) {
    seedDemoBoard(board);
  }
  saveManifest();
});

restoreFromManifest();

function seedDemoBoard(board: Board): void {
  const a = board.addRect({ x: 80, y: 100, text: "Plan" });
  const b = board.addRect({ x: 380, y: 100, text: "Build", fill: "#bfdbfe" });
  const c = board.addRect({ x: 680, y: 100, text: "Ship", fill: "#bbf7d0" });
  board.addLine({
    from: { blockId: a.id, side: "right" },
    to: { blockId: b.id, side: "left" },
    text: "next",
  });
  board.addLine({
    from: { blockId: b.id, side: "right" },
    to: { blockId: c.id, side: "left" },
    text: "deploy",
    arrow: "both",
  });
}

function restoreFromManifest(): void {
  const manifest = loadManifest();
  if (!manifest) {
    newBoardBtn!.click();
    return;
  }
  counter = manifest.counter;
  for (const name of manifest.archived) {
    if (!archived.includes(name)) archived.push(name);
  }
  for (const name of manifest.open) {
    app.createBoard(name);
    registerTab(name);
  }
  if (manifest.open.length > 0) {
    const initialActive =
      manifest.active && tabs.has(manifest.active) ? manifest.active : manifest.open[0];
    setActive(initialActive);
  } else {
    showEmptyState();
  }
  renderArchive();
  saveManifest();
}

function loadManifest(): TabsManifest | null {
  try {
    const raw = localStorage.getItem(TABS_MANIFEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TabsManifest> & { names?: string[] };
    // Accept legacy shape `{ names, active, counter }`.
    const open = Array.isArray(parsed.open)
      ? parsed.open
      : Array.isArray(parsed.names)
        ? parsed.names
        : [];
    const archivedRaw = Array.isArray(parsed.archived) ? parsed.archived : [];
    return {
      open: open.filter((n): n is string => typeof n === "string"),
      archived: archivedRaw.filter((n): n is string => typeof n === "string"),
      active: typeof parsed.active === "string" ? parsed.active : null,
      counter: typeof parsed.counter === "number" ? parsed.counter : open.length,
    };
  } catch {
    return null;
  }
}

function saveManifest(): void {
  const manifest: TabsManifest = {
    open: Array.from(tabs.keys()),
    archived: [...archived],
    active: activeName,
    counter,
  };
  try {
    localStorage.setItem(TABS_MANIFEST_KEY, JSON.stringify(manifest));
  } catch {
    // Storage unavailable — silently ignore so the demo still works in private mode.
  }
}

function freshBoardName(): string {
  // Skip past any name that's currently open or archived so the new board is
  // guaranteed to start blank with a unique identifier.
  while (true) {
    counter += 1;
    const candidate = `Board ${counter}`;
    if (!tabs.has(candidate) && !archived.includes(candidate)) {
      return candidate;
    }
  }
}

function registerTab(name: string): void {
  const tabBtn = document.createElement("button");
  tabBtn.type = "button";
  tabBtn.className = "tab";
  tabBtn.dataset.tab = name;

  const label = document.createElement("span");
  label.textContent = name;

  const close = document.createElement("button");
  close.type = "button";
  close.className = "tab__close";
  close.title = "Close board (keeps a copy in Closed boards)";
  close.textContent = "\u00d7";
  close.addEventListener("click", (event) => {
    event.stopPropagation();
    closeBoard(name);
  });

  tabBtn.append(label, close);
  tabBtn.addEventListener("click", () => setActive(name));
  tabsStrip!.insertBefore(tabBtn, newBoardBtn);

  const panel = tabsBody!.querySelector<HTMLElement>(
    `.tab-panel[data-board-name="${cssEscape(name)}"]`,
  );
  if (!panel) {
    throw new Error(`Tab panel for board "${name}" was not found.`);
  }

  tabs.set(name, { name, tabBtn, panel });
  hideEmptyState();
}

function setActive(name: string): void {
  if (activeName === name) return;
  activeName = name;
  for (const [n, entry] of tabs) {
    const isActive = n === name;
    entry.tabBtn.classList.toggle("is-active", isActive);
    entry.panel.classList.toggle("is-active", isActive);
  }
  saveManifest();
}

function closeBoard(name: string): void {
  const entry = tabs.get(name);
  if (!entry) return;
  app.removeBoard(name);
  entry.tabBtn.remove();
  // Note: app.removeBoard already removed entry.panel from the DOM (it owns the host).
  tabs.delete(name);
  if (!archived.includes(name)) archived.push(name);
  if (activeName === name) {
    activeName = null;
    const next = tabs.keys().next();
    if (!next.done) setActive(next.value);
    else showEmptyState();
  }
  renderArchive();
  saveManifest();
}

function reopenBoard(name: string): void {
  const idx = archived.indexOf(name);
  if (idx === -1) return;
  archived.splice(idx, 1);
  app.createBoard(name);
  registerTab(name);
  setActive(name);
  renderArchive();
  saveManifest();
}

function deleteArchived(name: string): void {
  const idx = archived.indexOf(name);
  if (idx === -1) return;
  const ok = window.confirm(`Permanently delete "${name}"? This removes its saved state.`);
  if (!ok) return;
  archived.splice(idx, 1);
  clearBoardStorage(name);
  renderArchive();
  saveManifest();
}

function clearBoardStorage(name: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}:${name}`);
  } catch {
    // ignore
  }
}

function renderArchive(): void {
  archiveChipsEl!.innerHTML = "";
  if (archived.length === 0) {
    archiveEl!.hidden = true;
    return;
  }
  archiveEl!.hidden = false;

  for (const name of archived) {
    const chip = document.createElement("span");
    chip.className = "archive__chip";

    const nameEl = document.createElement("span");
    nameEl.className = "archive__chip-name";
    nameEl.textContent = name;

    const reopenBtn = document.createElement("button");
    reopenBtn.type = "button";
    reopenBtn.className = "archive__chip-reopen";
    reopenBtn.title = "Reopen this board";
    reopenBtn.textContent = "Reopen";
    reopenBtn.addEventListener("click", () => reopenBoard(name));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "archive__chip-delete";
    deleteBtn.title = "Delete this board permanently";
    deleteBtn.textContent = "\u00d7";
    deleteBtn.addEventListener("click", () => deleteArchived(name));

    chip.append(nameEl, reopenBtn, deleteBtn);
    archiveChipsEl!.appendChild(chip);
  }
}

function hideEmptyState(): void {
  const empty = tabsBody!.querySelector<HTMLElement>(".empty");
  if (empty) empty.style.display = "none";
}

function showEmptyState(): void {
  const empty = tabsBody!.querySelector<HTMLElement>(".empty");
  if (empty) empty.style.display = "block";
}

async function downloadPng(board: Board, name: string): Promise<void> {
  const blob = await board.exportPNG();
  triggerDownload(blob, `${slug(name)}.png`);
}

function downloadJson(board: Board, name: string): void {
  const blob = new Blob([JSON.stringify(board.getState(), null, 2)], {
    type: "application/json",
  });
  triggerDownload(blob, `${slug(name)}.json`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "board";
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

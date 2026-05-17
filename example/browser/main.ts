import { createBoardsApp, type Board } from "../../dist/index.js";

const tabsStrip = document.querySelector<HTMLElement>("#tabs");
const tabsBody = document.querySelector<HTMLElement>("#tabs-body");
const newBoardBtn = document.querySelector<HTMLButtonElement>("#new-board");

if (!tabsStrip || !tabsBody || !newBoardBtn) {
  throw new Error("Demo markup is missing required elements.");
}

interface TabEntry {
  name: string;
  tabBtn: HTMLButtonElement;
  panel: HTMLElement;
}

const tabs = new Map<string, TabEntry>();
let activeName: string | null = null;
let counter = 0;

const app = createBoardsApp({
  root: tabsBody,
  defaults: {
    storageKey: "html-block:demo",
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
  counter += 1;
  const name = `Board ${counter}`;
  if (tabs.has(name)) return;
  const board = app.createBoard(name);
  registerTab(name);
  setActive(name);
  if (counter === 1 && board.getState().blocks.length === 0) {
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
});

newBoardBtn.click();

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
  close.title = "Close board";
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
}

function closeBoard(name: string): void {
  const entry = tabs.get(name);
  if (!entry) return;
  app.removeBoard(name);
  entry.tabBtn.remove();
  // Note: app.removeBoard already removed entry.panel from the DOM (it owns the host).
  tabs.delete(name);
  if (activeName === name) {
    activeName = null;
    const next = tabs.keys().next();
    if (!next.done) setActive(next.value);
    else showEmptyState();
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

import { createBoardsApp, type Board } from "../../dist/index.js";

const boardsRoot = document.querySelector<HTMLElement>("#boards");
const newBoardBtn = document.querySelector<HTMLButtonElement>("#new-board");

if (!boardsRoot || !newBoardBtn) {
  throw new Error("Demo markup is missing required elements.");
}

const app = createBoardsApp({
  root: boardsRoot,
  defaults: {
    storageKey: "html-block:demo",
    initialSize: { width: 1100, height: 460 },
    growStep: 200,
  },
  // Each board is hosted inside a "card" with a header for actions. The
  // library mounts the SVG canvas as a child of the returned element.
  createHost: (name) => {
    const card = document.createElement("section");
    card.className = "board-card";
    card.dataset.boardName = name;

    const header = document.createElement("div");
    header.className = "board-card__header";

    const title = document.createElement("span");
    title.className = "board-card__title";
    title.textContent = name;

    const actions = document.createElement("div");
    actions.className = "board-card__actions";

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

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => {
      app.removeBoard(name);
    });

    actions.append(exportPng, exportJson, removeBtn);
    header.append(title, actions);
    card.append(header);
    return card;
  },
});

let counter = 0;
function nextName(): string {
  counter += 1;
  return `Board ${counter}`;
}

newBoardBtn.addEventListener("click", () => {
  const name = nextName();
  const board = app.createBoard(name);
  if (counter === 1 && board.getState().blocks.length === 0) {
    board.addRect({ x: 80, y: 80, text: "Hello" });
    board.addRect({ x: 280, y: 80, text: "World", fill: "#bfdbfe" });
  }
});

newBoardBtn.click();

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

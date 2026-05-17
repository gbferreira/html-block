# html-block

A small TypeScript library for building interactive HTML/SVG block boards in
the browser — diagram-mirror style. Add rectangles, drag/resize them, edit
their text, restyle their font size and color, and export the board to JSON
(for upload to a database) or PNG (for an image snapshot).

## Features

- SVG-based rendering: each block is a `<g>` with a `<rect>` (black border by
  default) and a `<foreignObject>` holding contenteditable text.
- Drag to move, eight-handle resize, double-click to edit text.
- Right-click the board to open a toolbox; "Add rectangle" is shipped, and the
  menu is designed to accept additional items.
- Click a block to open an inspector that lets you change the **font size**
  and the **background color** from a developer-defined palette.
- State auto-persists to `localStorage` (default) and is fully accessible via
  `board.getState()` so the developer can upload it to a database.
- `exportPNG()` returns a `Blob` and `exportSVG()` returns the source string.
- `createBoardsApp(...)` lets you create and remove **multiple boards** on the
  same page through a small registry.
- The board **auto-grows**: when a block is dragged or resized past the right
  or bottom edge, the canvas size expands by `growStep` units (configurable).

## Install

```bash
npm install html-block
```

## Quick start

```ts
import { createBoard } from "html-block";

const board = createBoard(document.getElementById("app")!, {
  colors: ["#ffffff", "#fde68a", "#fecaca", "#bfdbfe", "#bbf7d0"],
  defaultColor: "#ffffff",
  fontFamily: "Inter, sans-serif",
  fontSizes: [12, 14, 16, 18, 24, 32],
  defaultFontSize: 14,
  border: { color: "#000000", width: 1 },
  storageKey: "my-app:board-1",     // location where state is saved
  initialSize: { width: 1200, height: 800 },
  growStep: 200,
});

board.addRect({ x: 80, y: 60, text: "Hello" });
```

Right-click anywhere on the board to add another rectangle, click a block to
open the inspector, double-click to edit text, drag to move, and drag a corner
to resize. Press `Delete` to remove the selected block.

## Configuration (`BoardConfig`)

All fields are optional; defaults are applied via `resolveConfig`.

| Field             | Default                                     | Purpose                                      |
| ----------------- | ------------------------------------------- | -------------------------------------------- |
| `colors`          | 8 pastel swatches                           | Palette shown in the inspector               |
| `defaultColor`    | first color in `colors`                     | Fill for newly added blocks                  |
| `border`          | `{ color: "#000000", width: 1 }`            | Border applied to every block                |
| `fontFamily`      | system UI sans                              | Font used inside blocks                      |
| `fontSizes`       | `[12, 14, 16, 18, 24, 32, 48]`              | Sizes available in the inspector             |
| `defaultFontSize` | `14`                                        | Font size for new blocks                     |
| `storage`         | `new LocalStorageAdapter()`                 | Where state is persisted                     |
| `storageKey`      | `"html-block:default"`                      | Key the state is saved under                 |
| `initialSize`     | `{ width: 1200, height: 800 }`              | Starting board size in user-space units      |
| `growStep`        | `200`                                       | How much the board grows when blocks overflow |
| `minBlockSize`    | `{ width: 40, height: 28 }`                 | Lower bound for resize                       |

## Persistence

By default the board uses a `LocalStorageAdapter` keyed by `storageKey`. State
is saved on every mutation through a debounced wrapper, and re-loaded
automatically when the board is constructed.

To upload to a database, read the state at any time:

```ts
const state = board.getState();
await fetch("/api/boards/1", { method: "PUT", body: JSON.stringify(state) });
```

To use a custom backend (IndexedDB, server, etc.), supply your own
`StateStorage`:

```ts
import { createBoard, type StateStorage, type BoardState } from "html-block";

const remoteStorage: StateStorage = {
  load: async (key) => fetch(`/api/state/${key}`).then((r) => r.json()),
  save: (key, state: BoardState) => {
    void fetch(`/api/state/${key}`, {
      method: "PUT",
      body: JSON.stringify(state),
    });
  },
  remove: (key) => {
    void fetch(`/api/state/${key}`, { method: "DELETE" });
  },
};

createBoard(target, { storage: remoteStorage, storageKey: "team-1" });
```

## Image export

```ts
const png = await board.exportPNG();           // PNG Blob
const svg = board.exportSVG();                 // string (SVG source)
```

`exportPNG` rasterizes the live SVG via an offscreen `<canvas>` and returns a
`Blob` you can download or upload. `exportSVG` returns the serialized SVG
source for vector workflows.

## Multiple boards

`createBoardsApp` is a small registry on top of `createBoard`:

```ts
import { createBoardsApp } from "html-block";

const app = createBoardsApp({
  root: document.querySelector("#boards")!,
  defaults: { initialSize: { width: 1100, height: 460 }, growStep: 200 },
  // Optional: wrap each board in a custom card (header, action buttons, …).
  createHost: (name) => buildBoardCard(name),
});

const a = app.createBoard("design-1");
const b = app.createBoard("design-2");

app.list();              // [{ name, board }, …]
app.getBoard("design-1");
app.removeBoard("design-2");
```

Each board automatically gets its own storage key (`${defaults.storageKey}:${name}`)
so multiple boards on the same page persist independently.

## Auto-grow

The board's `<svg>` has an explicit `width`, `height`, and `viewBox`. Whenever
a block is dragged or resized so its right or bottom edge crosses the current
size, the board expands by `growStep` units along that axis and updates the
viewBox accordingly. The host element is scrollable, so users can pan to the
new space. Set `growStep: 0`-ish (or override the behavior in a fork) if you
want a fixed-size board.

## Events

```ts
const off = board.on((event) => {
  if (event.type === "state:change") {
    // every persistable change passes through here
  }
});
off();
```

Event types: `block:add`, `block:remove`, `block:update`, `block:select`,
`state:change`.

## Development

```bash
npm install
npm run dev      # builds the library and serves the browser demo
npm run build    # type-checks + emits dist/
```

## License

MIT

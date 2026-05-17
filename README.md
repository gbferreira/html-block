# html-block

A small TypeScript library for building interactive HTML/SVG block boards in
the browser — diagram-mirror style. Add rectangles, draw connector lines
between them, drag/resize, edit text, restyle, pan around like in Miro, and
export the board to JSON (for upload to a database) or PNG (for an image
snapshot).

## Features

- SVG rendering: each rect block is a `<g>` with a `<rect>` (black border by
  default) and a `<foreignObject>` holding contenteditable text.
- Drag to move, eight-handle resize, double-click to edit text.
- **Connector lines**: a selected rect shows four "+" handles on its edges;
  drag from one onto another rect to draw a line. Lines have a label that
  sits below the line, configurable arrow direction
  (`ltr` / `rtl` / `both` / `none`), and stroke color.
- Right-click the board to open a toolbox; "Add rectangle" is shipped, and the
  menu is designed to accept additional items.
- Click a block to open an inspector. Rects expose font size + fill color;
  lines expose label text, arrow direction, font size, and stroke color.
- **Pan empty space** like Miro: drag any empty area to scroll the board
  freely. **Single-click empty space** opens a background-color popover
  driven by `BoardConfig.backgroundColors`.
- State auto-persists to `localStorage` (default) and is fully accessible via
  `board.getState()` so the developer can upload it to a database.
- `exportPNG()` returns a `Blob` and `exportSVG()` returns the source string.
- `createBoardsApp(...)` lets you create and remove **multiple boards** on the
  same page through a small registry.
- The board **auto-grows** as content extends past its right/bottom edge.

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
  storageKey: "my-app:board-1",
  initialSize: { width: 1200, height: 800 },
  growStep: 200,
  defaultBackgroundColor: "#ffffff",
  backgroundColors: ["#ffffff", "#f8fafc", "#fef9c3", "#dbeafe", "#dcfce7"],
  defaultLineColor: "#0f172a",
  defaultArrow: "ltr",
  defaultLineWidth: 2,
});

const a = board.addRect({ x: 80, y: 80, text: "Plan" });
const b = board.addRect({ x: 360, y: 80, text: "Build" });
board.addLine({
  from: { blockId: a.id, side: "right" },
  to: { blockId: b.id, side: "left" },
  text: "next",
});
```

### Interactions

- Right-click the empty board to open the toolbox.
- Drag any rect to move it; drag a corner/edge handle to resize.
- Double-click a rect to edit its text. Press `Escape` (or click outside) to
  commit.
- With a rect selected, drag a small "+" handle on its edge onto another rect
  to draw a connector line. Drop in empty space to cancel.
- Click a line to select it. The inspector shows label/arrow/font-size/color.
- Drag empty board space to **pan**. Single click empty space to open the
  **background color** popover.
- `Delete` removes the selected block. `Escape` deselects.

## Configuration (`BoardConfig`)

All fields are optional; defaults are applied via `resolveConfig`.

| Field                    | Default                                     | Purpose                                                |
| ------------------------ | ------------------------------------------- | ------------------------------------------------------ |
| `colors`                 | 8 pastel swatches                           | Palette shown in the inspector for fills/strokes       |
| `defaultColor`           | first color in `colors`                     | Fill for newly added rectangles                        |
| `border`                 | `{ color: "#000000", width: 1 }`            | Border applied to every rectangle                      |
| `fontFamily`             | system UI sans                              | Font used inside blocks and line labels                |
| `fontSizes`              | `[12, 14, 16, 18, 24, 32, 48]`              | Sizes available in the inspector                       |
| `defaultFontSize`        | `14`                                        | Font size for new blocks                               |
| `storage`                | `new LocalStorageAdapter()`                 | Where state is persisted                               |
| `storageKey`             | `"html-block:default"`                      | Key the state is saved under                           |
| `initialSize`            | `{ width: 1200, height: 800 }`              | Starting board size in user-space units                |
| `growStep`               | `200`                                       | How much the board grows when blocks overflow          |
| `minBlockSize`           | `{ width: 40, height: 28 }`                 | Lower bound for resize                                 |
| `defaultBackgroundColor` | `"#ffffff"`                                 | Initial board background fill                          |
| `backgroundColors`       | 8 soft swatches                             | Palette offered when clicking the empty board          |
| `defaultLineColor`       | `"#0f172a"`                                 | Stroke color for newly created lines                   |
| `defaultArrow`           | `"ltr"`                                     | Initial arrow direction (`ltr`/`rtl`/`both`/`none`)    |
| `defaultLineWidth`       | `2`                                         | Stroke width for newly created lines                   |

## Lines / connectors

A connector line lives in `BoardState` as a `LineBlockState`:

```ts
interface LineBlockState {
  id: string;
  type: "line";
  from: { blockId: string | null; side?: "top" | "right" | "bottom" | "left"; x: number; y: number };
  to:   { blockId: string | null; side?: "top" | "right" | "bottom" | "left"; x: number; y: number };
  arrow: "ltr" | "rtl" | "both" | "none";
  stroke: string;
  strokeWidth: number;
  text: string;
  fontSize: number;
  fontFamily: string;
}
```

When `from.blockId` / `to.blockId` are set, the endpoints follow the rect
block's edge midpoint and update automatically as that rect moves or resizes.
If a connected rect is removed, lines anchored to it are removed too.

You can also create lines programmatically:

```ts
board.addLine({
  from: { blockId: rectA.id, side: "right" },
  to:   { blockId: rectB.id, side: "left" },
  text: "next",
  arrow: "ltr",
});
```

## Pan and background color

The board uses a viewBox-translation pan model so you can move around even
when the content fits in the viewport (Miro-style). The current `pan` offset
and `backgroundColor` are persisted as part of `BoardState`:

```ts
interface BoardState {
  version: 1;
  size: { width: number; height: number };
  pan: { x: number; y: number };
  backgroundColor: string;
  blocks: BlockState[];
}
```

A drag with movement greater than ~4px on empty space pans the viewport. A
shorter drag (i.e. a click) opens the background-color popover at the cursor.

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

Each board automatically gets its own storage key
(`${defaults.storageKey}:${name}`) so multiple boards on the same page
persist independently. The bundled browser demo uses this API to drive a
**tab strip** where each tab hosts its own board, with "+ New board" to add
tabs and a per-tab close button.

## Auto-grow

The board's `<svg>` has an explicit `width`, `height`, and `viewBox`.
Whenever a block is dragged or resized so its right or bottom edge crosses
the current size, the board expands by `growStep` units along that axis and
updates the viewBox accordingly. The host element is scrollable in addition
to being pannable, so users can navigate the new space.

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

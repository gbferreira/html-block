import { useRef, useState } from "react";
import {
  Board,
  type HtmlBlockBoardHandle,
  type HtmlBlockBoardProps,
} from "../../dist/react/index.js";
import {
  DEFAULT_BACKGROUND_COLORS,
  DEFAULT_COLORS,
  DEFAULT_FONT_SIZES,
} from "../../dist/index.js";

const TAB_NAMES = ["Board A", "Board B", "Board C"] as const;

const boardConfig = {
  storagePrefix: "html-block",
  colors: DEFAULT_COLORS,
  backgroundColors: DEFAULT_BACKGROUND_COLORS,
  fontSizes: DEFAULT_FONT_SIZES,
  defaultFontSize: 14,
  initialSize: { width: 1100, height: 600 },
  growStep: 200,
  hostClassName: "board-mount",
  hostStyle: { flex: 1, minHeight: 0 },
} satisfies Omit<HtmlBlockBoardProps, "name">;

export function App() {
  const boardRef = useRef<HtmlBlockBoardHandle>(null);
  const [activeTab, setActiveTab] = useState<string>(TAB_NAMES[0] ?? "Board A");

  return (
    <>
      <header className="app-header">
        <h1>html-block — tabbed demo</h1>
        <p className="hint">
          Each tab is a separate board (distinct storage key from its name).
          Left-click empty space for the toolbox; right-click for background
          color; drag to pan. Export uses the library download helpers via the
          board ref.
        </p>
        <div className="toolbar">
          <button type="button" onClick={() => boardRef.current?.exportJSON()}>
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => void boardRef.current?.exportPNG()}
          >
            Export PNG
          </button>
        </div>
      </header>
      <nav className="tabs" aria-label="Boards">
        {TAB_NAMES.map((name) => (
          <button
            key={name}
            type="button"
            className={`tab${name === activeTab ? " is-active" : ""}`}
            onClick={() => setActiveTab(name)}
          >
            {name}
          </button>
        ))}
      </nav>
      <main className="board-shell">
        <Board
          ref={boardRef}
          key={activeTab}
          name={activeTab}
          {...boardConfig}
        />
      </main>
    </>
  );
}

import { useMemo, useRef, useState } from "react";
import {
  Board,
  type HtmlBlockBoardHandle,
  type HtmlBlockBoardProps,
} from "../../dist/react/index.js";
import {
  DEFAULT_BACKGROUND_COLORS,
  DEFAULT_COLORS,
  DEFAULT_FONT_SIZES,
  BoardRegistry,
} from "../../dist/index.js";

const STORAGE_PREFIX = "html-block";

const boardConfig = {
  storagePrefix: STORAGE_PREFIX,
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
  const registry = useMemo(
    () => new BoardRegistry({ storagePrefix: STORAGE_PREFIX }),
    [],
  );
  const [listVersion, setListVersion] = useState(0);
  const bumpList = () => setListVersion((v) => v + 1);

  /** Seed manifest synchronously before first read so hooks stay ordered. */
  const boards = useMemo(() => {
    if (registry.list().length === 0) {
      registry.create();
    }
    return registry.list();
  }, [registry, listVersion]);

  const [activeId, setActiveId] = useState<string>(() => registry.list()[0]!.id);

  const activeBoard =
    boards.find((b) => b.id === activeId) ?? boards[0] ?? null;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const boardRef = useRef<HtmlBlockBoardHandle>(null);

  const handleAddBoard = () => {
    const created = registry.create();
    bumpList();
    setActiveId(created.id);
  };

  const handleDeleteBoard = () => {
    const idToRemove = activeId;
    if (!idToRemove || !activeBoard) return;

    if (boards.length <= 1) {
      const replacement = registry.create();
      bumpList();
      setActiveId(replacement.id);
      setTimeout(() => {
        registry.deleteBoard(idToRemove);
        bumpList();
      }, 0);
      return;
    }

    const rest = boards.filter((b) => b.id !== idToRemove);
    const next = rest[0]?.id;
    if (!next) return;

    setActiveId(next);

    window.setTimeout(() => {
      registry.deleteBoard(idToRemove);
      bumpList();
    }, 0);
  };

  if (!activeBoard) return null;

  return (
    <div className="app-shell">
      <div className="app-columns">
        <div className="app-main-column">
          <header className="app-header">
            <h1>html-block — dynamic boards</h1>
            <p className="hint">
              Boards are tracked with <code>BoardRegistry</code> (list / create /
              delete). Canvas state persists under each board&apos;s{" "}
              <code>storageKey</code> and <strong>auto-saves</strong> on edits
              (debounced). Use <strong>Save now</strong> to call{" "}
              <code>board.save()</code> immediately via the React ref.
            </p>
            <div className="toolbar">
              <button
                type="button"
                onClick={() => setSidebarOpen((o) => !o)}
                aria-expanded={sidebarOpen}
                aria-controls="board-sidebar"
              >
                {sidebarOpen ? "Hide boards list" : "Show boards list"}
              </button>
              <button type="button" onClick={handleAddBoard}>
                Add board
              </button>
              <button
                type="button"
                onClick={handleDeleteBoard}
                aria-label={`Delete board ${activeBoard.title}`}
              >
                Delete board
              </button>
              <button type="button" onClick={() => boardRef.current?.save()}>
                Save now
              </button>
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
          <main className="board-shell">
            <Board
              ref={boardRef}
              key={activeBoard.id}
              name={activeBoard.title}
              storageKey={activeBoard.storageKey}
              {...boardConfig}
            />
          </main>
        </div>

        <aside
          id="board-sidebar"
          className={`board-sidebar${sidebarOpen ? " is-visible" : ""}`}
          aria-hidden={!sidebarOpen}
        >
          <div className="board-sidebar-header">Saved boards</div>
          <ul className="board-sidebar-list">
            {boards.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  className={`board-sidebar-item${b.id === activeId ? " is-active" : ""}`}
                  onClick={() => setActiveId(b.id)}
                >
                  {b.title}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

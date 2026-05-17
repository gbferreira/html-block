export { Board, createBoard } from "./Board.js";
export type { AddRectOptions } from "./Board.js";
export { BoardsApp, createBoardsApp } from "./BoardsApp.js";
export type { BoardsAppOptions } from "./BoardsApp.js";
export { LocalStorageAdapter, MemoryAdapter, DebouncedStorage } from "./storage.js";
export { DEFAULT_COLORS, DEFAULT_FONT_SIZES, resolveConfig } from "./config.js";
export type {
  BlockState,
  BlockStateBase,
  BoardConfig,
  BoardEvent,
  BoardEventListener,
  BoardSize,
  BoardState,
  BorderStyle,
  RectBlockState,
  ResolvedBoardConfig,
  StateStorage,
} from "./types.js";

export interface BorderStyle {
  color: string;
  width: number;
}

export interface BoardSize {
  width: number;
  height: number;
}

export interface BoardConfig {
  /** Color palette shown in the inspector. */
  colors?: string[];
  /** Default fill color for new blocks. */
  defaultColor?: string;
  /** Border applied to every block by default. */
  border?: Partial<BorderStyle>;
  /** Font family applied to block text. */
  fontFamily?: string;
  /** Font sizes shown in the inspector. */
  fontSizes?: number[];
  /** Default font size for new blocks. */
  defaultFontSize?: number;
  /** Storage adapter used for local persistence. Defaults to LocalStorageAdapter. */
  storage?: StateStorage;
  /** Storage key (the "location where to save"). */
  storageKey?: string;
  /** Initial board dimensions in user-space units. */
  initialSize?: BoardSize;
  /** How much the board grows when a block crosses the right/bottom edge. */
  growStep?: number;
  /** Minimum size a block can be resized to. */
  minBlockSize?: BoardSize;
  /** Optional class name applied to the board host element. */
  className?: string;
}

export interface ResolvedBoardConfig {
  colors: string[];
  defaultColor: string;
  border: BorderStyle;
  fontFamily: string;
  fontSizes: number[];
  defaultFontSize: number;
  storage: StateStorage;
  storageKey: string;
  initialSize: BoardSize;
  growStep: number;
  minBlockSize: BoardSize;
  className?: string;
}

export interface BlockStateBase {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fill: string;
  border: BorderStyle;
  fontSize: number;
  fontFamily: string;
}

export interface RectBlockState extends BlockStateBase {
  type: "rect";
}

export type BlockState = RectBlockState;

export interface BoardState {
  /** Schema version for forward compatibility. */
  version: 1;
  size: BoardSize;
  blocks: BlockState[];
}

export interface StateStorage {
  load(key: string): BoardState | null | Promise<BoardState | null>;
  save(key: string, state: BoardState): void | Promise<void>;
  remove(key: string): void | Promise<void>;
}

export type BoardEvent =
  | { type: "block:add"; block: BlockState }
  | { type: "block:remove"; id: string }
  | { type: "block:update"; block: BlockState }
  | { type: "block:select"; id: string | null }
  | { type: "state:change"; state: BoardState };

export type BoardEventListener = (event: BoardEvent) => void;

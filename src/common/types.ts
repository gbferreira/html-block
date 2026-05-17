export interface BorderStyle {
  color: string;
  width: number;
}

export interface BoardSize {
  width: number;
  height: number;
}

export interface PanOffset {
  x: number;
  y: number;
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
  /** Default background color of the board surface. */
  defaultBackgroundColor?: string;
  /** Palette shown when the user clicks the empty board to recolor it. */
  backgroundColors?: string[];
  /** Default stroke color for newly created lines. */
  defaultLineColor?: string;
  /** Default arrow direction for newly created lines. */
  defaultArrow?: ArrowDirection;
  /** Default stroke width (in board units) for newly created lines. */
  defaultLineWidth?: number;
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
  defaultBackgroundColor: string;
  backgroundColors: string[];
  defaultLineColor: string;
  defaultArrow: ArrowDirection;
  defaultLineWidth: number;
}

/** Fields every block carries regardless of type. */
export interface CommonBlockState {
  id: string;
  type: string;
}

export interface RectBlockState extends CommonBlockState {
  type: "rect";
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

export type ArrowDirection = "ltr" | "rtl" | "both" | "none";

export type EndpointSide = "top" | "right" | "bottom" | "left";

export interface LineEndpoint {
  /** When set, the endpoint snaps to a side of the referenced rect block. */
  blockId: string | null;
  side?: EndpointSide;
  /** Free-floating coordinates used when blockId is null. */
  x: number;
  y: number;
}

export interface LineBlockState extends CommonBlockState {
  type: "line";
  from: LineEndpoint;
  to: LineEndpoint;
  arrow: ArrowDirection;
  stroke: string;
  strokeWidth: number;
  text: string;
  fontSize: number;
  fontFamily: string;
}

export type BlockState = RectBlockState | LineBlockState;

export interface BoardState {
  /** Schema version for forward compatibility. */
  version: 1;
  size: BoardSize;
  pan: PanOffset;
  backgroundColor: string;
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

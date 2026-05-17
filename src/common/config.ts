import {
  DEFAULT_BACKGROUND_COLORS,
  DEFAULT_BORDER_COLOR,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_COLORS,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZES,
  DEFAULT_GROW_STEP,
  DEFAULT_INITIAL_BOARD_HEIGHT,
  DEFAULT_INITIAL_BOARD_WIDTH,
  DEFAULT_LINE_COLOR,
  DEFAULT_LINE_WIDTH,
  DEFAULT_MIN_BLOCK_HEIGHT,
  DEFAULT_MIN_BLOCK_WIDTH,
  DEFAULT_RECT_FILL_FALLBACK,
  DEFAULT_RECT_FONT_SIZE,
  DEFAULT_STORAGE_KEY,
} from "../styles/defaults.js";
import { LocalStorageAdapter } from "./storage.js";
import type { ArrowDirection, BoardConfig, ResolvedBoardConfig } from "./types.js";

export function resolveConfig(config: BoardConfig = {}): ResolvedBoardConfig {
  const colors = config.colors && config.colors.length > 0 ? config.colors : DEFAULT_COLORS;
  const defaultColor = config.defaultColor ?? colors[0] ?? DEFAULT_RECT_FILL_FALLBACK;
  const fontSizes =
    config.fontSizes && config.fontSizes.length > 0 ? config.fontSizes : DEFAULT_FONT_SIZES;
  const defaultFontSize = config.defaultFontSize ?? DEFAULT_RECT_FONT_SIZE;
  const backgroundColors =
    config.backgroundColors && config.backgroundColors.length > 0
      ? config.backgroundColors
      : DEFAULT_BACKGROUND_COLORS;
  const defaultBackgroundColor =
    config.defaultBackgroundColor ?? backgroundColors[0] ?? DEFAULT_RECT_FILL_FALLBACK;
  const defaultArrow: ArrowDirection = config.defaultArrow ?? "ltr";

  return {
    colors,
    defaultColor,
    border: {
      color: config.border?.color ?? DEFAULT_BORDER_COLOR,
      width: config.border?.width ?? DEFAULT_BORDER_WIDTH,
    },
    fontFamily: config.fontFamily ?? DEFAULT_FONT_FAMILY,
    fontSizes,
    defaultFontSize,
    storage: config.storage ?? new LocalStorageAdapter(),
    storageKey: config.storageKey ?? DEFAULT_STORAGE_KEY,
    initialSize: {
      width: config.initialSize?.width ?? DEFAULT_INITIAL_BOARD_WIDTH,
      height: config.initialSize?.height ?? DEFAULT_INITIAL_BOARD_HEIGHT,
    },
    growStep: config.growStep ?? DEFAULT_GROW_STEP,
    minBlockSize: {
      width: config.minBlockSize?.width ?? DEFAULT_MIN_BLOCK_WIDTH,
      height: config.minBlockSize?.height ?? DEFAULT_MIN_BLOCK_HEIGHT,
    },
    className: config.className,
    defaultBackgroundColor,
    backgroundColors,
    defaultLineColor: config.defaultLineColor ?? DEFAULT_LINE_COLOR,
    defaultArrow,
    defaultLineWidth: config.defaultLineWidth ?? DEFAULT_LINE_WIDTH,
  };
}

import { LocalStorageAdapter } from "./storage.js";
import type { ArrowDirection, BoardConfig, ResolvedBoardConfig } from "./types.js";

export const DEFAULT_COLORS = [
  "#ffffff",
  "#fde68a",
  "#fecaca",
  "#bfdbfe",
  "#bbf7d0",
  "#e9d5ff",
  "#fed7aa",
  "#cbd5e1",
];

export const DEFAULT_BACKGROUND_COLORS = [
  "#ffffff",
  "#f8fafc",
  "#fef9c3",
  "#dbeafe",
  "#dcfce7",
  "#fae8ff",
  "#fee2e2",
  "#0f172a",
];

export const DEFAULT_FONT_SIZES = [12, 14, 16, 18, 24, 32, 48];

export function resolveConfig(config: BoardConfig = {}): ResolvedBoardConfig {
  const colors = config.colors && config.colors.length > 0 ? config.colors : DEFAULT_COLORS;
  const defaultColor = config.defaultColor ?? colors[0] ?? "#ffffff";
  const fontSizes =
    config.fontSizes && config.fontSizes.length > 0 ? config.fontSizes : DEFAULT_FONT_SIZES;
  const defaultFontSize = config.defaultFontSize ?? 14;
  const backgroundColors =
    config.backgroundColors && config.backgroundColors.length > 0
      ? config.backgroundColors
      : DEFAULT_BACKGROUND_COLORS;
  const defaultBackgroundColor = config.defaultBackgroundColor ?? backgroundColors[0] ?? "#ffffff";
  const defaultArrow: ArrowDirection = config.defaultArrow ?? "ltr";

  return {
    colors,
    defaultColor,
    border: {
      color: config.border?.color ?? "#000000",
      width: config.border?.width ?? 1,
    },
    fontFamily:
      config.fontFamily ?? "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
    fontSizes,
    defaultFontSize,
    storage: config.storage ?? new LocalStorageAdapter(),
    storageKey: config.storageKey ?? "html-block:default",
    initialSize: {
      width: config.initialSize?.width ?? 1200,
      height: config.initialSize?.height ?? 800,
    },
    growStep: config.growStep ?? 200,
    minBlockSize: {
      width: config.minBlockSize?.width ?? 40,
      height: config.minBlockSize?.height ?? 28,
    },
    className: config.className,
    defaultBackgroundColor,
    backgroundColors,
    defaultLineColor: config.defaultLineColor ?? "#0f172a",
    defaultArrow,
    defaultLineWidth: config.defaultLineWidth ?? 2,
  };
}

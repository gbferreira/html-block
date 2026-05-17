import {
  DEFAULT_COLORS,
  DEFAULT_FONT_SIZES,
  resolveConfig,
  type BoardState,
} from "../src/index.js";

// The board itself runs in the browser, but the BoardState shape is portable
// so a server can read what the developer uploads. This snippet shows what a
// fresh state looks like and which defaults the library applies.
const config = resolveConfig({});
console.log("Resolved defaults:");
console.log({
  colors: config.colors,
  defaultColor: config.defaultColor,
  border: config.border,
  fontSizes: config.fontSizes,
  initialSize: config.initialSize,
  storageKey: config.storageKey,
});

const sampleState: BoardState = {
  version: 1,
  size: { width: 1200, height: 800 },
  blocks: [
    {
      id: "demo-1",
      type: "rect",
      x: 64,
      y: 64,
      width: 160,
      height: 90,
      text: "Hello",
      fill: DEFAULT_COLORS[0] ?? "#ffffff",
      border: { color: "#000000", width: 1 },
      fontSize: DEFAULT_FONT_SIZES[1] ?? 14,
      fontFamily: config.fontFamily,
    },
  ],
};

console.log("\nSample BoardState (JSON-serializable for DB upload):");
console.log(JSON.stringify(sampleState, null, 2));

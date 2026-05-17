import { createHtmlBlock } from "../src/index.js";

const sample = createHtmlBlock(
  "figure",
  "Diagram preview",
  { class: "html-block diagram", id: "demo-1" },
);

console.log(sample);

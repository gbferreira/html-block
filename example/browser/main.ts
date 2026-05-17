import { createHtmlBlock } from "../../dist/index.js";

const markup = createHtmlBlock("figure", "Diagram preview", {
  class: "html-block diagram",
  id: "demo-1",
});

const rendered = document.querySelector("#rendered");
const source = document.querySelector("#source code");

if (rendered instanceof HTMLElement) {
  rendered.innerHTML = markup;
}

if (source) {
  source.textContent = markup;
}

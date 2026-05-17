const STYLE_ID = "html-block-styles";

const CSS = `
.hb-board {
  position: relative;
  overflow: auto;
  width: 100%;
  height: 100%;
  background: #f8fafc;
  user-select: none;
  -webkit-user-select: none;
}
.hb-board__svg {
  display: block;
  background:
    linear-gradient(#e2e8f0 1px, transparent 1px) 0 0 / 24px 24px,
    linear-gradient(90deg, #e2e8f0 1px, transparent 1px) 0 0 / 24px 24px,
    #ffffff;
}
.hb-block {
  cursor: move;
}
.hb-block__text {
  width: 100%;
  height: 100%;
  padding: 6px 8px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  outline: none;
  white-space: pre-wrap;
  overflow: hidden;
  word-break: break-word;
  color: #0f172a;
  cursor: text;
  user-select: text;
  -webkit-user-select: text;
}
.hb-block__text[contenteditable="false"] {
  cursor: move;
  user-select: none;
  -webkit-user-select: none;
}
.hb-block__selection {
  fill: none;
  stroke: #2563eb;
  stroke-width: 1.5;
  stroke-dasharray: 4 3;
  pointer-events: none;
}
.hb-handle {
  fill: #ffffff;
  stroke: #2563eb;
  stroke-width: 1.5;
}
.hb-handle--nw, .hb-handle--se { cursor: nwse-resize; }
.hb-handle--ne, .hb-handle--sw { cursor: nesw-resize; }
.hb-handle--n,  .hb-handle--s  { cursor: ns-resize; }
.hb-handle--e,  .hb-handle--w  { cursor: ew-resize; }

.hb-menu {
  position: absolute;
  z-index: 20;
  min-width: 180px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.18);
  padding: 4px;
  font: 13px ui-sans-serif, system-ui, -apple-system, sans-serif;
  color: #0f172a;
}
.hb-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 5px;
  cursor: pointer;
}
.hb-menu__item:hover {
  background: #eff6ff;
}
.hb-menu__sep {
  height: 1px;
  background: #e2e8f0;
  margin: 4px 0;
}

.hb-inspector {
  position: absolute;
  z-index: 20;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.18);
  padding: 10px 12px;
  font: 13px ui-sans-serif, system-ui, -apple-system, sans-serif;
  color: #0f172a;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 220px;
}
.hb-inspector__row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.hb-inspector__label {
  color: #64748b;
  font-size: 12px;
  width: 64px;
}
.hb-inspector__select {
  flex: 1;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 4px 6px;
  font: inherit;
  background: #ffffff;
  color: inherit;
}
.hb-inspector__swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
}
.hb-inspector__swatch {
  width: 20px;
  height: 20px;
  border-radius: 5px;
  border: 1px solid #cbd5e1;
  cursor: pointer;
  padding: 0;
}
.hb-inspector__swatch[aria-pressed="true"] {
  outline: 2px solid #2563eb;
  outline-offset: 1px;
}
.hb-inspector__delete {
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
  border-radius: 6px;
  padding: 5px 8px;
  cursor: pointer;
  font: inherit;
}
.hb-inspector__delete:hover {
  background: #fee2e2;
}
`;

export function injectStyles(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.appendChild(style);
}

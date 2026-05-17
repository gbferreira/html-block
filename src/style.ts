const STYLE_ID = "html-block-styles";

const CSS = `
.hb-board {
  position: relative;
  overflow: auto;
  width: 100%;
  height: 100%;
  background: #f1f5f9;
  user-select: none;
  -webkit-user-select: none;
}
.hb-board__svg {
  display: block;
  background: transparent;
  cursor: default;
}
.hb-board__svg.is-panning {
  cursor: grabbing;
}
.hb-board__bg {
  /* Sized & filled from script. Pointer-events on so empty-board click/pan work. */
  pointer-events: all;
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
.hb-conn {
  fill: #2563eb;
  stroke: #ffffff;
  stroke-width: 1.5;
  cursor: crosshair;
}
.hb-conn:hover {
  fill: #1d4ed8;
}

.hb-line__hit {
  stroke: transparent;
  stroke-width: 16;
  fill: none;
  cursor: pointer;
}
.hb-line__visible {
  fill: none;
  stroke: #0f172a;
  stroke-width: 2;
}
.hb-line__label {
  fill: #0f172a;
  pointer-events: none;
  paint-order: stroke;
  stroke: rgba(255, 255, 255, 0.85);
  stroke-width: 4;
  stroke-linejoin: round;
}
.hb-line.is-selected .hb-line__visible {
  stroke-width: 3;
  filter: drop-shadow(0 0 2px rgba(37, 99, 235, 0.7));
}
.hb-line--preview {
  fill: none;
  stroke: #2563eb;
  stroke-width: 2;
  stroke-dasharray: 5 4;
  pointer-events: none;
}

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

.hb-color-popover {
  position: absolute;
  z-index: 25;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.18);
  padding: 8px 10px;
  font: 13px ui-sans-serif, system-ui, -apple-system, sans-serif;
  color: #0f172a;
  min-width: 180px;
}
.hb-color-popover__title {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 6px;
}
.hb-color-popover__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.hb-color-popover__swatch {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  border: 1px solid #cbd5e1;
  cursor: pointer;
  padding: 0;
}
.hb-color-popover__swatch[aria-pressed="true"] {
  outline: 2px solid #2563eb;
  outline-offset: 1px;
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
  min-width: 240px;
}
.hb-inspector__panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
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
.hb-inspector__select,
.hb-inspector__input {
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
.hb-inspector__arrows {
  display: flex;
  gap: 4px;
  flex: 1;
}
.hb-inspector__arrow {
  flex: 1;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  border-radius: 6px;
  padding: 4px 6px;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  color: inherit;
}
.hb-inspector__arrow[aria-pressed="true"] {
  background: #2563eb;
  border-color: #2563eb;
  color: #ffffff;
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

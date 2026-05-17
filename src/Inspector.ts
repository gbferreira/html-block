import type { ArrowDirection, ResolvedBoardConfig } from "./types.js";

export type InspectorTarget =
  | { kind: "rect"; fontSize: number; fill: string }
  | { kind: "line"; text: string; arrow: ArrowDirection; stroke: string; fontSize: number };

export interface InspectorCallbacks {
  onFontSizeChange(size: number): void;
  onFillChange(color: string): void;
  onLineTextChange(text: string): void;
  onArrowChange(direction: ArrowDirection): void;
  onStrokeChange(color: string): void;
  onDelete(): void;
}

const ARROW_OPTIONS: { value: ArrowDirection; label: string; title: string }[] = [
  { value: "ltr", label: "\u2192", title: "Left to right" },
  { value: "rtl", label: "\u2190", title: "Right to left" },
  { value: "both", label: "\u2194", title: "Both directions" },
  { value: "none", label: "\u2014", title: "No arrow" },
];

/**
 * Floating inspector for the currently selected block. Renders different
 * controls depending on the block kind (rect vs line connector).
 */
export class Inspector {
  private element: HTMLDivElement;
  private rectPanel: HTMLDivElement;
  private linePanel: HTMLDivElement;
  private fontSelect: HTMLSelectElement;
  private fillSwatchesEl: HTMLDivElement;
  private lineFontSelect: HTMLSelectElement;
  private lineTextInput: HTMLInputElement;
  private arrowGroup: HTMLDivElement;
  private strokeSwatchesEl: HTMLDivElement;
  private deleteBtn: HTMLButtonElement;
  private isOpen = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly config: ResolvedBoardConfig,
    private readonly callbacks: InspectorCallbacks,
  ) {
    this.element = document.createElement("div");
    this.element.className = "hb-inspector";
    this.element.style.display = "none";
    this.element.addEventListener("mousedown", (e) => e.stopPropagation());

    this.rectPanel = document.createElement("div");
    this.rectPanel.className = "hb-inspector__panel";

    const fontRow = row("Font size");
    this.fontSelect = createFontSelect(this.config.fontSizes);
    this.fontSelect.addEventListener("change", () => {
      const value = Number(this.fontSelect.value);
      if (!Number.isNaN(value)) this.callbacks.onFontSizeChange(value);
    });
    fontRow.appendChild(this.fontSelect);

    const fillRow = row("Color");
    this.fillSwatchesEl = document.createElement("div");
    this.fillSwatchesEl.className = "hb-inspector__swatches";
    fillRow.appendChild(this.fillSwatchesEl);

    this.rectPanel.append(fontRow, fillRow);

    this.linePanel = document.createElement("div");
    this.linePanel.className = "hb-inspector__panel";

    const labelRow = row("Label");
    this.lineTextInput = document.createElement("input");
    this.lineTextInput.type = "text";
    this.lineTextInput.className = "hb-inspector__input";
    this.lineTextInput.placeholder = "Text below line";
    this.lineTextInput.addEventListener("input", () => {
      this.callbacks.onLineTextChange(this.lineTextInput.value);
    });
    labelRow.appendChild(this.lineTextInput);

    const lineFontRow = row("Font size");
    this.lineFontSelect = createFontSelect(this.config.fontSizes);
    this.lineFontSelect.addEventListener("change", () => {
      const value = Number(this.lineFontSelect.value);
      if (!Number.isNaN(value)) this.callbacks.onFontSizeChange(value);
    });
    lineFontRow.appendChild(this.lineFontSelect);

    const arrowRow = row("Arrow");
    this.arrowGroup = document.createElement("div");
    this.arrowGroup.className = "hb-inspector__arrows";
    arrowRow.appendChild(this.arrowGroup);

    const strokeRow = row("Color");
    this.strokeSwatchesEl = document.createElement("div");
    this.strokeSwatchesEl.className = "hb-inspector__swatches";
    strokeRow.appendChild(this.strokeSwatchesEl);

    this.linePanel.append(labelRow, lineFontRow, arrowRow, strokeRow);

    const actionsRow = document.createElement("div");
    actionsRow.className = "hb-inspector__row";
    actionsRow.style.justifyContent = "flex-end";
    this.deleteBtn = document.createElement("button");
    this.deleteBtn.className = "hb-inspector__delete";
    this.deleteBtn.type = "button";
    this.deleteBtn.textContent = "Delete";
    this.deleteBtn.addEventListener("click", () => this.callbacks.onDelete());
    actionsRow.appendChild(this.deleteBtn);

    this.element.append(this.rectPanel, this.linePanel, actionsRow);
    this.host.appendChild(this.element);
  }

  show(x: number, y: number, target: InspectorTarget): void {
    this.rectPanel.style.display = target.kind === "rect" ? "flex" : "none";
    this.linePanel.style.display = target.kind === "line" ? "flex" : "none";

    if (target.kind === "rect") {
      this.fontSelect.value = String(this.nearestFontSize(target.fontSize));
      this.renderSwatches(this.fillSwatchesEl, target.fill, this.callbacks.onFillChange);
    } else {
      if (this.lineTextInput.value !== target.text) {
        this.lineTextInput.value = target.text;
      }
      this.lineFontSelect.value = String(this.nearestFontSize(target.fontSize));
      this.renderArrowGroup(target.arrow);
      this.renderSwatches(this.strokeSwatchesEl, target.stroke, this.callbacks.onStrokeChange);
    }

    this.element.style.display = "flex";
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;

    const rect = this.element.getBoundingClientRect();
    const hostRect = this.host.getBoundingClientRect();
    if (rect.right > hostRect.right) {
      this.element.style.left = `${Math.max(0, x - rect.width)}px`;
    }
    if (rect.bottom > hostRect.bottom) {
      this.element.style.top = `${Math.max(0, y - rect.height)}px`;
    }

    this.isOpen = true;
  }

  hide(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.element.style.display = "none";
  }

  destroy(): void {
    this.hide();
    this.element.remove();
  }

  private renderSwatches(
    container: HTMLDivElement,
    current: string,
    onPick: (color: string) => void,
  ): void {
    container.innerHTML = "";
    this.config.colors.forEach((color) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hb-inspector__swatch";
      btn.style.background = color;
      btn.title = color;
      btn.setAttribute("aria-pressed", color === current ? "true" : "false");
      btn.addEventListener("click", () => {
        onPick(color);
        Array.from(container.children).forEach((c) =>
          c.setAttribute("aria-pressed", c === btn ? "true" : "false"),
        );
      });
      container.appendChild(btn);
    });
  }

  private renderArrowGroup(current: ArrowDirection): void {
    this.arrowGroup.innerHTML = "";
    for (const opt of ARROW_OPTIONS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hb-inspector__arrow";
      btn.textContent = opt.label;
      btn.title = opt.title;
      btn.setAttribute("aria-pressed", opt.value === current ? "true" : "false");
      btn.addEventListener("click", () => {
        this.callbacks.onArrowChange(opt.value);
        Array.from(this.arrowGroup.children).forEach((c) =>
          c.setAttribute("aria-pressed", c === btn ? "true" : "false"),
        );
      });
      this.arrowGroup.appendChild(btn);
    }
  }

  private nearestFontSize(target: number): number {
    const sizes = this.config.fontSizes;
    if (sizes.includes(target)) return target;
    let best = sizes[0] ?? target;
    let bestDiff = Math.abs(best - target);
    for (const s of sizes) {
      const diff = Math.abs(s - target);
      if (diff < bestDiff) {
        best = s;
        bestDiff = diff;
      }
    }
    return best;
  }
}

function row(labelText: string): HTMLDivElement {
  const r = document.createElement("div");
  r.className = "hb-inspector__row";
  const label = document.createElement("span");
  label.className = "hb-inspector__label";
  label.textContent = labelText;
  r.appendChild(label);
  return r;
}

function createFontSelect(sizes: number[]): HTMLSelectElement {
  const sel = document.createElement("select");
  sel.className = "hb-inspector__select";
  sizes.forEach((size) => {
    const opt = document.createElement("option");
    opt.value = String(size);
    opt.textContent = `${size}px`;
    sel.appendChild(opt);
  });
  return sel;
}

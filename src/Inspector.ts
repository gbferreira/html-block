import type { ResolvedBoardConfig } from "./types.js";

export interface InspectorTarget {
  fontSize: number;
  fill: string;
}

export interface InspectorCallbacks {
  onFontSizeChange(size: number): void;
  onFillChange(color: string): void;
  onDelete(): void;
}

/**
 * Floating inspector for the currently selected block. Lets the user pick a
 * font size from `config.fontSizes` and a fill color from `config.colors`.
 */
export class Inspector {
  private element: HTMLDivElement;
  private fontSelect: HTMLSelectElement;
  private swatchesEl: HTMLDivElement;
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

    const fontRow = document.createElement("div");
    fontRow.className = "hb-inspector__row";
    const fontLabel = document.createElement("span");
    fontLabel.className = "hb-inspector__label";
    fontLabel.textContent = "Font size";
    this.fontSelect = document.createElement("select");
    this.fontSelect.className = "hb-inspector__select";
    this.config.fontSizes.forEach((size) => {
      const opt = document.createElement("option");
      opt.value = String(size);
      opt.textContent = `${size}px`;
      this.fontSelect.appendChild(opt);
    });
    this.fontSelect.addEventListener("change", () => {
      const value = Number(this.fontSelect.value);
      if (!Number.isNaN(value)) this.callbacks.onFontSizeChange(value);
    });
    fontRow.appendChild(fontLabel);
    fontRow.appendChild(this.fontSelect);

    const colorRow = document.createElement("div");
    colorRow.className = "hb-inspector__row";
    const colorLabel = document.createElement("span");
    colorLabel.className = "hb-inspector__label";
    colorLabel.textContent = "Color";
    this.swatchesEl = document.createElement("div");
    this.swatchesEl.className = "hb-inspector__swatches";
    colorRow.appendChild(colorLabel);
    colorRow.appendChild(this.swatchesEl);

    const actionsRow = document.createElement("div");
    actionsRow.className = "hb-inspector__row";
    actionsRow.style.justifyContent = "flex-end";
    this.deleteBtn = document.createElement("button");
    this.deleteBtn.className = "hb-inspector__delete";
    this.deleteBtn.type = "button";
    this.deleteBtn.textContent = "Delete";
    this.deleteBtn.addEventListener("click", () => this.callbacks.onDelete());
    actionsRow.appendChild(this.deleteBtn);

    this.element.appendChild(fontRow);
    this.element.appendChild(colorRow);
    this.element.appendChild(actionsRow);
    this.host.appendChild(this.element);
    this.renderSwatches("");
  }

  show(x: number, y: number, target: InspectorTarget): void {
    this.fontSelect.value = String(this.nearestFontSize(target.fontSize));
    this.renderSwatches(target.fill);

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

  private renderSwatches(currentFill: string): void {
    this.swatchesEl.innerHTML = "";
    this.config.colors.forEach((color) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hb-inspector__swatch";
      btn.style.background = color;
      btn.title = color;
      btn.setAttribute("aria-pressed", color === currentFill ? "true" : "false");
      btn.addEventListener("click", () => {
        this.callbacks.onFillChange(color);
        this.renderSwatches(color);
      });
      this.swatchesEl.appendChild(btn);
    });
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

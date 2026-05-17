/**
 * Tiny floating swatch popover. Used by the board to pick a background color.
 */
export class ColorPopover {
  private element: HTMLDivElement;
  private isOpen = false;
  private outsideHandler = (event: MouseEvent) => {
    if (!this.element.contains(event.target as Node)) this.close();
  };
  private keyHandler = (event: KeyboardEvent) => {
    if (event.key === "Escape") this.close();
  };

  constructor(private readonly host: HTMLElement) {
    this.element = document.createElement("div");
    this.element.className = "hb-color-popover";
    this.element.style.display = "none";
    this.element.addEventListener("mousedown", (e) => e.stopPropagation());
    this.host.appendChild(this.element);
  }

  open(
    x: number,
    y: number,
    options: {
      title?: string;
      colors: string[];
      current?: string;
      onPick: (color: string) => void;
    },
  ): void {
    this.element.innerHTML = "";
    if (options.title) {
      const title = document.createElement("div");
      title.className = "hb-color-popover__title";
      title.textContent = options.title;
      this.element.appendChild(title);
    }
    const grid = document.createElement("div");
    grid.className = "hb-color-popover__grid";
    options.colors.forEach((color) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hb-color-popover__swatch";
      btn.style.background = color;
      btn.title = color;
      btn.setAttribute("aria-pressed", color === options.current ? "true" : "false");
      btn.addEventListener("click", () => {
        options.onPick(color);
        this.close();
      });
      grid.appendChild(btn);
    });
    this.element.appendChild(grid);

    this.element.style.display = "block";
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

    if (!this.isOpen) {
      this.isOpen = true;
      setTimeout(() => {
        document.addEventListener("mousedown", this.outsideHandler, true);
        document.addEventListener("keydown", this.keyHandler);
      }, 0);
    }
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.element.style.display = "none";
    document.removeEventListener("mousedown", this.outsideHandler, true);
    document.removeEventListener("keydown", this.keyHandler);
  }

  destroy(): void {
    this.close();
    this.element.remove();
  }
}

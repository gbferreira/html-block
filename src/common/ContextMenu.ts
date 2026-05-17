export interface ContextMenuItem {
  id: string;
  label: string;
  onSelect: () => void;
  separatorBefore?: boolean;
}

/**
 * Floating context menu rendered as an HTML overlay above the board. Designed
 * to be extensible: callers can register additional items (block types,
 * actions) at construction or at runtime.
 */
export class ContextMenu {
  private element: HTMLDivElement;
  private items: ContextMenuItem[] = [];
  private menuOpen = false;
  private outsideHandler = (event: MouseEvent) => {
    if (!this.element.contains(event.target as Node)) this.close();
  };
  private keyHandler = (event: KeyboardEvent) => {
    if (event.key === "Escape") this.close();
  };

  constructor(private readonly host: HTMLElement) {
    this.element = document.createElement("div");
    this.element.className = "hb-menu";
    this.element.style.display = "none";
    this.host.appendChild(this.element);
  }

  setItems(items: ContextMenuItem[]): void {
    this.items = items;
    this.render();
  }

  addItem(item: ContextMenuItem): void {
    this.items.push(item);
    this.render();
  }

  open(x: number, y: number): void {
    if (this.items.length === 0) return;
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
    this.element.style.display = "block";

    const rect = this.element.getBoundingClientRect();
    const hostRect = this.host.getBoundingClientRect();
    if (rect.right > hostRect.right) {
      this.element.style.left = `${Math.max(0, x - rect.width)}px`;
    }
    if (rect.bottom > hostRect.bottom) {
      this.element.style.top = `${Math.max(0, y - rect.height)}px`;
    }

    if (!this.menuOpen) {
      this.menuOpen = true;
      setTimeout(() => {
        document.addEventListener("mousedown", this.outsideHandler, true);
        document.addEventListener("keydown", this.keyHandler);
      }, 0);
    }
  }

  close(): void {
    if (!this.menuOpen) return;
    this.menuOpen = false;
    this.element.style.display = "none";
    document.removeEventListener("mousedown", this.outsideHandler, true);
    document.removeEventListener("keydown", this.keyHandler);
  }

  destroy(): void {
    this.close();
    this.element.remove();
  }

  /** Whether the menu is visible (for disambiguating click-to-close vs click-to-open). */
  isOpen(): boolean {
    return this.menuOpen;
  }

  private render(): void {
    this.element.innerHTML = "";
    this.items.forEach((item) => {
      if (item.separatorBefore) {
        const sep = document.createElement("div");
        sep.className = "hb-menu__sep";
        this.element.appendChild(sep);
      }
      const el = document.createElement("div");
      el.className = "hb-menu__item";
      el.textContent = item.label;
      el.addEventListener("click", () => {
        this.close();
        item.onSelect();
      });
      this.element.appendChild(el);
    });
  }
}

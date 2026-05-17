/**
 * Serialize an SVG element to a standalone string, ensuring xmlns is present
 * so it can be parsed by an Image and rasterized to a canvas.
 */
export function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  if (!clone.getAttribute("xmlns")) {
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }
  if (!clone.getAttribute("xmlns:xlink")) {
    clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  }
  return new XMLSerializer().serializeToString(clone);
}

export interface RasterizeOptions {
  width: number;
  height: number;
  background?: string;
  /** Output MIME type (defaults to image/png). */
  mimeType?: string;
  /** Quality used for lossy types like image/jpeg. */
  quality?: number;
}

/**
 * Rasterize an SVG element to an image Blob via an off-DOM <canvas>. Uses an
 * Image+Blob URL pipeline that works in modern browsers without extra deps.
 */
export async function rasterizeSvg(
  svg: SVGSVGElement,
  options: RasterizeOptions,
): Promise<Blob> {
  const source = serializeSvg(svg);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = options.width;
    canvas.height = options.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context is unavailable.");
    if (options.background) {
      ctx.fillStyle = options.background;
      ctx.fillRect(0, 0, options.width, options.height);
    }
    ctx.drawImage(image, 0, 0, options.width, options.height);
    const out = await canvasToBlob(canvas, options.mimeType ?? "image/png", options.quality);
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load SVG snapshot for rasterization."));
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas could not produce a Blob."));
      },
      type,
      quality,
    );
  });
}

import type { Board } from "./models/Board.js";
import type { BoardState } from "./common/types.js";

/**
 * Browser-only: trigger a file download from a Blob (`<a download>` + object URL).
 */
export function triggerDownloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Browser-only: download board state as a JSON file.
 */
export function downloadBoardStateJson(state: BoardState, filename: string): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });
  triggerDownloadBlob(blob, filename);
}

export interface DownloadBoardPngOptions {
  /** Passed through to `board.exportPNG` (defaults to board background). */
  background?: string;
}

/**
 * Browser-only: rasterize the board and download a PNG file.
 */
export async function downloadBoardPng(
  board: Board,
  filename: string,
  options: DownloadBoardPngOptions = {},
): Promise<void> {
  const blob = await board.exportPNG({ background: options.background });
  triggerDownloadBlob(blob, filename);
}

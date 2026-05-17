import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";
import type { CSSProperties } from "react";
import { createBoard } from "../Board.js";
import type { Board as BoardInstance } from "../Board.js";
import { downloadBoardPng, downloadBoardStateJson } from "../downloadBoard.js";
import { slugBoardName, storageKeyForBoardName } from "../boardIdentity.js";
import type { BoardConfig, BoardEventListener } from "../types.js";

export interface HtmlBlockBoardProps extends BoardConfig {
  /** Display name; drives default storage key and export filenames (see `storagePrefix` / `storageKey`). */
  name: string;
  /** Prefix for derived `storageKey` when `storageKey` is not set. Default `"html-block"`. */
  storagePrefix?: string;
  /** Board event subscription; cleaned up on unmount. */
  onEvent?: BoardEventListener;
  /** Classes on the outer wrapper `div` around the board mount point. */
  hostClassName?: string;
  /** Inline styles on the outer wrapper (e.g. `{ flex: 1, minHeight: 0 }`). */
  hostStyle?: CSSProperties;
}

export interface HtmlBlockBoardHandle {
  getInstance(): BoardInstance | null;
  exportJSON(fileName?: string): void;
  exportPNG(fileName?: string): Promise<void>;
}

/**
 * React wrapper around {@link createBoard}. Mount config is read once; change `name` /
 * storage identity by remounting with a different `key`.
 */
export const HtmlBlockBoard = forwardRef<HtmlBlockBoardHandle, HtmlBlockBoardProps>(
  function HtmlBlockBoard(props, ref) {
    const {
      name,
      storagePrefix = "html-block",
      onEvent,
      hostClassName,
      hostStyle,
      ...boardConfig
    } = props;

    const storageKey =
      boardConfig.storageKey ?? storageKeyForBoardName(name, storagePrefix);

    const rootRef = useRef<HTMLDivElement>(null);
    const boardRef = useRef<BoardInstance | null>(null);

    useLayoutEffect(() => {
      const el = rootRef.current;
      if (!el) return;

      const board = createBoard(el, { ...boardConfig, storageKey });
      boardRef.current = board;

      const unsub = onEvent ? board.on(onEvent) : undefined;

      return () => {
        unsub?.();
        board.destroy();
        boardRef.current = null;
      };
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        getInstance: () => boardRef.current,
        exportJSON: (fileName?: string) => {
          const b = boardRef.current;
          if (!b) return;
          downloadBoardStateJson(
            b.getState(),
            fileName ?? `${slugBoardName(name)}.json`,
          );
        },
        exportPNG: async (fileName?: string) => {
          const b = boardRef.current;
          if (!b) return;
          await downloadBoardPng(b, fileName ?? `${slugBoardName(name)}.png`);
        },
      }),
      [name],
    );

    return (
      <div
        ref={rootRef}
        className={hostClassName}
        style={{ width: "100%", height: "100%", minHeight: 0, ...hostStyle }}
      />
    );
  },
);

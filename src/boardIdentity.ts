/** Safe segment for `localStorage` keys and filenames (no slashes). */
export function slugBoardName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "board"
  );
}

export function storageKeyForBoardName(name: string, storagePrefix = "html-block"): string {
  return `${storagePrefix}:${slugBoardName(name)}`;
}

import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const browserDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(browserDir, "../..");

export default defineConfig({
  root: browserDir,
  server: {
    open: true,
    fs: {
      allow: [workspaceRoot],
    },
  },
});

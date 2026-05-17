import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const browserDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(browserDir, "../..");

export default defineConfig({
  root: browserDir,
  plugins: [react()],
  server: {
    open: true,
    fs: {
      allow: [workspaceRoot],
    },
  },
  build: {
    rollupOptions: {
      input: path.resolve(browserDir, "index.html"),
    },
  },
});

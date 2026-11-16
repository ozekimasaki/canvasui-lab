import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { storiesRegistry } from "./plugins/storiesRegistry";
import { penWatch } from "./plugins/penWatch";

const shim = (name: string) => resolve(__dirname, "electron/shims", name);

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: resolve(__dirname, "electron/main.ts"),
        external: ["better-sqlite3", "electron"],
      },
    },
    resolve: { alias: { "void/sse": shim("void-sse.ts"), void: shim("void.ts") } },
  },
  preload: {
    build: {
      rollupOptions: {
        input: resolve(__dirname, "electron/preload.ts"),
        output: { format: "cjs", entryFileNames: "preload.js" },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, "electron/renderer"),
    plugins: [
      react(),
      tailwindcss(),
      storiesRegistry({ projectRoot: resolve(__dirname) }),
      penWatch({ projectRoot: resolve(__dirname) }),
    ],
    resolve: {
      alias: {
        "void/client": shim("void-client.ts"),
        "void/live/client": shim("void-live-client.ts"),
        "void/sse": shim("void-sse.ts"),
      },
    },
    build: { rollupOptions: { input: "index.html" } },
  },
});

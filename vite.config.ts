import { voidReact } from "@void/react/plugin";
import { defineConfig, type UserConfig } from "vite";
import { voidPlugin } from "void";
import { penWatch } from "./plugins/penWatch";
import { sourceWriteback } from "./plugins/sourceWriteback";
import { storiesRegistry } from "./plugins/storiesRegistry";

export default defineConfig({
  optimizeDeps: { include: ["monaco-editor"] },
  lint: { options: { typeAware: true, typeCheck: true } },
  plugins: [sourceWriteback(), voidPlugin(), voidReact(), storiesRegistry(), penWatch()],
} as UserConfig);

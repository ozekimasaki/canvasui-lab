import { voidReact } from "@void/react/plugin";
import { defineConfig, type UserConfig } from "vite";
import { voidPlugin } from "void";
import { penWatch } from "./plugins/penWatch";
import { storiesRegistry } from "./plugins/storiesRegistry";

export default defineConfig({
  lint: { options: { typeAware: true, typeCheck: true } },
  plugins: [voidPlugin(), voidReact(), storiesRegistry(), penWatch()],
} as UserConfig);

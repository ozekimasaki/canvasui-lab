import type { Plugin } from "vite";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const virtualId = "virtual:pen-designs";
const resolvedId = `\0${virtualId}`;

export function penWatch(opts?: { projectRoot?: string }): Plugin {
  return {
    name: "canvasui-pen-watch",
    resolveId(id) {
      if (id === virtualId) return resolvedId;
      return undefined;
    },
    load(id) {
      if (id !== resolvedId) return undefined;
      const root = opts?.projectRoot ?? this.environment?.config?.root ?? process.cwd();
      const dir = join(root, "design");
      const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".pen")) : [];
      const imports = files
        .map((f, i) => `import raw${i} from ${JSON.stringify(join(dir, f) + "?raw")};`)
        .join("\n");
      const entries = files
        .map((f, i) => `  { path: ${JSON.stringify("/design/" + f)}, raw: raw${i} },`)
        .join("\n");
      return imports + "\nexport const designs = [\n" + entries + "\n];\n";
    },
  };
}

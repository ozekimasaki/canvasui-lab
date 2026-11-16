import type { Plugin } from "vite";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const virtualId = "virtual:stories-registry";
const resolvedId = `\0${virtualId}`;

export function storiesRegistry(opts?: { projectRoot?: string }): Plugin {
  return {
    name: "canvasui-stories-registry",
    resolveId(id) {
      if (id === virtualId) return resolvedId;
      return undefined;
    },
    load(id) {
      if (id !== resolvedId) return undefined;
      const root = opts?.projectRoot ?? this.environment?.config?.root ?? process.cwd();
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          if (entry.isDirectory()) walk(join(dir, entry.name));
          else if (entry.name.endsWith(".stories.tsx")) files.push(join(dir, entry.name));
        }
      };
      walk(join(root, "src/components"));
      const imports = files
        .map((f, i) => `import * as m${i} from ${JSON.stringify(f)};`)
        .join("\n");
      const entries = files.map((f, i) => `  ${JSON.stringify(f)}: m${i},`).join("\n");
      return (
        imports +
        "\nconst modules = {\n" +
        entries +
        "\n};\n" +
        "export const stories = Object.entries(modules).map(([path, mod]) => {\n  const { default: meta, ...rest } = mod;\n  return { path, meta: meta ?? {}, stories: Object.entries(rest).map(([name, story]) => ({ name, ...story })) };\n});\n"
      );
    },
  };
}

import type { Plugin } from "vite";

const virtualId = "virtual:pen-designs";
const resolvedId = `\0${virtualId}`;

export function penWatch(): Plugin {
  return {
    name: "canvasui-pen-watch",
    resolveId(id) {
      if (id === virtualId) return resolvedId;
      return undefined;
    },
    load(id) {
      if (id !== resolvedId) return undefined;
      return `
const files = import.meta.glob('/design/*.pen', { eager: true, query: '?raw', import: 'default' });
export const designs = Object.entries(files).map(([path, raw]) => ({ path, raw }));
`;
    },
  };
}

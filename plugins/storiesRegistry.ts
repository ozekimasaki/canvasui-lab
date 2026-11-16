import type { Plugin } from "vite";

const virtualId = "virtual:stories-registry";
const resolvedId = `\0${virtualId}`;

export function storiesRegistry(): Plugin {
  return {
    name: "canvasui-stories-registry",
    resolveId(id) {
      if (id === virtualId) return resolvedId;
      return undefined;
    },
    load(id) {
      if (id !== resolvedId) return undefined;
      return `
const modules = import.meta.glob('/src/components/**/*.stories.tsx', { eager: true });
export const stories = Object.entries(modules).map(([path, mod]) => {
  const { default: meta, ...rest } = mod;
  return {
    path,
    meta: meta ?? {},
    stories: Object.entries(rest).map(([name, story]) => ({ name, ...story })),
  };
});
`;
    },
  };
}

import { createElement, type ComponentType, type ReactNode } from "react";
import { stories, type RawStoryModule } from "virtual:stories-registry";
import type { ComponentSpecData } from "../domain/brands";
import type { MatrixCell } from "../domain/matrix";

export function deriveAxes(meta: RawStoryModule["meta"]): Record<string, string[]> {
  const parameters = meta.parameters as
    | { matrix?: { axes?: Record<string, string[]> } }
    | undefined;
  if (parameters?.matrix?.axes) return parameters.matrix.axes;
  const axes: Record<string, string[]> = {};
  const argTypes = (meta.argTypes ?? {}) as Record<
    string,
    { options?: unknown[]; control?: unknown }
  >;
  for (const [name, def] of Object.entries(argTypes)) {
    if (Array.isArray(def.options) && def.options.every((o) => typeof o === "string")) {
      axes[name] = def.options as string[];
    } else if (def.control === "boolean") {
      axes[name] = ["true", "false"];
    }
  }
  return axes;
}

function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildSpecs(): {
  specs: ComponentSpecData[];
  renderCell: (cell: MatrixCell) => ReactNode;
} {
  const byId = new Map<string, RawStoryModule>();
  const specs: ComponentSpecData[] = [];
  for (const mod of stories) {
    const title = mod.meta.title ?? mod.path;
    const id = slug(title);
    byId.set(id, mod);
    specs.push({
      id,
      title,
      filePath: mod.path.replace(/^\//, "").replace(/\.stories\.tsx$/, ".tsx"),
      axes: deriveAxes(mod.meta),
      // Module namespace keys are alphabetically sorted by spec, so story order
      // is not source order; component defaults are the stable base instead.
      defaultArgs: {},
    });
  }
  const renderCell = (cell: MatrixCell): ReactNode => {
    const mod = byId.get(cell.componentId);
    const component = mod?.meta.component as ComponentType<Record<string, unknown>> | undefined;
    if (!component) return null;
    const { theme: _theme, ...props } = cell.args;
    return createElement(component, props);
  };
  return { specs, renderCell };
}

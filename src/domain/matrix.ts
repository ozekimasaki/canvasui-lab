import type { ComponentSpecData } from "./brands";

export interface MatrixCell {
  componentId: string;
  cellKey: string;
  axisValues: Record<string, string>;
  args: Record<string, unknown>;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutOptions {
  cellWidth: number;
  cellHeight: number;
  gapX: number;
  gapY: number;
  clusterGap: number;
}

export const defaultLayoutOptions: LayoutOptions = {
  cellWidth: 280,
  cellHeight: 180,
  gapX: 32,
  gapY: 32,
  clusterGap: 160,
};

export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function cellKeyFor(componentId: string, axisValues: Record<string, string>): string {
  const stable = Object.keys(axisValues)
    .sort()
    .map((k) => `${k}=${axisValues[k]}`)
    .join("&");
  return `${componentId}:${fnv1a(stable)}`;
}

export function cartesian(axes: Record<string, readonly string[]>): Record<string, string>[] {
  const names = Object.keys(axes).sort();
  let combos: Record<string, string>[] = [{}];
  for (const name of names) {
    const values = axes[name];
    if (values.length === 0) continue;
    const next: Record<string, string>[] = [];
    for (const combo of combos) {
      for (const value of values) {
        next.push({ ...combo, [name]: value });
      }
    }
    combos = next;
  }
  return combos;
}

export function axisNames(spec: ComponentSpecData): string[] {
  return Object.keys(spec.axes).sort();
}

export function layoutComponent(
  spec: ComponentSpecData,
  originX: number,
  originY: number,
  opts: LayoutOptions,
): MatrixCell[] {
  const names = axisNames(spec);
  const [xAxis, yAxis, ...rest] = names;
  const cells: MatrixCell[] = [];

  const gridAxes: Record<string, readonly string[]> = {};
  if (xAxis) gridAxes[xAxis] = spec.axes[xAxis];
  if (yAxis) gridAxes[yAxis] = spec.axes[yAxis];
  const gridCombos = cartesian(gridAxes);

  const restCombos =
    rest.length > 0 ? cartesian(Object.fromEntries(rest.map((n) => [n, spec.axes[n]]))) : [{}];
  const rows = yAxis ? spec.axes[yAxis].length : 1;
  const blockHeight = rows * (opts.cellHeight + opts.gapY);

  for (let blockIndex = 0; blockIndex < restCombos.length; blockIndex++) {
    const restValues = restCombos[blockIndex];
    const blockX = originX;
    const blockY = originY + blockIndex * (blockHeight + opts.clusterGap);
    for (const combo of gridCombos) {
      const col = xAxis ? spec.axes[xAxis].indexOf(combo[xAxis]) : 0;
      const row = yAxis ? spec.axes[yAxis].indexOf(combo[yAxis]) : 0;
      const axisValues = { ...restValues, ...combo };
      cells.push({
        componentId: spec.id,
        cellKey: cellKeyFor(spec.id, axisValues),
        axisValues,
        args: { ...spec.defaultArgs, ...axisValues },
        x: blockX + col * (opts.cellWidth + opts.gapX),
        y: blockY + row * (opts.cellHeight + opts.gapY),
        width: opts.cellWidth,
        height: opts.cellHeight,
      });
    }
  }
  return cells;
}

export function layoutMatrix(
  specs: readonly ComponentSpecData[],
  opts: LayoutOptions = defaultLayoutOptions,
): MatrixCell[] {
  const cells: MatrixCell[] = [];
  let cursorY = 0;
  for (const spec of specs) {
    const componentCells = layoutComponent(spec, 0, cursorY, opts);
    cells.push(...componentCells);
    const maxY = componentCells.reduce((m, c) => Math.max(m, c.y + c.height), cursorY);
    cursorY = maxY + opts.clusterGap * 2;
  }
  return cells;
}

export function matrixBounds(cells: readonly MatrixCell[]): { width: number; height: number } {
  let width = 0;
  let height = 0;
  for (const cell of cells) {
    width = Math.max(width, cell.x + cell.width);
    height = Math.max(height, cell.y + cell.height);
  }
  return { width, height };
}

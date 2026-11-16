import type { DiffBounds } from "./brands";

export const DEFAULT_DIFF_THRESHOLD = 0.001;

export function normalizeBounds(
  bounds: DiffBounds,
  width: number,
  height: number,
): [number, number, number, number] {
  if (width <= 0 || height <= 0) return [0, 0, 1, 1];
  const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
  return [
    clamp01(bounds.x / width),
    clamp01(bounds.y / height),
    clamp01(bounds.width / width),
    clamp01(bounds.height / height),
  ];
}

export function isSignificantDiff(diffRatio: number, threshold = DEFAULT_DIFF_THRESHOLD): boolean {
  return diffRatio > threshold;
}

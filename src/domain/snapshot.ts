import type { SnapshotKind, SnapshotSource } from "./brands";

export const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
export const MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024;
export const MAX_DIMENSION = 8192;

export function hasPngMagic(bytes: Uint8Array): boolean {
  if (bytes.length < 24) return false;
  return PNG_MAGIC.every((b, i) => bytes[i] === b);
}

export function readPngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (!hasPngMagic(bytes)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width === 0 || height === 0) return null;
  return { width, height };
}

export function r2KeyFor(
  kind: SnapshotKind,
  source: SnapshotSource,
  componentId: string,
  cellKey: string,
  contentHash: string,
): string {
  const safeCell = cellKey.replace(/[^a-zA-Z0-9:_-]/g, "_");
  if (kind === "design") {
    return `design/${source}/${componentId}/${safeCell}/${contentHash}.png`;
  }
  if (kind === "baseline") {
    return `baselines/${componentId}/${safeCell}/${contentHash}.png`;
  }
  return `runs/${componentId}/${safeCell}/${contentHash}.png`;
}

export function baselinePrefix(componentId: string, cellKey: string): string {
  const safeCell = cellKey.replace(/[^a-zA-Z0-9:_-]/g, "_");
  return `baselines/${componentId}/${safeCell}/`;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

import { apiFetch } from "./api";
import { diffImages, toBlob, type GpuCanvas } from "gpucanvas";
import type { DiffBounds } from "../domain/brands";
import type { MatrixCell } from "../domain/matrix";
import { isSignificantDiff, normalizeBounds } from "../domain/vrt";
import { vrtDiffEffect } from "./effects/vrtDiff";

export interface VrtProgress {
  done: number;
  total: number;
  phase: "capture" | "diff" | "submit";
}

interface VrtResultPayload {
  cellKey: string;
  changed: boolean;
  diffRatio: number;
  bounds: DiffBounds | null;
}

const CHUNK_SIZE = 6;

function elementFor(canvas: GpuCanvas, cell: MatrixCell): HTMLElement | null {
  const nodes = canvas.getNodesIn({
    x: cell.x,
    y: cell.y,
    width: cell.width,
    height: cell.height,
  });
  return nodes[0] ?? null;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function blobToImageData(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob);
  const surface = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = surface.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable for baseline decode");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return ctx.getImageData(0, 0, surface.width, surface.height);
}

async function postJson(url: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await apiFetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: unknown = await res.json();
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? typeof data.error === "string"
          ? data.error
          : JSON.stringify(data.error)
        : `Request failed: ${res.status}`;
    throw new Error(message);
  }
  return data as Record<string, unknown>;
}

async function uploadSnapshot(
  meta: {
    componentId: string;
    cellKey: string;
    kind: "baseline" | "run";
    width: number;
    height: number;
    scale: number;
  },
  png: Blob,
): Promise<{ r2Key: string }> {
  const form = new FormData();
  form.set("componentId", meta.componentId);
  form.set("cellKey", meta.cellKey);
  form.set("kind", meta.kind);
  form.set("source", "implementation");
  form.set("width", String(meta.width));
  form.set("height", String(meta.height));
  form.set("scale", String(meta.scale));
  form.set("png", png, "snapshot.png");
  const res = await apiFetch("/api/snapshots", { method: "POST", body: form });
  if (!res.ok) {
    const data: unknown = await res.json().catch(() => null);
    const message =
      data && typeof data === "object" && "error" in data
        ? typeof data.error === "string"
          ? data.error
          : JSON.stringify(data.error)
        : `Upload failed: ${res.status}`;
    throw new Error(message);
  }
  return (await res.json()) as { r2Key: string };
}

export async function runVrtCheck(
  canvas: GpuCanvas,
  cells: MatrixCell[],
  onProgress?: (progress: VrtProgress) => void,
): Promise<{ runId: string; changedCellKeys: string[] }> {
  if (canvas.mode !== "gpu") {
    throw new Error("VRT requires the GPU backend (Chrome 157+).");
  }
  const results: VrtResultPayload[] = [];
  const changedCellKeys: string[] = [];
  const highlighted: {
    cell: MatrixCell;
    element: HTMLElement;
    after: ImageData;
    bounds: DiffBounds | null;
  }[] = [];
  let done = 0;

  for (let i = 0; i < cells.length; i += CHUNK_SIZE) {
    const chunk = cells.slice(i, i + CHUNK_SIZE);
    for (const cell of chunk) {
      const element = elementFor(canvas, cell);
      if (!element) {
        done++;
        continue;
      }
      canvas.setEffect(element, null);
      const after = await canvas.snapshot(element, { scale: 2 });
      onProgress?.({ done, total: cells.length, phase: "capture" });
      const res = await apiFetch(
        `/api/snapshots/baseline?componentId=${encodeURIComponent(cell.componentId)}&cellKey=${encodeURIComponent(cell.cellKey)}`,
      );
      if (res.status === 404) {
        done++;
        onProgress?.({ done, total: cells.length, phase: "diff" });
        continue;
      }
      if (!res.ok) throw new Error(`Baseline fetch failed: ${res.status}`);
      const before = await blobToImageData(await res.blob());
      const diff = diffImages(before, after, { threshold: 10 });
      const ratio = diff.total > 0 ? diff.changed / diff.total : 0;
      const changed = isSignificantDiff(ratio);
      results.push({ cellKey: cell.cellKey, changed, diffRatio: ratio, bounds: diff.bounds });
      if (changed) {
        changedCellKeys.push(cell.cellKey);
        highlighted.push({ cell, element, after, bounds: diff.bounds });
      }
      done++;
      onProgress?.({ done, total: cells.length, phase: "diff" });
    }
    await nextFrame();
  }

  if (results.length === 0) {
    throw new Error("No baselines found. Approve a baseline for at least one cell first.");
  }
  onProgress?.({ done, total: cells.length, phase: "submit" });
  const submitted = await postJson("/api/vrt/runs", { results });
  const runId = String(submitted.runId);

  for (const item of highlighted) {
    const png = await toBlob(item.after);
    await uploadSnapshot(
      {
        componentId: item.cell.componentId,
        cellKey: item.cell.cellKey,
        kind: "run",
        width: item.after.width,
        height: item.after.height,
        scale: 2,
      },
      png,
    );
    if (item.bounds) {
      canvas.setEffect(
        item.element,
        vrtDiffEffect,
        normalizeBounds(item.bounds, item.after.width, item.after.height),
      );
    } else {
      canvas.setEffect(item.element, vrtDiffEffect);
    }
  }
  return { runId, changedCellKeys };
}

export async function approveBaseline(canvas: GpuCanvas, cell: MatrixCell): Promise<void> {
  if (canvas.mode !== "gpu") {
    throw new Error("Baseline capture requires the GPU backend (Chrome 157+).");
  }
  const element = elementFor(canvas, cell);
  if (!element) throw new Error("Cell element not found on canvas");
  const image = await canvas.snapshot(element, { scale: 2 });
  const png = await toBlob(image);
  await uploadSnapshot(
    {
      componentId: cell.componentId,
      cellKey: cell.cellKey,
      kind: "baseline",
      width: image.width,
      height: image.height,
      scale: 2,
    },
    png,
  );
  canvas.setEffect(element, null);
}

export async function captureCellSnapshot(
  canvas: GpuCanvas,
  cell: MatrixCell,
  scale = 2,
): Promise<{ r2Key: string }> {
  if (canvas.mode !== "gpu") {
    throw new Error("Snapshot requires the GPU backend (Chrome 157+).");
  }
  const element = elementFor(canvas, cell);
  if (!element) throw new Error("Cell element not found on canvas");
  const image = await canvas.snapshot(element, { scale });
  const png = await toBlob(image);
  return uploadSnapshot(
    {
      componentId: cell.componentId,
      cellKey: cell.cellKey,
      kind: "run",
      width: image.width,
      height: image.height,
      scale,
    },
    png,
  );
}

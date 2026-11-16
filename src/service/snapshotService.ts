import { z } from "zod";
import type { ValidatedSnapshot } from "../domain/brands";
import {
  MAX_DIMENSION,
  MAX_SNAPSHOT_BYTES,
  readPngDimensions,
  sha256Hex,
} from "../domain/snapshot";
import type { SnapshotRepo } from "../repository/snapshotRepo";
import { ServiceError } from "./errors";

const metaSchema = z.object({
  componentId: z.string().min(1).max(200),
  cellKey: z.string().min(1).max(300),
  kind: z.enum(["baseline", "run", "design"]),
  source: z.enum(["implementation", "figma", "pen"]),
  width: z.number().int().positive().max(MAX_DIMENSION),
  height: z.number().int().positive().max(MAX_DIMENSION),
  scale: z.number().positive().max(8),
});

export function createSnapshotService(deps: { snapshots: SnapshotRepo }) {
  return {
    async save(input: unknown, png: Uint8Array) {
      const meta = metaSchema.parse(input);
      if (png.byteLength === 0 || png.byteLength > MAX_SNAPSHOT_BYTES) {
        throw new ServiceError("PNG size out of range");
      }
      const dims = readPngDimensions(png);
      if (!dims) throw new ServiceError("Invalid PNG bytes");
      if (dims.width !== meta.width || dims.height !== meta.height) {
        throw new ServiceError("PNG dimensions do not match declared metadata");
      }
      const contentHash = await sha256Hex(png);
      const validated = { ...meta, png, contentHash } as ValidatedSnapshot;
      return deps.snapshots.save(validated);
    },
    async baseline(componentId: string, cellKey: string) {
      const row = await deps.snapshots.latestBaseline(componentId, cellKey);
      if (!row) return null;
      const png = await deps.snapshots.png(row.r2Key);
      return png ? { row, png } : null;
    },
    async design(componentId: string, cellKey: string) {
      const row = await deps.snapshots.latestDesign(componentId, cellKey);
      if (!row) return null;
      const png = await deps.snapshots.png(row.r2Key);
      return png ? { row, png } : null;
    },
    async history(componentId: string, cellKey: string) {
      return deps.snapshots.listByCell(componentId, cellKey);
    },
    async baselines() {
      return deps.snapshots.listBaselines();
    },
    async pngByKey(r2Key: string) {
      return deps.snapshots.png(r2Key);
    },
  };
}

export type SnapshotService = ReturnType<typeof createSnapshotService>;

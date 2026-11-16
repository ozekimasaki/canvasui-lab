import type { EnvPort } from "../ports";
import { z } from "zod";
import type { ValidatedFigmaLink } from "../domain/brands";
import { readPngDimensions } from "../domain/snapshot";
import type { FigmaRepo } from "../repository/figmaRepo";
import { ServiceError } from "./errors";
import type { SnapshotService } from "./snapshotService";

const requestSchema = z.object({
  componentId: z.string().min(1).max(200),
  fileKey: z.string().min(1).max(200),
  nodeIds: z.array(z.string().min(1)).min(1).max(50),
  scale: z.number().min(0.5).max(4).default(2),
});

export function createFigmaService(deps: {
  snapshots: SnapshotService;
  figma: FigmaRepo;
  env: EnvPort;
}) {
  return {
    async fetchFrameImages(input: unknown) {
      const req = requestSchema.parse(input);
      const token = deps.env.get("FIGMA_TOKEN");
      if (!token) throw new ServiceError("FIGMA_TOKEN is not configured", 503);
      const url = `https://api.figma.com/v1/images/${req.fileKey}?ids=${encodeURIComponent(req.nodeIds.join(","))}&format=png&scale=${req.scale}`;
      const res = await fetch(url, { headers: { "X-Figma-Token": token } });
      if (!res.ok) {
        throw new ServiceError(`Figma Images API responded ${res.status}`, 502);
      }
      const data = (await res.json()) as { images?: Record<string, string | null>; err?: string };
      if (data.err) throw new ServiceError(`Figma API error: ${data.err}`, 502);
      const results: { nodeId: string; snapshotId: string; r2Key: string }[] = [];
      for (const nodeId of req.nodeIds) {
        const imageUrl = data.images?.[nodeId];
        if (!imageUrl) continue;
        const imageRes = await fetch(imageUrl);
        if (!imageRes.ok)
          throw new ServiceError(`Failed to download Figma render for ${nodeId}`, 502);
        const png = new Uint8Array(await imageRes.arrayBuffer());
        const dims = readPngDimensions(png);
        if (!dims) throw new ServiceError(`Figma render for ${nodeId} is not a valid PNG`, 502);
        const cellKey = `figma:${nodeId.replace(/[^a-zA-Z0-9:_-]/g, "_")}`;
        const row = await deps.snapshots.save(
          {
            componentId: req.componentId,
            cellKey,
            kind: "design",
            source: "figma",
            width: dims.width,
            height: dims.height,
            scale: req.scale,
          },
          png,
        );
        const link = {
          componentId: req.componentId,
          fileKey: req.fileKey,
          nodeId,
          r2Key: row.r2Key,
        } as ValidatedFigmaLink;
        await deps.figma.saveLink(link);
        results.push({ nodeId, snapshotId: row.id, r2Key: row.r2Key });
      }
      return { imported: results.length, results };
    },
    async listLinks() {
      return deps.figma.listLinks();
    },
  };
}

export type FigmaService = ReturnType<typeof createFigmaService>;

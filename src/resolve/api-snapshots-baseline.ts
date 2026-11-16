import type { Context } from "hono";
import type { Services } from "../factory";
import { errorJson } from "../service/errors";
export const GET = (services: Services) => async (c: Context) => {
  try {
    const componentId = c.req.query("componentId") ?? "";
    const cellKey = c.req.query("cellKey") ?? "";
    const result = await services.snapshots.baseline(componentId, cellKey);
    if (!result) return c.json({ error: "No baseline for this cell" }, 404);
    return new Response(result.png.slice().buffer as ArrayBuffer, {
      headers: {
        "content-type": "image/png",
        etag: result.row.contentHash,
        "cache-control": "no-cache",
      },
    });
  } catch (error) {
    return errorJson(error);
  }
};

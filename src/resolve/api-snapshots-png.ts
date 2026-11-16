import type { Context } from "hono";
import type { Services } from "../factory";

const ALLOWED_PREFIXES = ["baselines/", "runs/", "design/"];
import { errorJson } from "../service/errors";
export const GET = (services: Services) => async (c: Context) => {
  try {
    const key = c.req.query("key") ?? "";
    if (!ALLOWED_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      return c.json({ error: "Key must start with baselines/, runs/ or design/" }, 400);
    }
    const png = await services.snapshots.pngByKey(key);
    if (!png) return c.json({ error: "Object not found" }, 404);
    return new Response(png.slice().buffer as ArrayBuffer, {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return errorJson(error);
  }
};

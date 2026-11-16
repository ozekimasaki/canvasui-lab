import { defineHandler } from "void";
import { services } from "../../../src/factory";
import { errorJson } from "../../../src/service/errors";

const ALLOWED_PREFIXES = ["baselines/", "runs/", "design/"];

export const GET = defineHandler(async (c) => {
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
});

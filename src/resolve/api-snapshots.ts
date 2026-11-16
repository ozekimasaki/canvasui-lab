import type { Context } from "hono";
import type { Services } from "../factory";
import { errorJson } from "../service/errors";
export const POST = (services: Services) => async (c: Context) => {
  try {
    const body = await c.req.parseBody();
    const file = body.png;
    if (!(file instanceof File)) {
      return c.json({ error: "multipart field 'png' (File) is required" }, 400);
    }
    const png = new Uint8Array(await file.arrayBuffer());
    const field = (value: string | File | (string | File)[] | undefined): string =>
      typeof value === "string" ? value : "";
    const row = await services.snapshots.save(
      {
        componentId: field(body.componentId),
        cellKey: field(body.cellKey),
        kind: field(body.kind),
        source: field(body.source),
        width: Number(body.width),
        height: Number(body.height),
        scale: Number(body.scale),
      },
      png,
    );
    return c.json(row);
  } catch (error) {
    return errorJson(error);
  }
};

import type { Context } from "hono";
import type { Services } from "../factory";
export const GET = (_services: Services) => (c: Context) => {
  return c.json({ ok: true, service: "canvasui-lab" });
};

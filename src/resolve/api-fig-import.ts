import type { Context } from "hono";
import type { Services } from "../factory";

export const POST = (services: Services) => async (c: Context) => {
  const body = await c.req.json();
  return c.json(await services.figImport.importFig(body));
};

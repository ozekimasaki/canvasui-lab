import type { Context } from "hono";
import type { Services } from "../factory";

export const POST = (services: Services) => async (c: Context) => {
  return c.json(await services.heal.run(await c.req.json()));
};

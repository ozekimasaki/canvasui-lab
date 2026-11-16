import type { Context } from "hono";
import type { Services } from "../factory";

export const POST = (services: Services) => async (c: Context) => {
  return c.json(await services.chat.chat(await c.req.json()));
};

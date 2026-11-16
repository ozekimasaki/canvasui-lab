import type { Context } from "hono";
import type { Services } from "../factory";
import { errorJson } from "../service/errors";
export const GET = (services: Services) => async (c: Context) => {
  try {
    const path = c.req.query("path") ?? "";
    return c.json(await services.source.read(path));
  } catch (error) {
    return errorJson(error);
  }
};
export const POST = (services: Services) => async (c: Context) => {
  try {
    const body = (await c.req.json()) as { action?: string };
    if (body.action === "apply") return c.json(await services.source.apply(body));
    if (body.action === "history") return c.json(await services.source.history());
    return c.json(await services.source.propose(body));
  } catch (error) {
    return errorJson(error);
  }
};

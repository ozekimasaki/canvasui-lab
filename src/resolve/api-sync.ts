import type { Context } from "hono";
import type { Services } from "../factory";

export const GET = (services: Services) => async (c: Context) => {
  const docId = c.req.query("docId") ?? "main";
  return c.json(await services.sync.pull(docId));
};

export const POST = (services: Services) => async (c: Context) => {
  const body = (await c.req.json()) as { type?: string };
  if (body.type === "presence") return c.json(await services.sync.pushPresence(body));
  return c.json(await services.sync.pushLayout(body));
};

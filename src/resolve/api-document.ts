import type { Context } from "hono";
import type { Services } from "../factory";

export const GET = (services: Services) => async (c: Context) => {
  const id = c.req.query("id");
  if (id) return c.json(await services.documents.get(id));
  return c.json(await services.documents.list());
};

export const PUT = (services: Services) => async (c: Context) => {
  const doc = await c.req.json();
  await services.documents.put(doc);
  return c.json({ ok: true });
};

export const POST = (services: Services) => async (c: Context) => {
  const body = (await c.req.json()) as { id: string; actions: unknown[] };
  return c.json(await services.documents.apply(body.id, body.actions ?? []));
};

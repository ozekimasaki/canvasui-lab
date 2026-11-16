import { defineHandler } from "void";
import { services } from "../../src/factory";
import { errorJson } from "../../src/service/errors";

export const GET = defineHandler(async (c) => {
  try {
    const path = c.req.query("path") ?? "";
    return c.json(await services.source.read(path));
  } catch (error) {
    return errorJson(error);
  }
});

export const POST = defineHandler(async (c) => {
  try {
    const body = (await c.req.json()) as { action?: string };
    if (body.action === "apply") return c.json(await services.source.apply(body));
    if (body.action === "history") return c.json(await services.source.history());
    return c.json(await services.source.propose(body));
  } catch (error) {
    return errorJson(error);
  }
});

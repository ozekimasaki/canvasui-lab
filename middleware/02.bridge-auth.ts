import { defineMiddleware } from "void";
import { env } from "void/env";

export default defineMiddleware(async (c, next) => {
  if (c.req.path.startsWith("/api/bridge") && env.BRIDGE_TOKEN) {
    if (c.req.header("x-bridge-token") !== env.BRIDGE_TOKEN) {
      return c.json({ error: "bridge token required" }, 401);
    }
  }
  await next();
});

import { defineMiddleware } from "void";
import { env } from "void/env";

export default defineMiddleware(async (c, next) => {
  if (c.req.path.startsWith("/api/mcp") && env.MCP_AUTH_TOKEN) {
    const header = c.req.header("authorization");
    const bearer = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    const token = bearer ?? c.req.query("token");
    if (token !== env.MCP_AUTH_TOKEN) {
      return c.json({ error: "MCP bearer token required" }, 401);
    }
  }
  await next();
});

import type { Context } from "hono";
import type { Services } from "../factory";
import { eventStream } from "void/sse";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export const GET = (services: Services) => async (c: Context) => {
  const sessionId = crypto.randomUUID();
  await services.mcpRepo.createSession(sessionId, "pending", "{}", 60 * 60 * 1000);
  return eventStream(
    async (stream) => {
      await stream.send({ event: "endpoint", data: `/api/mcp/messages?sessionId=${sessionId}` });
      for (;;) {
        if (c.req.raw.signal.aborted) break;
        const rows = await services.mcpRepo.drainOutbox(sessionId);
        for (const row of rows) {
          await stream.send({ event: "message", data: row.payload });
        }
        await sleep(250);
      }
    },
    { signal: c.req.raw.signal },
  );
};

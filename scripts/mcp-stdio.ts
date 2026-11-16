import { createLocalServices } from "../src/factory/local";
import { dispatchRpc, type JsonRpcMessage } from "../routes/api/mcp/_dispatch";
import { join } from "node:path";
import { homedir } from "node:os";

const services = createLocalServices({
  dataDir: process.env.CUL_DATA_DIR ?? join(homedir(), ".canvasui"),
  migrationsFolder: join(process.cwd(), "db/migrations"),
  projectRoot: process.cwd(),
  cfAccountId: process.env.CF_ACCOUNT_ID,
  cfApiToken: process.env.CF_API_TOKEN,
});

let buffer = "";
let session: string | null = null;
process.stdin.on("data", (chunk) => {
  buffer += chunk.toString();
  let index: number;
  while ((index = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    void (async () => {
      const msg = JSON.parse(line) as JsonRpcMessage | JsonRpcMessage[];
      const responses: unknown[] = [];
      const handle = async (single: JsonRpcMessage): Promise<void> => {
        const { response, newSession } = await dispatchRpc(
          services,
          single.method === "initialize" ? null : session,
          single,
        );
        if (newSession) session = newSession;
        if (response) responses.push(response);
      };
      if (Array.isArray(msg)) {
        for (const single of msg) await handle(single);
      } else {
        await handle(msg);
      }
      for (const response of responses) process.stdout.write(JSON.stringify(response) + "\n");
    })();
  }
});

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const URL_BASE = "https://canvasui-lab.maigo999.workers.dev";
const TOKEN = process.env.MCP_PROD_TOKEN;
const client = new Client({ name: "prod-pr-check", version: "0.0.0" });
await client.connect(
  new StreamableHTTPClientTransport(new URL(`${URL_BASE}/api/mcp`), {
    requestInit: { headers: { authorization: `Bearer ${TOKEN}` } },
  }),
);
const text = (r) => r.content[0].text;
const tools = await client.listTools();
console.log("prod tools:", tools.tools.length);

const read = JSON.parse(
  text(
    await client.callTool({
      name: "source.read",
      arguments: { filePath: "src/components/Button/Button.tsx" },
    }),
  ),
);
console.log("github read hash:", read.hash.slice(0, 10));
const modified = read.content.replace('label = "Continue"', 'label = "Proceed"');
const proposed = JSON.parse(
  text(
    await client.callTool({
      name: "source.propose",
      arguments: { filePath: read.filePath, baseHash: read.hash, content: modified },
    }),
  ),
);
console.log("propose edits:", proposed.patch.edits.length);
const pr = JSON.parse(
  text(
    await client.callTool({
      name: "pr.open",
      arguments: {
        branch: "canvasui/ai-label-update",
        title: "AI: update Button default label",
        body: "Autonomous AST patch from CanvasUI Lab MCP audit flow.",
        patches: [proposed.patch],
      },
    }),
  ),
);
console.log("PR:", pr.url, pr.branch);
await client.close();

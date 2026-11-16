import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { describe, expect, it } from "vite-plus/test";

const BASE = "http://localhost:5173";

describe("remote MCP server (SDK client compliance)", () => {
  it("Streamable HTTP: initialize, tools/list, tools/call", async () => {
    const client = new Client({ name: "canvasui-test", version: "0.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`${BASE}/api/mcp`));
    await client.connect(transport);
    const tools = await client.listTools();
    const names = tools.tools.map((tool) => tool.name);
    expect(names).toContain("canvas.cells");
    expect(names).toContain("source.propose");
    expect(names).toContain("pr.open");
      await fetch(`${BASE}/api/components`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          specs: [
            {
              id: "button",
              title: "Button",
              filePath: "src/components/Button/Button.tsx",
              axes: { size: ["sm", "md"] },
              defaultArgs: {},
            },
          ],
        }),
      });
    const cells = await client.callTool({ name: "canvas.cells", arguments: {} });
    const text = (cells.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text).length).toBeGreaterThan(0);
    const read = await client.callTool({
      name: "source.read",
      arguments: { filePath: "src/components/Button/Button.tsx" },
    });
    expect((read.content as { text: string }[])[0].text).toContain("Button");
    await client.close();
  }, 30_000);

  it("legacy SSE: endpoint event, initialize, tools/call", async () => {
    const client = new Client({ name: "canvasui-test-sse", version: "0.0.0" });
    const transport = new SSEClientTransport(new URL(`${BASE}/api/mcp/sse`));
    await client.connect(transport);
    const tools = await client.listTools();
    expect(tools.tools.length).toBeGreaterThan(5);
    const result = await client.callTool({ name: "vrt.baselines", arguments: {} });
    expect((result.content as { type: string }[])[0].type).toBe("text");
    await client.close();
  }, 30_000);
});

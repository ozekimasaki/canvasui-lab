import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

describe("local stdio MCP", () => {
  it("initialize, tools/list (incl. heal.run), tools/call", async () => {
    const root = join(__dirname, "../..");
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["--import", "tsx", join(root, "scripts/mcp-stdio.ts")],
      cwd: root,
      env: { ...process.env, CUL_PROJECT: root },
    });
    const client = new Client({ name: "stdio-test", version: "1.0.0" });
    await client.connect(transport);
    const tools = await client.listTools();
    expect(tools.tools.length).toBeGreaterThanOrEqual(13);
    expect(tools.tools.some((tool) => tool.name === "heal.run")).toBe(true);
    const result = await client.callTool({ name: "canvas.cells", arguments: {} });
    expect(result.content).toBeDefined();
    await client.close();
  }, 60000);
});

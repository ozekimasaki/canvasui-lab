import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const client = new Client({ name: "bridge-test", version: "0.0.0" });
await client.connect(new StreamableHTTPClientTransport(new URL("http://localhost:5173/api/mcp")));
const text = (r) => r.content[0].text;

const desc = await client.callTool({ name: "canvas.describe", arguments: {} });
const state = JSON.parse(text(desc));
console.log("describe: cells =", state.cells?.length, "view nodes =", state.view?.length);

const snap = await client.callTool({ name: "canvas.snapshot", arguments: { cellKey: "button:613c3127", scale: 1 } });
console.log("snapshot content type:", snap.content[0].type, "base64 bytes:", snap.content[0].data?.length);

const vrt = await client.callTool({ name: "vrt.run", arguments: {} });
console.log("vrt.run:", text(vrt).slice(0, 120));

const audit = await client.callTool({ name: "audit.run", arguments: {} });
console.log("audit.run:", text(audit).slice(0, 120));

await client.close();

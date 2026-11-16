import type { Services } from "../../../src/factory";

export interface JsonRpcMessage {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

const PROTOCOL_VERSION = "2025-03-26";
const SESSION_TTL_MS = 60 * 60 * 1000;

function rpcError(id: string | number | null | undefined, code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

export async function dispatchRpc(
  services: Services,
  sessionId: string | null,
  msg: JsonRpcMessage,
): Promise<{ response?: unknown; newSession?: string }> {
  const id = msg.id;
  const isNotification = id === undefined || id === null;
  const method = msg.method ?? "";

  if (method === "initialize") {
    const params = msg.params ?? {};
    const clientVersion =
      typeof params.protocolVersion === "string" ? params.protocolVersion : PROTOCOL_VERSION;
    const version =
      clientVersion === "2024-11-05" || clientVersion === PROTOCOL_VERSION
        ? clientVersion
        : PROTOCOL_VERSION;
    const session = sessionId ?? crypto.randomUUID();
    if (sessionId) {
      await services.mcpRepo.initSession(session, version, JSON.stringify(params.clientInfo ?? {}));
    } else {
      await services.mcpRepo.createSession(
        session,
        version,
        JSON.stringify(params.clientInfo ?? {}),
        SESSION_TTL_MS,
      );
    }
    return {
      newSession: session,
      response: {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: version,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "canvasui-lab", version: "1.0.0" },
        },
      },
    };
  }

  if (!sessionId) return { response: rpcError(id, -32002, "missing session: initialize first") };
  const session = await services.mcpRepo.session(sessionId);
  if (!session) return { response: rpcError(id, -32002, "unknown or expired session") };

  if (method === "notifications/initialized") {
    await services.mcpRepo.markInitialized(sessionId);
    return {};
  }
  if (method === "ping") return { response: { jsonrpc: "2.0", id, result: {} } };

  if (!session.initialized) {
    return { response: rpcError(id, -32002, "server not initialized") };
  }

  if (method === "tools/list") {
    return { response: { jsonrpc: "2.0", id, result: { tools: services.mcp.listTools() } } };
  }
  if (method === "tools/call") {
    const params = msg.params ?? {};
    const name = typeof params.name === "string" ? params.name : "";
    try {
      const result = await services.mcp.callTool(name, params.arguments);
      return { response: { jsonrpc: "2.0", id, result } };
    } catch (error) {
      const message = error instanceof Error ? error.message : "tool failed";
      return {
        response: {
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: message }], isError: true },
        },
      };
    }
  }
  if (isNotification) return {};
  return { response: rpcError(id, -32601, `method not found: ${method}`) };
}

export async function dispatchBatch(services: Services, sessionId: string | null, body: unknown) {
  if (Array.isArray(body)) {
    const out = [];
    for (const item of body) {
      const { response } = await dispatchRpc(services, sessionId, item as JsonRpcMessage);
      if (response) out.push(response);
    }
    return out;
  }
  return dispatchRpc(services, sessionId, body as JsonRpcMessage);
}

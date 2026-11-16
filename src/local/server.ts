import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { Services } from "../factory";
import * as r_api_audit from "../resolve/api-audit";
import * as r_api_bridge from "../resolve/api-bridge";
import * as r_api_components from "../resolve/api-components";
import * as r_api_document from "../resolve/api-document";
import * as r_api_fig_import from "../resolve/api-fig-import";
import * as r_api_heal from "../resolve/api-heal";
import * as r_api_chat from "../resolve/api-chat";
import * as r_api_sync from "../resolve/api-sync";
import * as r_api_figma_images from "../resolve/api-figma-images";
import * as r_api_figma_links from "../resolve/api-figma-links";
import * as r_api_health from "../resolve/api-health";
import * as r_api_marks__id_ from "../resolve/api-marks-[id]";
import * as r_api_marks_clear_ai from "../resolve/api-marks-clear-ai";
import * as r_api_marks from "../resolve/api-marks";
import * as r_api_mcp_messages from "../resolve/api-mcp-messages";
import * as r_api_mcp from "../resolve/api-mcp";
import * as r_api_pen_import from "../resolve/api-pen-import";
import * as r_api_snapshots_baseline from "../resolve/api-snapshots-baseline";
import * as r_api_snapshots_history from "../resolve/api-snapshots-history";
import * as r_api_snapshots_png from "../resolve/api-snapshots-png";
import * as r_api_snapshots from "../resolve/api-snapshots";
import * as r_api_source from "../resolve/api-source";
import * as r_api_tokens_import from "../resolve/api-tokens-import";
import * as r_api_tokens from "../resolve/api-tokens";
import * as r_api_vrt_runs__id_ from "../resolve/api-vrt-runs-[id]";
import * as r_api_vrt_runs from "../resolve/api-vrt-runs";

export function createLocalApp(
  services: Services,
  liveHub: { subscribe(topic: string, cb: (p: unknown, t?: string) => void): () => void },
) {
  const app = new Hono();
  app.post("/api/audit", r_api_audit.POST(services));
  app.post("/api/bridge", r_api_bridge.POST(services));
  app.post("/api/components", r_api_components.POST(services));
  app.post("/api/fig/import", r_api_fig_import.POST(services));
  app.post("/api/heal", r_api_heal.POST(services));
  app.post("/api/chat", r_api_chat.POST(services));
  app.get("/api/sync", r_api_sync.GET(services));
  app.post("/api/sync", r_api_sync.POST(services));
  app.get("/api/document", r_api_document.GET(services));
  app.put("/api/document", r_api_document.PUT(services));
  app.post("/api/document", r_api_document.POST(services));
  app.get("/api/components", r_api_components.GET(services));
  app.post("/api/figma/images", r_api_figma_images.POST(services));
  app.get("/api/figma/links", r_api_figma_links.GET(services));
  app.get("/api/health", r_api_health.GET(services));
  app.delete("/api/marks/[id]", r_api_marks__id_.DELETE(services));
  app.post("/api/marks/clear/ai", r_api_marks_clear_ai.POST(services));
  app.get("/api/marks", r_api_marks.GET(services));
  app.post("/api/marks", r_api_marks.POST(services));
  app.post("/api/mcp/messages", r_api_mcp_messages.POST(services));
  app.post("/api/mcp", r_api_mcp.POST(services));
  app.delete("/api/mcp", r_api_mcp.DELETE(services));
  app.post("/api/pen/import", r_api_pen_import.POST(services));
  app.get("/api/snapshots/baseline", r_api_snapshots_baseline.GET(services));
  app.get("/api/snapshots/history", r_api_snapshots_history.GET(services));
  app.get("/api/snapshots/png", r_api_snapshots_png.GET(services));
  app.post("/api/snapshots", r_api_snapshots.POST(services));
  app.get("/api/source", r_api_source.GET(services));
  app.post("/api/source", r_api_source.POST(services));
  app.post("/api/tokens/import", r_api_tokens_import.POST(services));
  app.get("/api/tokens", r_api_tokens.GET(services));
  app.get("/api/vrt/runs/[id]", r_api_vrt_runs__id_.GET(services));
  app.post("/api/vrt/runs", r_api_vrt_runs.POST(services));
  app.get("/api/vrt/runs", r_api_vrt_runs.GET(services));
  app.get("/api/mcp/sse", (c) =>
    streamSSE(c, async (stream) => {
      const sessionId = crypto.randomUUID();
      await services.mcpRepo.createSession(sessionId, "pending", "{}", 3600_000);
      await stream.writeSSE({
        event: "endpoint",
        data: `/api/mcp/messages?sessionId=${sessionId}`,
      });
      while (!c.req.raw.signal.aborted) {
        for (const row of await services.mcpRepo.drainOutbox(sessionId)) {
          await stream.writeSSE({ event: "message", data: row.payload });
        }
        await new Promise((r) => setTimeout(r, 250));
      }
    }),
  );
  app.get("/api/mcp", (c) =>
    streamSSE(c, async (stream) => {
      const sessionId = c.req.header("mcp-session-id");
      if (!sessionId) return;
      while (!c.req.raw.signal.aborted) {
        for (const row of await services.mcpRepo.drainOutbox(sessionId)) {
          await stream.writeSSE({ event: "message", data: row.payload });
        }
        await new Promise((r) => setTimeout(r, 250));
      }
    }),
  );
  const liveConnections = new Map<
    string,
    { subs: Map<string, string>; write: (env: unknown) => void }
  >();
  const pendingOps = new Map<string, { kind: string; id: string; topic?: string }[]>();
  app.get("/live", (c) => {
    const connectionId = c.req.query("connectionId") ?? crypto.randomUUID();
    return streamSSE(c, async (stream) => {
      const conn = {
        subs: new Map<string, string>(),
        write: (env: unknown) => void stream.writeSSE({ data: JSON.stringify(env) }),
      };
      liveConnections.set(connectionId, conn);
      for (const op of pendingOps.get(connectionId) ?? []) {
        if (op.kind === "subscribe" && op.topic) conn.subs.set(op.id, op.topic);
      }
      pendingOps.delete(connectionId);
      const unsub = liveHub.subscribe("*", (payload, type) => {
        const { topic, payload: inner } = payload as { topic: string; payload: unknown };
        for (const [subId, subTopic] of conn.subs) {
          if (subTopic === topic) conn.write({ subscriptionId: subId, topic, type, data: inner });
        }
      });
      await stream.writeSSE({ event: "ready", data: "{}" });
      while (!c.req.raw.signal.aborted) {
        await new Promise((r) => setTimeout(r, 500));
      }
      unsub();
      liveConnections.delete(connectionId);
    });
  });
  app.post("/live", async (c) => {
    const body = (await c.req.json()) as {
      connectionId?: string;
      operations?: { kind: string; id: string; topic?: string }[];
    };
    const conn = body.connectionId ? liveConnections.get(body.connectionId) : undefined;
    const results: { id: string; kind: string; ok: boolean }[] = [];
    for (const op of body.operations ?? []) {
      if (conn) {
        if (op.kind === "subscribe" && op.topic) conn.subs.set(op.id, op.topic);
        if (op.kind === "unsubscribe") conn.subs.delete(op.id);
      } else if (body.connectionId) {
        const list = pendingOps.get(body.connectionId) ?? [];
        list.push(op);
        pendingOps.set(body.connectionId, list);
      }
      results.push({ id: op.id, kind: op.kind, ok: true });
    }
    return c.json({ accepted: true, results });
  });
  return app;
}

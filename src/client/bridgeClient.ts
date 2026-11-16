import { apiFetch } from "./api";
import { createAgentView, type GpuCanvas } from "gpucanvas";
import { connectLiveStream } from "void/live/client";
import type { MatrixCell } from "../domain/matrix";

function headers(token: string): Record<string, string> {
  return {
    "content-type": "application/json",
    ...(token ? { "x-bridge-token": token } : {}),
  };
}

export function startStatePublish(
  canvas: GpuCanvas,
  cells: MatrixCell[],
  token: string,
): () => void {
  const view = createAgentView(canvas);
  const publish = async () => {
    try {
      await apiFetch("/api/bridge", {
        method: "POST",
        headers: headers(token),
        body: JSON.stringify({
          topic: "canvas",
          payload: {
            cells: cells.map((cell) => ({
              cellKey: cell.cellKey,
              componentId: cell.componentId,
              axisValues: cell.axisValues,
              x: cell.x,
              y: cell.y,
              width: cell.width,
              height: cell.height,
            })),
            view: view.describe({ depth: 4 }),
            at: Date.now(),
          },
        }),
      });
    } catch {
      // bridge is best-effort; the canvas keeps working without it
    }
  };
  void publish();
  const timer = setInterval(() => void publish(), 5000);
  return () => clearInterval(timer);
}

export async function postBridgeResult(
  commandId: string,
  payload: unknown,
  token: string,
): Promise<void> {
  await apiFetch("/api/bridge", {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ kind: "result", commandId, payload }),
  });
}

export interface BridgeCommandHandlers {
  snapshot: (cellKey: string, scale: number) => Promise<{ r2Key: string }>;
  vrt: (cellKeys?: string[]) => Promise<unknown>;
  audit: (cellKeys?: string[]) => Promise<unknown>;
}

export function startCommandListener(
  canvas: GpuCanvas,
  cells: MatrixCell[],
  token: string,
  handlers: BridgeCommandHandlers,
): () => void {
  void canvas;
  void cells;
  const stream = connectLiveStream("/live", { retryDelay: 1000 });
  let unsubscribe: (() => void) | null = null;
  void stream
    .subscribe({
      id: "canvas-bridge",
      topic: "canvas:bridge",
      onEvent: (event) => {
        if (event.type !== "command") return;
        const data = event.data as {
          commandId?: string;
          kind?: string;
          args?: Record<string, unknown>;
        };
        if (!data.commandId || !data.kind) return;
        const args = data.args ?? {};
        void (async () => {
          let payload: unknown;
          try {
            if (data.kind === "snapshot") {
              payload = await handlers.snapshot(
                typeof args.cellKey === "string" ? args.cellKey : "",
                Number(args.scale ?? 2),
              );
            } else if (data.kind === "vrt") {
              payload = await handlers.vrt(args.cellKeys as string[] | undefined);
            } else if (data.kind === "audit") {
              payload = await handlers.audit(args.cellKeys as string[] | undefined);
            } else {
              payload = { error: `unknown command kind: ${data.kind}` };
            }
          } catch (error) {
            payload = { error: error instanceof Error ? error.message : "command failed" };
          }
          await postBridgeResult(data.commandId as string, payload, token);
        })();
      },
    })
    .then((un) => {
      unsubscribe = un;
    })
    .catch(() => undefined);
  return () => {
    unsubscribe?.();
    stream.close();
  };
}

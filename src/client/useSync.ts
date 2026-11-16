import { connectLiveStream } from "void/live/client";
import type { GpuCanvas as GpuCanvasApi } from "gpucanvas";
import { useEffect, useRef, useState } from "react";
import type { DocAction, Document } from "../domain/document";
import { syncBase, syncFetch } from "./api";

export interface Peer {
  userId: string;
  name: string;
  color: string;
  x: number;
  y: number;
}

const COLORS = ["#8b5cf6", "#0ea5e9", "#f59e0b", "#10b981", "#ef4444", "#ec4899"];

export function syncUser() {
  let id = localStorage.getItem("cul_user_id");
  if (!id) {
    id = crypto.randomUUID().slice(0, 8);
    localStorage.setItem("cul_user_id", id);
    localStorage.setItem("cul_user_name", `User-${id.slice(0, 4)}`);
    localStorage.setItem("cul_user_color", COLORS[Math.floor(Math.random() * COLORS.length)]);
  }
  return {
    userId: id,
    name: localStorage.getItem("cul_user_name") ?? id,
    color: localStorage.getItem("cul_user_color") ?? COLORS[0],
  };
}

export function useSync(
  doc: Document,
  dispatch: (a: DocAction, opts?: { history?: boolean }) => void,
  canvas: GpuCanvasApi | null,
  enabled: boolean,
  onRemote: (user: string) => void,
) {
  const [peers, setPeers] = useState<Peer[]>([]);
  const user = useRef(syncUser());
  const docRef = useRef(doc);
  docRef.current = doc;
  const lastPushed = useRef("");

  useEffect(() => {
    if (!enabled) {
      setPeers([]);
      return;
    }
    let closed = false;
    void syncFetch("/api/sync?docId=main")
      .then((res) => (res.ok ? res.json() : null))
      .then((raw) => {
        const data = raw as {
          layout: { doc: Document; updatedBy: string } | null;
          presence: {
            userId: string;
            name: string;
            color: string;
            cursorX: number;
            cursorY: number;
          }[];
        } | null;
        if (closed || !data) return;
        if (data.layout && data.layout.updatedBy !== user.current.userId) {
          dispatch(
            { type: "merge", nodes: data.layout.doc.nodes, roots: data.layout.doc.roots },
            { history: false },
          );
        }
        setPeers(
          data.presence
            .filter((p) => p.userId !== user.current.userId)
            .map((p) => ({
              userId: p.userId,
              name: p.name,
              color: p.color,
              x: p.cursorX,
              y: p.cursorY,
            })),
        );
      })
      .catch(() => undefined);

    const stream = connectLiveStream(syncBase() + "/live", { retryDelay: 1000 });
    const unsubs: (() => void)[] = [];
    void stream
      .subscribe({
        id: "sync-layout",
        topic: "doc:main",
        onEvent: (event) => {
          const data = event.data as { doc: Document; user: string };
          if (data.user === user.current.userId) return;
          dispatch(
            { type: "merge", nodes: data.doc.nodes, roots: data.doc.roots },
            { history: false },
          );
          onRemote(data.user);
        },
      })
      .then((un) => unsubs.push(un));
    void stream
      .subscribe({
        id: "sync-presence",
        topic: "presence:main",
        onEvent: (event) => {
          const data = event.data as {
            userId: string;
            name: string;
            color: string;
            x: number;
            y: number;
          };
          if (data.userId === user.current.userId) return;
          setPeers((current) => [...current.filter((p) => p.userId !== data.userId), data]);
        },
      })
      .then((un) => unsubs.push(un));
    return () => {
      closed = true;
      unsubs.forEach((un) => un());
      stream.close();
    };
  }, [enabled, dispatch, onRemote]);

  useEffect(() => {
    if (!enabled) return;
    const json = JSON.stringify(doc);
    if (json === lastPushed.current) return;
    const timer = setTimeout(() => {
      lastPushed.current = json;
      void syncFetch("/api/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "layout", docId: "main", doc, user: user.current.userId }),
      }).catch(() => undefined);
    }, 800);
    return () => clearTimeout(timer);
  }, [doc, enabled]);

  useEffect(() => {
    if (!enabled || !canvas) return;
    const surface = canvas.surface;
    let last = 0;
    const onMove = (event: PointerEvent) => {
      const now = Date.now();
      if (now - last < 120) return;
      last = now;
      const rect = surface.getBoundingClientRect();
      const point = canvas.screenToWorld({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
      void syncFetch("/api/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "presence",
          docId: "main",
          userId: user.current.userId,
          name: user.current.name,
          color: user.current.color,
          x: point.x,
          y: point.y,
        }),
      }).catch(() => undefined);
    };
    surface.addEventListener("pointermove", onMove);
    return () => surface.removeEventListener("pointermove", onMove);
  }, [enabled, canvas]);

  return { peers, user: user.current };
}

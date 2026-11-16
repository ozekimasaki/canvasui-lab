interface SseStream {
  send(msg: { event?: string; data?: unknown; id?: string }): Promise<void>;
  comment(text: string): Promise<void>;
  close(): void;
  closed: Promise<void>;
}
export function eventStream(
  cb: (stream: SseStream) => Promise<void>,
  opts?: { signal?: AbortSignal },
): Response {
  const ts = new TransformStream();
  const writer = ts.writable.getWriter();
  const enc = new TextEncoder();
  let closedResolve: () => void;
  const closed = new Promise<void>((r) => (closedResolve = r));
  const stream: SseStream = {
    send: async ({ event, data, id }) => {
      const payload = typeof data === "string" ? data : JSON.stringify(data);
      await writer.write(
        enc.encode(
          `${id ? `id: ${id}\n` : ""}${event ? `event: ${event}\n` : ""}data: ${payload}\n\n`,
        ),
      );
    },
    comment: async (text) => writer.write(enc.encode(`: ${text}\n\n`)),
    close: () => {
      void writer.close();
      closedResolve();
    },
    closed,
  };
  opts?.signal?.addEventListener("abort", () => stream.close());
  void cb(stream).finally(() => stream.close());
  return new Response(ts.readable, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
  });
}

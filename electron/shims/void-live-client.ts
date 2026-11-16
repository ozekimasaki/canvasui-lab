interface LiveEvent {
  subscriptionId?: string;
  topic?: string;
  type?: string;
  data?: unknown;
}

interface SubscribeOptions {
  id: string;
  topic: string;
  onEvent: (event: LiveEvent) => void;
}

export function connectLiveStream(url: string, opts?: { retryDelay?: number }) {
  const base = (window as unknown as { __CUL_API__?: string }).__CUL_API__ ?? "";
  const target = url.startsWith("http") ? url : base + url;
  const connectionId = crypto.randomUUID();
  const subs = new Map<string, SubscribeOptions>();
  const retryDelay = opts?.retryDelay ?? 1000;
  let es: EventSource | null = null;
  let closed = false;
  let opened = false;
  const pending: (() => void)[] = [];

  const streamUrl = () =>
    `${target}${target.includes("?") ? "&" : "?"}connectionId=${connectionId}`;

  const flush = async (operations: unknown[]) => {
    await fetch(target, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ connectionId, operations }),
    });
  };

  const open = () => {
    if (closed) return;
    es = new EventSource(streamUrl());
    es.onopen = () => {
      opened = true;
      const ops = [...subs.values()].map((sub) => ({
        kind: "subscribe",
        id: sub.id,
        topic: sub.topic,
      }));
      if (ops.length) void flush(ops).catch(() => undefined);
      pending.splice(0).forEach((run) => run());
    };
    es.onmessage = (ev) => {
      try {
        const event = JSON.parse(String(ev.data)) as LiveEvent;
        const sub = event.subscriptionId ? subs.get(event.subscriptionId) : undefined;
        if (sub && sub.topic === event.topic) sub.onEvent(event);
      } catch {
        // ignore malformed frames
      }
    };
    es.onerror = () => {
      es?.close();
      es = null;
      opened = false;
      if (!closed && subs.size) setTimeout(open, retryDelay);
    };
  };
  open();

  return {
    connectionId,
    subscribe: async (options: SubscribeOptions) => {
      subs.set(options.id, options);
      const operation = { kind: "subscribe", id: options.id, topic: options.topic };
      if (opened) {
        await flush([operation]);
      } else {
        await new Promise<void>((resolve) => pending.push(resolve));
      }
      return () => {
        subs.delete(options.id);
        void flush([{ kind: "unsubscribe", id: options.id }]).catch(() => undefined);
      };
    },
    close: () => {
      closed = true;
      subs.clear();
      es?.close();
      es = null;
    },
  };
}

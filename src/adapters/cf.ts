import { db } from "void/db";
import { storage } from "void/storage";
import { ai } from "void/ai";
import { env } from "void/env";
import { live } from "../live";
import type { Ports } from "../ports";

export const cfPorts: Ports = {
  db,
  storage: {
    put: async (key, bytes, meta) => {
      await storage.put(key, bytes, { httpMetadata: { contentType: meta?.contentType } });
    },
    get: async (key) => {
      const object = await storage.get(key);
      return object ? new Uint8Array(await object.arrayBuffer()) : null;
    },
    list: async (prefix) => (await storage.list({ prefix })).objects.map((object) => object.key),
    delete: async (key) => {
      await storage.delete(key);
    },
  },
  ai: { run: (model, input) => ai.run(model as never, input as never) as Promise<unknown> },
  live: {
    publish: (topic, payload, type) => live.publish(topic, payload, { type: type ?? "event" }),
    subscribe: () => () => undefined,
  },
  env: { get: (name) => (env as unknown as Record<string, string | undefined>)[name] },
};

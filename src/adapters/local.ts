import { EventEmitter } from "node:events";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  readdirSync,
  existsSync,
} from "node:fs";
import { join, dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../../db/schema-core";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { Ports } from "../ports";

export interface LocalOpts {
  dataDir: string;
  migrationsFolder: string;
  cfAccountId?: string;
  cfApiToken?: string;
}

export function createLocalPorts(opts: LocalOpts): Ports {
  mkdirSync(opts.dataDir, { recursive: true });
  const sqlite = new Database(join(opts.dataDir, "canvasui.db"));
  sqlite.pragma("journal_mode = WAL");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: opts.migrationsFolder });

  const storageRoot = join(opts.dataDir, "storage");
  mkdirSync(storageRoot, { recursive: true });
  const pathFor = (key: string) => join(storageRoot, key);

  const hub = new EventEmitter();
  hub.setMaxListeners(100);

  return {
    db,
    storage: {
      put: async (key, bytes, meta) => {
        const target = pathFor(key);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, bytes);
        if (meta?.contentType) writeFileSync(target + ".mime", meta.contentType);
      },
      get: async (key) =>
        existsSync(pathFor(key)) ? new Uint8Array(readFileSync(pathFor(key))) : null,
      list: async (prefix) => {
        const base = join(storageRoot, prefix);
        if (!existsSync(base)) return [];
        const out: string[] = [];
        const walk = (dir: string, rel: string) => {
          for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (entry.isDirectory()) walk(join(dir, entry.name), rel + entry.name + "/");
            else if (!entry.name.endsWith(".mime")) out.push(rel + entry.name);
          }
        };
        walk(base, prefix);
        return out;
      },
      delete: async (key) => {
        if (existsSync(pathFor(key))) unlinkSync(pathFor(key));
      },
    },
    ai: {
      run: async (model, input) => {
        if (!opts.cfAccountId || !opts.cfApiToken) {
          throw new Error("Workers AI unavailable locally: set CF_ACCOUNT_ID and CF_API_TOKEN");
        }
        const res = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${opts.cfAccountId}/ai/run/${model}`,
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${opts.cfApiToken}`,
              "content-type": "application/json",
            },
            body: JSON.stringify(input),
          },
        );
        if (!res.ok) throw new Error(`Workers AI REST ${res.status}`);
        const data = (await res.json()) as { result?: unknown };
        return data.result ?? data;
      },
    },
    live: {
      publish: async (topic, payload, type) => {
        hub.emit(topic, payload, type);
        hub.emit("*", { topic, payload }, type);
      },
      subscribe: (topic, cb) => {
        const listener = (payload: unknown, type?: string) => cb(payload, type);
        hub.on(topic, listener);
        return () => hub.off(topic, listener);
      },
    },
    env: { get: (name) => process.env[name] },
  };
}

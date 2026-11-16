import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as schema from "../db/schema-core";

export type DbPort = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

export interface StoragePort {
  put(key: string, bytes: Uint8Array, meta?: { contentType?: string }): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  list(prefix: string): Promise<string[]>;
  delete(key: string): Promise<void>;
}

export interface AiPort {
  run(model: string, input: unknown): Promise<unknown>;
}

export interface LivePort {
  publish(topic: string, payload: unknown, type?: string): Promise<void>;
  subscribe(topic: string, cb: (payload: unknown, type?: string) => void): () => void;
}

export interface EnvPort {
  get(name: string): string | undefined;
}

export interface Ports {
  db: DbPort;
  storage: StoragePort;
  ai: AiPort;
  live: LivePort;
  env: EnvPort;
}

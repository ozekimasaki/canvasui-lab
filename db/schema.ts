import { sql } from "void/db";
import { integer, real, sqliteTable, text } from "void/schema-d1";

export const components = sqliteTable("components", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  filePath: text("file_path").notNull(),
  metaJson: text("meta_json").notNull().default("{}"),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const snapshots = sqliteTable("snapshots", {
  id: text("id").primaryKey(),
  componentId: text("component_id").notNull(),
  cellKey: text("cell_key").notNull(),
  kind: text("kind", { enum: ["baseline", "run", "design"] }).notNull(),
  source: text("source", { enum: ["implementation", "figma", "pen"] }).notNull(),
  r2Key: text("r2_key").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  scale: real("scale").notNull(),
  contentHash: text("content_hash").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const vrtRuns = sqliteTable("vrt_runs", {
  id: text("id").primaryKey(),
  totalCells: integer("total_cells").notNull(),
  changedCells: integer("changed_cells").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const vrtResults = sqliteTable("vrt_results", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  cellKey: text("cell_key").notNull(),
  changed: integer("changed").notNull(),
  diffRatio: real("diff_ratio").notNull(),
  boundsJson: text("bounds_json"),
  snapshotId: text("snapshot_id"),
});

export const designTokens = sqliteTable("design_tokens", {
  id: text("id").primaryKey(),
  source: text("source", { enum: ["figma", "pen", "dtcg"] }).notNull(),
  name: text("name").notNull(),
  type: text("type", { enum: ["color", "number", "string", "boolean"] }).notNull(),
  collection: text("collection").notNull().default(""),
  valuesJson: text("values_json").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const marks = sqliteTable("marks", {
  id: text("id").primaryKey(),
  cellKey: text("cell_key").notNull(),
  targetElementId: text("target_element_id"),
  kind: text("kind", { enum: ["pin", "note"] }).notNull(),
  text: text("text").notNull(),
  severity: text("severity", { enum: ["info", "warning", "error"] }).notNull(),
  author: text("author", { enum: ["ai", "human"] }).notNull(),
  runId: text("run_id"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const figmaLinks = sqliteTable("figma_links", {
  id: text("id").primaryKey(),
  componentId: text("component_id").notNull(),
  fileKey: text("file_key").notNull(),
  nodeId: text("node_id").notNull(),
  r2Key: text("r2_key").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

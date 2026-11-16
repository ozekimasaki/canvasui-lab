CREATE TABLE `components` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`file_path` text NOT NULL,
	`meta_json` text DEFAULT '{}' NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `design_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`collection` text DEFAULT '' NOT NULL,
	`values_json` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `figma_links` (
	`id` text PRIMARY KEY NOT NULL,
	`component_id` text NOT NULL,
	`file_key` text NOT NULL,
	`node_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `marks` (
	`id` text PRIMARY KEY NOT NULL,
	`cell_key` text NOT NULL,
	`target_element_id` text,
	`kind` text NOT NULL,
	`text` text NOT NULL,
	`severity` text NOT NULL,
	`author` text NOT NULL,
	`run_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`component_id` text NOT NULL,
	`cell_key` text NOT NULL,
	`kind` text NOT NULL,
	`source` text NOT NULL,
	`r2_key` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`scale` real NOT NULL,
	`content_hash` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vrt_results` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`cell_key` text NOT NULL,
	`changed` integer NOT NULL,
	`diff_ratio` real NOT NULL,
	`bounds_json` text,
	`snapshot_id` text
);
--> statement-breakpoint
CREATE TABLE `vrt_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`total_cells` integer NOT NULL,
	`changed_cells` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);

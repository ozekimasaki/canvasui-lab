CREATE TABLE `bridge_results` (
	`id` text PRIMARY KEY NOT NULL,
	`command_id` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bridge_state` (
	`id` text PRIMARY KEY NOT NULL,
	`topic` text NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mcp_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mcp_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`protocol_version` text NOT NULL,
	`client_info` text DEFAULT '{}' NOT NULL,
	`initialized` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `source_patches` (
	`id` text PRIMARY KEY NOT NULL,
	`file_path` text NOT NULL,
	`before_hash` text NOT NULL,
	`after_hash` text NOT NULL,
	`edits_json` text NOT NULL,
	`author` text NOT NULL,
	`pr_url` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE `canvas_layouts` (
	`doc_id` text PRIMARY KEY NOT NULL,
	`json` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `presence` (
	`doc_id` text NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`cursor_x` integer DEFAULT 0 NOT NULL,
	`cursor_y` integer DEFAULT 0 NOT NULL,
	`ts` text DEFAULT (datetime('now')) NOT NULL
);

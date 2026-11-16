CREATE TABLE `undo_log` (
	`id` text PRIMARY KEY NOT NULL,
	`ref` text NOT NULL,
	`files` text NOT NULL,
	`created_at` text NOT NULL
);

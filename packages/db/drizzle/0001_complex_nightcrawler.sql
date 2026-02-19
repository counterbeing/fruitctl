CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`proposal_id` text NOT NULL,
	`adapter` text NOT NULL,
	`action` text NOT NULL,
	`params` text NOT NULL,
	`result` text,
	`error` text,
	`timestamp` integer,
	FOREIGN KEY (`proposal_id`) REFERENCES `proposals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`adapter` text NOT NULL,
	`action` text NOT NULL,
	`params` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer,
	`resolved_at` integer,
	`resolved_by` text
);

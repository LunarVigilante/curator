ALTER TABLE `categories` ADD `emoji` text;--> statement-breakpoint
ALTER TABLE `categories` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `categories` ADD `user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `categories` ADD `is_public` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `categories` ADD `cached_analysis` text;--> statement-breakpoint
ALTER TABLE `categories` ADD `analysis_hash` text;--> statement-breakpoint
ALTER TABLE `custom_ranks` ADD `type` text DEFAULT 'RANKED' NOT NULL;--> statement-breakpoint
ALTER TABLE `items` ADD `elo_score` real DEFAULT 1200 NOT NULL;
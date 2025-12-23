CREATE TABLE `global_items` (
	`id` text PRIMARY KEY NOT NULL,
	`external_id` text,
	`title` text NOT NULL,
	`description` text,
	`image_url` text,
	`release_year` integer,
	`metadata` text,
	`category_type` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `global_items_external_id_unique` ON `global_items` (`external_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`description` text,
	`image` text,
	`metadata` text,
	`global_item_id` text,
	`user_id` text,
	`tier` text,
	`rank` integer,
	`notes` text,
	`category_id` text,
	`elo_score` real DEFAULT 1200 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`global_item_id`) REFERENCES `global_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_items`("id", "name", "description", "image", "metadata", "global_item_id", "user_id", "tier", "rank", "notes", "category_id", "elo_score", "created_at", "updated_at") SELECT "id", "name", "description", "image", "metadata", "global_item_id", "user_id", "tier", "rank", "notes", "category_id", "elo_score", "created_at", "updated_at" FROM `items`;--> statement-breakpoint
DROP TABLE `items`;--> statement-breakpoint
ALTER TABLE `__new_items` RENAME TO `items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
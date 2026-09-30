CREATE TABLE `review_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`article_id` text NOT NULL,
	`role` text NOT NULL,
	`kind` text NOT NULL,
	`body` text NOT NULL,
	`result_json` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_review_messages_owner_article_created` ON `review_messages` (`owner_id`,`article_id`,`created_at`);
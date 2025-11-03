CREATE TABLE `feedbackSubmissions` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`type` enum('bug','feature','improvement','other') NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text NOT NULL,
	`status` enum('new','reviewed','in_progress','completed','rejected') NOT NULL DEFAULT 'new',
	`adminNotes` text,
	`submittedAt` timestamp DEFAULT (now()),
	`reviewedAt` timestamp,
	CONSTRAINT `feedbackSubmissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `isActive` boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` ADD `isBetaTester` boolean DEFAULT false NOT NULL;
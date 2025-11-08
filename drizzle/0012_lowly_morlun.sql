CREATE TABLE `chatSessions` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `chatSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `chatMessages` ADD `sessionId` varchar(64) NOT NULL;
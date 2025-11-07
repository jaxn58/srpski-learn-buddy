CREATE TABLE `feedbackComments` (
	`id` varchar(64) NOT NULL,
	`feedbackId` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`content` text NOT NULL,
	`isAdminNote` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `feedbackComments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `feedbackStatusHistory` (
	`id` varchar(64) NOT NULL,
	`feedbackId` varchar(64) NOT NULL,
	`previousStatus` enum('new','reviewed','in_progress','completed','rejected') NOT NULL,
	`newStatus` enum('new','reviewed','in_progress','completed','rejected') NOT NULL,
	`changedBy` varchar(64) NOT NULL,
	`changedAt` timestamp DEFAULT (now()),
	CONSTRAINT `feedbackStatusHistory_id` PRIMARY KEY(`id`)
);

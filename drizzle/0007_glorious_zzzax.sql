CREATE TABLE `dailyActivity` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`activityDate` timestamp NOT NULL,
	`unitsCompleted` int NOT NULL DEFAULT 0,
	`exercisesCompleted` int NOT NULL DEFAULT 0,
	`xpEarned` int NOT NULL DEFAULT 0,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `dailyActivity_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exerciseCompletions` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`unitNumber` int NOT NULL,
	`exerciseId` varchar(100) NOT NULL,
	`score` int NOT NULL,
	`totalQuestions` int NOT NULL,
	`xpEarned` int NOT NULL,
	`completedAt` timestamp DEFAULT (now()),
	CONSTRAINT `exerciseCompletions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userBadges` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`badgeId` varchar(100) NOT NULL,
	`earnedAt` timestamp DEFAULT (now()),
	CONSTRAINT `userBadges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `totalXP` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `level` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `currentStreak` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `longestStreak` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `lastActiveDate` timestamp;
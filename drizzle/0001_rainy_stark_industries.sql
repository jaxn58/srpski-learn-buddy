CREATE TABLE `chatMessages` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`role` enum('user','assistant','system') NOT NULL,
	`content` text NOT NULL,
	`unitContext` int,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `chatMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exerciseResults` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`unitNumber` int NOT NULL,
	`exerciseType` varchar(64) NOT NULL,
	`score` int NOT NULL,
	`totalQuestions` int NOT NULL,
	`correctAnswers` int NOT NULL,
	`completedAt` timestamp DEFAULT (now()),
	CONSTRAINT `exerciseResults_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userProgress` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`currentWeek` int NOT NULL DEFAULT 1,
	`currentUnit` int NOT NULL DEFAULT 1,
	`completedUnits` text,
	`startedAt` timestamp DEFAULT (now()),
	`lastActivityAt` timestamp DEFAULT (now()),
	CONSTRAINT `userProgress_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vocabulary` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`serbianWord` varchar(255) NOT NULL,
	`englishTranslation` varchar(255) NOT NULL,
	`unitNumber` int NOT NULL,
	`mastered` boolean NOT NULL DEFAULT false,
	`reviewCount` int NOT NULL DEFAULT 0,
	`lastReviewedAt` timestamp,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `vocabulary_id` PRIMARY KEY(`id`)
);

CREATE TABLE `quizProgress` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`unitNumber` int NOT NULL,
	`currentIndex` int NOT NULL DEFAULT 0,
	`totalAttempts` int NOT NULL DEFAULT 0,
	`lastScore` int NOT NULL DEFAULT 0,
	`incorrectWordIds` text,
	`lastAttemptAt` timestamp,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `quizProgress_id` PRIMARY KEY(`id`)
);

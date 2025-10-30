CREATE TABLE `unitExplanations` (
	`id` varchar(64) NOT NULL,
	`unitNumber` int NOT NULL,
	`overview` text NOT NULL,
	`grammarExplained` text NOT NULL,
	`practiceExamples` text NOT NULL,
	`bookReference` text,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `unitExplanations_id` PRIMARY KEY(`id`),
	CONSTRAINT `unitExplanations_unitNumber_unique` UNIQUE(`unitNumber`)
);

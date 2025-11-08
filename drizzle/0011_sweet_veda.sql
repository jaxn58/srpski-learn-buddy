CREATE TABLE `subscriptionHistory` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`action` enum('purchased','upgraded','downgraded','cancelled','expired','renewed') NOT NULL,
	`previousPlanType` varchar(50),
	`newPlanType` varchar(50),
	`previousExpiresAt` timestamp,
	`newExpiresAt` timestamp,
	`cost` int,
	`notes` text,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `subscriptionHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userSubscriptions` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`planType` enum('intensive','balanced','standard','relaxed') NOT NULL,
	`planDurationMonths` int NOT NULL,
	`planPrice` int NOT NULL,
	`purchasedAt` timestamp DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`status` enum('active','expired','cancelled') NOT NULL DEFAULT 'active',
	`autoRenew` boolean NOT NULL DEFAULT false,
	`cancelledAt` timestamp,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `userSubscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `userSubscriptions_userId_unique` UNIQUE(`userId`)
);

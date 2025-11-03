CREATE TABLE `betaRegistrations` (
	`id` varchar(64) NOT NULL,
	`name` varchar(200) NOT NULL,
	`email` varchar(320) NOT NULL,
	`motivation` text,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`registeredAt` timestamp DEFAULT (now()),
	`reviewedAt` timestamp,
	CONSTRAINT `betaRegistrations_id` PRIMARY KEY(`id`)
);

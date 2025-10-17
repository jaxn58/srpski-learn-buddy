ALTER TABLE `chatMessages` MODIFY COLUMN `role` varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE `exerciseResults` MODIFY COLUMN `exerciseType` varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE `vocabulary` MODIFY COLUMN `serbianWord` text NOT NULL;--> statement-breakpoint
ALTER TABLE `vocabulary` MODIFY COLUMN `englishTranslation` text NOT NULL;--> statement-breakpoint
ALTER TABLE `userProgress` ADD `learningDuration` int DEFAULT 12 NOT NULL;--> statement-breakpoint
ALTER TABLE `userProgress` ADD `uiLanguage` varchar(10) DEFAULT 'de' NOT NULL;
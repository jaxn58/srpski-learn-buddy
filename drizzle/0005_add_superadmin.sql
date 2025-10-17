ALTER TABLE `users` MODIFY COLUMN `role` enum('superadmin','admin','student') DEFAULT 'student' NOT NULL;

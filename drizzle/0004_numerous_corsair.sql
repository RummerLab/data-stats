CREATE TABLE `school_holidays` (
	`id` integer PRIMARY KEY NOT NULL,
	`school_year` text NOT NULL,
	`name` text NOT NULL,
	`start` text NOT NULL,
	`end` text NOT NULL,
	`source` text NOT NULL
);

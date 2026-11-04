CREATE TABLE `chlorophyll_weekly` (
	`date` text PRIMARY KEY NOT NULL,
	`chl` real,
	`pixels` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `sets` ADD `chl` real;
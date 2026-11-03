CREATE TABLE `logger_daily` (
	`id` integer PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`date` text NOT NULL,
	`mean` real NOT NULL,
	`min` real NOT NULL,
	`max` real NOT NULL,
	`hours` integer NOT NULL,
	`loggers` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `logger_daily_site` ON `logger_daily` (`site_id`);--> statement-breakpoint
CREATE TABLE `logger_diel` (
	`id` integer PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`month` integer NOT NULL,
	`hour` integer NOT NULL,
	`temp` real NOT NULL,
	`n` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `logger_files` (
	`id` integer PRIMARY KEY NOT NULL,
	`file` text NOT NULL,
	`system` text NOT NULL,
	`logger` text NOT NULL,
	`serial` text,
	`site_id` text,
	`site_basis` text,
	`start` text,
	`end` text,
	`samples` integer NOT NULL,
	`kept` integer NOT NULL,
	`lat` real,
	`lon` real,
	`excluded` text
);
--> statement-breakpoint
ALTER TABLE `sets` ADD `insitu_temp` real;
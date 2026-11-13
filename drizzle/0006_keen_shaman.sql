CREATE TABLE `nursery_routes` (
	`id` integer PRIMARY KEY NOT NULL,
	`from_site_id` text NOT NULL,
	`to_site_id` text NOT NULL,
	`km` real NOT NULL,
	`straight_km` real NOT NULL,
	`coordinates` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `nursery_routes_pair` ON `nursery_routes` (`from_site_id`,`to_site_id`);
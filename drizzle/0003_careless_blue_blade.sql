CREATE TABLE `cyclone_points` (
	`id` integer PRIMARY KEY NOT NULL,
	`sid` text NOT NULL,
	`name` text NOT NULL,
	`ts` text NOT NULL,
	`lat` real NOT NULL,
	`lon` real NOT NULL,
	`wind_kt` real,
	`pres_hpa` real,
	`dist_km` real NOT NULL
);

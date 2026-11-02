CREATE TABLE `adult_captures` (
	`id` integer PRIMARY KEY NOT NULL,
	`shark_id` text,
	`date` text,
	`name` text,
	`hooked_min` real,
	`boat_min` real,
	`released_min` real,
	`fight_min` real,
	`handling_min` real,
	`lat` real,
	`lon` real,
	`site` text,
	`sex` text,
	`maturity` text,
	`repro_code` text,
	`pcl_mm` real,
	`fl_mm` real,
	`tl_mm` real,
	`pec_girth_mm` real,
	`dors_girth_mm` real,
	`caud_girth_mm` real,
	`clasper_inner` real,
	`clasper_outer` real,
	`sperm` text,
	`ultrasound` text,
	`pregnant` text,
	`blood1_min` real,
	`lact1` real,
	`gluc1` real,
	`bhb1` real,
	`blood2_min` real,
	`lact2` real,
	`gluc2` real,
	`bhb2` real,
	`tagged` text,
	`bait` text,
	`comments` text,
	`source_file` text,
	`source_sheet` text,
	`source_row` integer
);
--> statement-breakpoint
CREATE TABLE `adult_effort` (
	`id` integer PRIMARY KEY NOT NULL,
	`date` text,
	`session` text,
	`bait_in_min` real,
	`bait_out_min` real,
	`soak_min` real,
	`shark_times` text,
	`n_sharks` integer,
	`comments` text
);
--> statement-breakpoint
CREATE TABLE `adult_samples` (
	`id` integer PRIMARY KEY NOT NULL,
	`sample` text,
	`size_cm` real,
	`sex` text,
	`island` text,
	`location` text,
	`year` integer,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `blood` (
	`id` integer PRIMARY KEY NOT NULL,
	`season` text NOT NULL,
	`site_id` text,
	`date` text,
	`species` text,
	`experiment` text,
	`shark_no` text,
	`hct` real,
	`hb` real,
	`cholesterol` real,
	`ffa` real,
	`triglycerides` real
);
--> statement-breakpoint
CREATE TABLE `captures` (
	`id` integer PRIMARY KEY NOT NULL,
	`season` text NOT NULL,
	`species` text NOT NULL,
	`site_id` text,
	`site_raw` text,
	`set_id` integer,
	`set_no` integer,
	`date` text,
	`shark_no` text,
	`capture_no` integer,
	`kind` text NOT NULL,
	`tag` text,
	`tags` text,
	`individual_id` text,
	`sex` text,
	`age_class` text,
	`umbilical` text,
	`uss` integer,
	`pcl_mm` real,
	`fl_mm` real,
	`tl_mm` real,
	`pec_girth_mm` real,
	`dors_girth_mm` real,
	`caud_girth_mm` real,
	`mass_kg` real,
	`clasper_l` real,
	`clasper_r` real,
	`capture_min` real,
	`landing_min` real,
	`release_min` real,
	`workup_min` real,
	`to_lab` integer,
	`died` integer,
	`blood` integer,
	`dna` integer,
	`us_area` real,
	`us_perimeter` real,
	`habitat` text,
	`tide_raw` text,
	`notes` text,
	`min_after_sunset` real,
	`min_after_net_in` real,
	`tide_mm` real,
	`tide_trend` text,
	`moon_illum` real,
	`moon_phase` real,
	`sst` real,
	`dhw` real,
	`source_file` text,
	`source_sheet` text,
	`source_row` integer
);
--> statement-breakpoint
CREATE INDEX `captures_season` ON `captures` (`season`);--> statement-breakpoint
CREATE INDEX `captures_site` ON `captures` (`site_id`);--> statement-breakpoint
CREATE INDEX `captures_individual` ON `captures` (`individual_id`);--> statement-breakpoint
CREATE TABLE `climate_monthly` (
	`ym` text PRIMARY KEY NOT NULL,
	`oni` real,
	`soi` real
);
--> statement-breakpoint
CREATE TABLE `data_issues` (
	`id` integer PRIMARY KEY NOT NULL,
	`severity` text NOT NULL,
	`category` text NOT NULL,
	`message` text NOT NULL,
	`file` text,
	`sheet` text,
	`row` integer,
	`column` text,
	`value` text
);
--> statement-breakpoint
CREATE TABLE `field_notes` (
	`id` integer PRIMARY KEY NOT NULL,
	`season` text,
	`date` text,
	`site_id` text,
	`kind` text NOT NULL,
	`ref_id` integer,
	`species` text,
	`text` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `field_wq` (
	`id` integer PRIMARY KEY NOT NULL,
	`season` text NOT NULL,
	`date` text,
	`site_id` text,
	`time_min` real,
	`depth_cm` real,
	`salinity` real,
	`do_mg` real,
	`do_pct` real,
	`temp` real,
	`ph` real,
	`source` text
);
--> statement-breakpoint
CREATE TABLE `hobo` (
	`id` integer PRIMARY KEY NOT NULL,
	`season` text NOT NULL,
	`site_id` text,
	`site_raw` text,
	`logger` text,
	`deployed` text,
	`retrieved` text,
	`status` text,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `individuals` (
	`id` text PRIMARY KEY NOT NULL,
	`species` text NOT NULL,
	`sex` text,
	`first_date` text,
	`last_date` text,
	`n_captures` integer NOT NULL,
	`n_seasons` integer NOT NULL,
	`sites` text,
	`first_tl_mm` real,
	`last_tl_mm` real,
	`tags` text,
	`conflict` text
);
--> statement-breakpoint
CREATE TABLE `lab_feeding` (
	`id` integer PRIMARY KEY NOT NULL,
	`season` text NOT NULL,
	`date` text,
	`tank` text,
	`shark` text,
	`tag` text,
	`food_g` real,
	`rejected_g` real,
	`pct` real,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `lab_sharks` (
	`id` integer PRIMARY KEY NOT NULL,
	`season` text NOT NULL,
	`shark_no` text,
	`tag` text,
	`individual_id` text,
	`species` text,
	`sex` text,
	`site_id` text,
	`arrival_date` text,
	`release_date` text,
	`days` real,
	`arr_tl_mm` real,
	`arr_fl_mm` real,
	`arr_mass_kg` real,
	`rel_tl_mm` real,
	`rel_fl_mm` real,
	`rel_mass_kg` real,
	`tank` text,
	`project` text,
	`died` integer,
	`notes` text,
	`source_file` text,
	`source_sheet` text,
	`source_row` integer
);
--> statement-breakpoint
CREATE TABLE `lab_wq` (
	`id` integer PRIMARY KEY NOT NULL,
	`season` text NOT NULL,
	`date` text,
	`time_min` real,
	`tank` text,
	`temp` real,
	`ph` real,
	`do_mg` real,
	`do_pct` real,
	`salinity` real,
	`recorder` text,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mouth` (
	`id` integer PRIMARY KEY NOT NULL,
	`season` text NOT NULL,
	`shark_no` text,
	`site_id` text,
	`tag` text,
	`species` text,
	`sex` text,
	`mol` real,
	`mow` real
);
--> statement-breakpoint
CREATE TABLE `ocean_daily` (
	`date` text PRIMARY KEY NOT NULL,
	`oisst` real,
	`crw_sst` real,
	`crw_anom` real,
	`crw_hotspot` real,
	`crw_dhw` real,
	`crw_baa` real,
	`wave_max` real,
	`wave_period` real,
	`wave_dir` real,
	`swell_max` real
);
--> statement-breakpoint
CREATE TABLE `prey` (
	`id` integer PRIMARY KEY NOT NULL,
	`season` text NOT NULL,
	`date` text,
	`location` text,
	`name` text,
	`size` text,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `set_crew` (
	`id` integer PRIMARY KEY NOT NULL,
	`set_id` integer NOT NULL,
	`person` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `set_crew_set` ON `set_crew` (`set_id`);--> statement-breakpoint
CREATE INDEX `set_crew_person` ON `set_crew` (`person`);--> statement-breakpoint
CREATE TABLE `sets` (
	`id` integer PRIMARY KEY NOT NULL,
	`season` text NOT NULL,
	`set_no` integer,
	`site_id` text,
	`site_raw` text,
	`date` text,
	`weekday` integer,
	`gear` text,
	`visit` integer,
	`crew_raw` text,
	`crew_size` integer,
	`start_min` real,
	`end_min` real,
	`duration_min` real,
	`n_cm` integer,
	`n_na` integer,
	`n_nf` integer,
	`n_total` integer,
	`n_linked` integer,
	`cpue` real,
	`cpue_cm` real,
	`cpue_na` real,
	`cpue_sheet` real,
	`tide_raw` text,
	`moon_raw` text,
	`weather_raw` text,
	`cloud_cover` real,
	`water_temp` real,
	`ph` real,
	`do_mg` real,
	`do_pct` real,
	`salinity` real,
	`depth_cm` real,
	`notes` text,
	`sunset_min` real,
	`civil_dusk_min` real,
	`moon_phase` real,
	`moon_illum` real,
	`moon_alt_mid` real,
	`tide_start_mm` real,
	`tide_mid_mm` real,
	`tide_trend` text,
	`tide_range_mm` real,
	`air_temp` real,
	`wind_speed` real,
	`wind_dir` real,
	`gusts` real,
	`rain_24h` real,
	`rain_evening` real,
	`cloud_evening` real,
	`pressure` real,
	`sst` real,
	`sst_anom` real,
	`dhw` real,
	`wave_height` real,
	`swell_height` real,
	`oni` real,
	`source_file` text,
	`source_sheet` text,
	`source_row` integer
);
--> statement-breakpoint
CREATE INDEX `sets_season` ON `sets` (`season`);--> statement-breakpoint
CREATE INDEX `sets_site` ON `sets` (`site_id`);--> statement-breakpoint
CREATE TABLE `sites` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text,
	`island` text NOT NULL,
	`kind` text NOT NULL,
	`lat` real,
	`lon` real,
	`coord_source` text,
	`retired` text,
	`fishing_effort` real,
	`human_impact` real,
	`artificialisation` real,
	`pressure_composite` real,
	`pressure_tier` text,
	`directions` text,
	`habitat` text,
	`aliases` text
);
--> statement-breakpoint
CREATE TABLE `tide_extrema` (
	`ts` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`mm` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tide_hourly` (
	`ts` text PRIMARY KEY NOT NULL,
	`mm` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `weather_daily` (
	`date` text PRIMARY KEY NOT NULL,
	`tmax` real,
	`tmin` real,
	`tmean` real,
	`precip` real,
	`wind_max` real,
	`gust_max` real,
	`wind_dir` real,
	`radiation` real,
	`cloud` real,
	`pressure` real,
	`humidity` real,
	`sunshine_h` real
);
--> statement-breakpoint
CREATE TABLE `weather_hourly` (
	`ts` text PRIMARY KEY NOT NULL,
	`temp` real,
	`precip` real,
	`cloud` real,
	`wind` real,
	`wind_dir` real,
	`gust` real,
	`pressure` real
);

ALTER TABLE `monitor_runs` ADD `url` varchar(1000) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `monitor_runs` ADD `httpStatus` int;--> statement-breakpoint
ALTER TABLE `monitor_runs` ADD `durationMs` int DEFAULT 0 NOT NULL;
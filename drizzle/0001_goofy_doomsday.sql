CREATE TABLE `alert_preferences` (
	`userId` int NOT NULL,
	`concursos` boolean NOT NULL DEFAULT true,
	`processos` boolean NOT NULL DEFAULT true,
	`vagas` boolean NOT NULL DEFAULT true,
	`tecnico` boolean NOT NULL DEFAULT true,
	`tecnologo` boolean NOT NULL DEFAULT true,
	`todoEstado` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `alert_preferences_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
CREATE TABLE `monitor_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceId` int NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp,
	`status` enum('running','success','failed') NOT NULL,
	`foundCount` int NOT NULL DEFAULT 0,
	`error` text,
	CONSTRAINT `monitor_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monitor_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(80) NOT NULL,
	`name` varchar(255) NOT NULL,
	`category` enum('official','aggregator','employer') NOT NULL,
	`urls` text NOT NULL,
	`keywords` text NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`lastCheckedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monitor_sources_id` PRIMARY KEY(`id`),
	CONSTRAINT `monitor_sources_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `opportunities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceId` int NOT NULL,
	`externalId` varchar(255) NOT NULL,
	`title` varchar(255) NOT NULL,
	`organization` varchar(255) NOT NULL,
	`city` varchar(255) NOT NULL,
	`role` enum('Técnico','Tecnólogo','Outro') NOT NULL,
	`kind` enum('Concurso','Processo seletivo','Vaga','Estágio','Informativo') NOT NULL,
	`sourceUrl` varchar(1000) NOT NULL,
	`publishedAt` timestamp,
	`deadlineAt` timestamp,
	`summary` text,
	`rawText` text,
	`contentHash` varchar(64) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `opportunities_id` PRIMARY KEY(`id`),
	CONSTRAINT `opportunities_source_external_unique` UNIQUE(`sourceId`,`externalId`)
);
--> statement-breakpoint
CREATE TABLE `push_devices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`token` varchar(512) NOT NULL,
	`platform` enum('ios','android','web') NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `push_devices_id` PRIMARY KEY(`id`),
	CONSTRAINT `push_devices_user_token_unique` UNIQUE(`userId`,`token`)
);
--> statement-breakpoint
CREATE INDEX `monitor_runs_source_started_idx` ON `monitor_runs` (`sourceId`,`startedAt`);--> statement-breakpoint
CREATE INDEX `opportunities_active_role_idx` ON `opportunities` (`isActive`,`role`);
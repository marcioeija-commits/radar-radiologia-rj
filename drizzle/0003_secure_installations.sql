CREATE TABLE `device_alert_preferences` (
	`installationId` varchar(128) NOT NULL,
	`concursos` boolean NOT NULL DEFAULT true,
	`processos` boolean NOT NULL DEFAULT true,
	`vagas` boolean NOT NULL DEFAULT true,
	`tecnico` boolean NOT NULL DEFAULT true,
	`tecnologo` boolean NOT NULL DEFAULT true,
	`todoEstado` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `device_alert_preferences_installationId` PRIMARY KEY(`installationId`)
);
--> statement-breakpoint
ALTER TABLE `push_devices` ADD `installationId` varchar(128);--> statement-breakpoint
ALTER TABLE `push_devices` ADD `credentialHash` char(64);--> statement-breakpoint
ALTER TABLE `push_devices` ADD `linkedUserId` int;--> statement-breakpoint
ALTER TABLE `push_devices` ADD CONSTRAINT `push_devices_installationId_unique` UNIQUE(`installationId`);--> statement-breakpoint
CREATE INDEX `push_devices_linkedUserId_idx` ON `push_devices` (`linkedUserId`);
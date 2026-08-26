CREATE TABLE `demo_auction_state` (
	`lot_id` text PRIMARY KEY NOT NULL,
	`current_baisa` integer NOT NULL,
	`leader_nickname` text,
	`leader_participant_id` text,
	`last_bid_id` text,
	`version` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'live' NOT NULL,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `demo_bids` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`lot_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`nickname` text NOT NULL,
	`increment_baisa` integer NOT NULL,
	`amount_baisa` integer NOT NULL,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `demo_bids_idempotency_uq` ON `demo_bids` (`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `demo_bids_lot_created_idx` ON `demo_bids` (`lot_id`,`created_at_ms`);
--> statement-breakpoint
CREATE INDEX `demo_bids_participant_created_idx` ON `demo_bids` (`participant_id`,`created_at_ms`);
--> statement-breakpoint
CREATE TABLE `demo_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`lot_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `demo_audit_lot_created_idx` ON `demo_audit_events` (`lot_id`,`created_at_ms`);

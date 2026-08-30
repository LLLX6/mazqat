import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const demoAuctionState = sqliteTable('demo_auction_state', {
  lotId: text('lot_id').primaryKey(),
  currentBaisa: integer('current_baisa').notNull(),
  leaderNickname: text('leader_nickname'),
  leaderParticipantId: text('leader_participant_id'),
  lastBidId: text('last_bid_id'),
  version: integer('version').notNull().default(0),
  status: text('status', {
    enum: ['live', 'paused', 'closing', 'sold', 'unsold'],
  })
    .notNull()
    .default('live'),
  updatedAtMs: integer('updated_at_ms').notNull(),
});

export const demoBids = sqliteTable(
  'demo_bids',
  {
    id: text('id').primaryKey(),
    idempotencyKey: text('idempotency_key').notNull(),
    lotId: text('lot_id').notNull(),
    participantId: text('participant_id').notNull(),
    nickname: text('nickname').notNull(),
    incrementBaisa: integer('increment_baisa').notNull(),
    amountBaisa: integer('amount_baisa').notNull(),
    createdAtMs: integer('created_at_ms').notNull(),
  },
  (table) => [
    uniqueIndex('demo_bids_idempotency_uq').on(table.idempotencyKey),
    index('demo_bids_lot_created_idx').on(table.lotId, table.createdAtMs),
    index('demo_bids_participant_created_idx').on(
      table.participantId,
      table.createdAtMs,
    ),
  ],
);

export const demoAuditEvents = sqliteTable(
  'demo_audit_events',
  {
    id: text('id').primaryKey(),
    eventType: text('event_type').notNull(),
    lotId: text('lot_id').notNull(),
    actorId: text('actor_id').notNull(),
    payloadJson: text('payload_json').notNull(),
    createdAtMs: integer('created_at_ms').notNull(),
  },
  (table) => [
    index('demo_audit_lot_created_idx').on(table.lotId, table.createdAtMs),
  ],
);

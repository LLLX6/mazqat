import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyBid,
  createAuctionState,
  formatOMR,
  closeAuction,
  extendAuction,
  pauseAuction,
  resumeAuction,
  setAllowedIncrements,
  settleAuction,
  tickAuction,
  withdrawParticipant,
} from '../public/auction-engine.js';

test('accepts only configured increments and advances version once', () => {
  const state = createAuctionState();
  const accepted = applyBid(state, { incrementBaisa: 5000, nickname: 'اختبار', idempotencyKey: 'bid-1' });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.state.currentBaisa, 865000);
  assert.equal(accepted.state.version, state.version + 1);

  const rejected = applyBid(state, { incrementBaisa: 2000, nickname: 'اختبار', idempotencyKey: 'bid-2' });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, 'INVALID_INCREMENT');
});

test('keeps idempotent retries from charging twice', () => {
  const first = applyBid(createAuctionState(), { incrementBaisa: 1000, nickname: 'اختبار', idempotencyKey: 'same' });
  const retry = applyBid(first.state, { incrementBaisa: 1000, nickname: 'اختبار', idempotencyKey: 'same' });
  assert.equal(retry.ok, true);
  assert.equal(retry.duplicate, true);
  assert.equal(retry.state.currentBaisa, first.state.currentBaisa);
});

test('soft close restores the visible ten-second window', () => {
  const state = createAuctionState({ remainingSeconds: 4 });
  const result = applyBid(state, { incrementBaisa: 10000, nickname: 'اختبار', idempotencyKey: 'late' });
  assert.equal(result.extended, true);
  assert.equal(result.state.remainingSeconds, 10);
});

test('withdrawal blocks new bids without deleting accepted bids', () => {
  const state = withdrawParticipant(createAuctionState());
  const result = applyBid(state, { incrementBaisa: 1000, nickname: 'اختبار', idempotencyKey: 'blocked' });
  assert.equal(result.code, 'PARTICIPANT_WITHDRAWN');
  assert.equal(result.state.bids.length, 3);
});

test('server-style countdown settles to a single winner', () => {
  const closing = tickAuction(createAuctionState({ remainingSeconds: 1 }), 1);
  assert.equal(closing.status, 'closing');
  const sold = settleAuction(closing);
  assert.equal(sold.status, 'sold');
  assert.equal(sold.winner, 'نورس_٧');
});

test('formats Omani rials with three decimal places', () => {
  assert.match(formatOMR(860000), /٨٦٠[٫.]٠٠٠|860[.,]000/);
});

test('organizer can pause, extend, and resume without losing accepted bids', () => {
  const original = createAuctionState({ remainingSeconds: 12 });
  const paused = pauseAuction(original);
  assert.equal(paused.status, 'paused');
  assert.equal(tickAuction(paused).remainingSeconds, 12);
  const extended = extendAuction(paused, 30);
  assert.equal(extended.remainingSeconds, 42);
  assert.equal(resumeAuction(extended).status, 'live');
  assert.deepEqual(extended.bids, original.bids);
});

test('organizer increment configuration is enforced by the bid engine', () => {
  const configured = setAllowedIncrements(createAuctionState(), [5000]);
  assert.equal(applyBid(configured, { incrementBaisa: 1000, nickname: 'اختبار', idempotencyKey: 'blocked-increment' }).code, 'INVALID_INCREMENT');
  assert.equal(applyBid(configured, { incrementBaisa: 5000, nickname: 'اختبار', idempotencyKey: 'allowed-increment' }).ok, true);
});

test('manual close enters the same single settlement path', () => {
  const closing = closeAuction(createAuctionState());
  assert.equal(closing.status, 'closing');
  assert.equal(settleAuction(closing).winner, 'نورس_٧');
});

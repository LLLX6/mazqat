export const BAISE_PER_OMR = 1000;
export const ALLOWED_INCREMENTS = Object.freeze([1000, 5000, 10000]);

export function createAuctionState(overrides = {}) {
  return {
    lotId: 'watch-001',
    currentBaisa: 860000,
    leader: 'نورس_٧',
    version: 7,
    remainingSeconds: 31,
    softCloseWindowSeconds: 10,
    status: 'live',
    withdrawn: false,
    seenKeys: [],
    bids: [
      { nickname: 'نورس_٧', amountBaisa: 860000, at: 'الآن' },
      { nickname: 'مسقطي', amountBaisa: 855000, at: 'منذ دقيقة' },
      { nickname: 'مها_٢٤', amountBaisa: 845000, at: 'منذ دقيقتين' },
    ],
    ...overrides,
  };
}

export function formatOMR(amountBaisa, fractionDigits = 3) {
  const amount = amountBaisa / BAISE_PER_OMR;
  return new Intl.NumberFormat('ar-OM', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}

export function applyBid(state, input) {
  const incrementBaisa = Number(input.incrementBaisa);
  const nickname = String(input.nickname || '').trim();
  const idempotencyKey = String(input.idempotencyKey || '').trim();

  if (state.status !== 'live') return { ok: false, code: 'AUCTION_NOT_LIVE', state };
  if (state.withdrawn) return { ok: false, code: 'PARTICIPANT_WITHDRAWN', state };
  if (!ALLOWED_INCREMENTS.includes(incrementBaisa)) return { ok: false, code: 'INVALID_INCREMENT', state };
  if (!nickname || nickname.length > 24) return { ok: false, code: 'INVALID_NICKNAME', state };
  if (!idempotencyKey) return { ok: false, code: 'MISSING_IDEMPOTENCY_KEY', state };
  if (state.seenKeys.includes(idempotencyKey)) return { ok: true, duplicate: true, state };

  const nextAmount = state.currentBaisa + incrementBaisa;
  const extended = state.remainingSeconds <= state.softCloseWindowSeconds;
  const nextBid = { nickname, amountBaisa: nextAmount, at: 'الآن' };
  return {
    ok: true,
    duplicate: false,
    extended,
    state: {
      ...state,
      currentBaisa: nextAmount,
      leader: nickname,
      version: state.version + 1,
      remainingSeconds: extended ? state.softCloseWindowSeconds : state.remainingSeconds,
      seenKeys: [...state.seenKeys, idempotencyKey].slice(-100),
      bids: [nextBid, ...state.bids].slice(0, 20),
    },
  };
}

export function tickAuction(state, seconds = 1) {
  if (state.status !== 'live') return state;
  const remainingSeconds = Math.max(0, state.remainingSeconds - Math.max(0, seconds));
  return { ...state, remainingSeconds, status: remainingSeconds === 0 ? 'closing' : 'live' };
}

export function settleAuction(state) {
  if (state.status !== 'closing') return state;
  return { ...state, status: state.leader ? 'sold' : 'unsold', winner: state.leader || null };
}

export function withdrawParticipant(state) {
  return { ...state, withdrawn: true };
}

export function resumeParticipant(state) {
  return { ...state, withdrawn: false };
}

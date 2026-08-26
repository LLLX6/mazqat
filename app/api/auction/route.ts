import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const LOT_ID = 'watch-001';
const OPENING_BAISA = 860_000;
const ALLOWED_INCREMENTS = new Set([1_000, 5_000, 10_000]);
const ID_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

type AuctionStatus = 'live' | 'closing' | 'sold' | 'unsold';

type AuctionRow = {
  lotId: string;
  currentBaisa: number;
  leader: string | null;
  leaderParticipantId: string | null;
  version: number;
  status: AuctionStatus;
  updatedAtMs: number;
};

type LeaderRow = {
  nickname: string;
  amountBaisa: number;
  createdAtMs: number;
};

function getDatabase() {
  return (env as unknown as Cloudflare.Env).DB;
}

function sharedPreviewEnabled() {
  return (env as unknown as Cloudflare.Env).DEMO_SHARED_BIDS === 'enabled-anonymous-demo';
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function fallbackSnapshot() {
  return {
    lotId: LOT_ID,
    currentBaisa: OPENING_BAISA,
    leader: null,
    version: 0,
    status: 'live' as const,
    bids: [],
  };
}

async function readSnapshot(db: D1Database) {
  const [stateResult, leaderResult] = await db.batch([
    db.prepare(
      `SELECT lot_id AS lotId,
              current_baisa AS currentBaisa,
              leader_nickname AS leader,
              leader_participant_id AS leaderParticipantId,
              version,
              status,
              updated_at_ms AS updatedAtMs
       FROM demo_auction_state
       WHERE lot_id = ?1`,
    )
      .bind(LOT_ID),
    db.prepare(
      `SELECT nickname,
              MAX(amount_baisa) AS amountBaisa,
              MAX(created_at_ms) AS createdAtMs
       FROM demo_bids
       WHERE lot_id = ?1
       GROUP BY participant_id, nickname
       ORDER BY amountBaisa DESC, createdAtMs ASC
       LIMIT 3`,
    )
      .bind(LOT_ID),
  ]);

  const row = stateResult.results?.[0] as AuctionRow | undefined;

  if (!row) return fallbackSnapshot();

  const leaders = (leaderResult.results ?? []) as LeaderRow[];

  return {
    lotId: row.lotId,
    currentBaisa: Number(row.currentBaisa),
    leader: row.leader,
    version: Number(row.version),
    status: row.status,
    bids: leaders.map((leader) => ({
      nickname: leader.nickname,
      amountBaisa: Number(leader.amountBaisa),
      createdAt: Number(leader.createdAtMs),
    })),
  };
}

function validateBid(input: unknown) {
  if (!input || typeof input !== 'object') return { ok: false as const, message: 'طلب غير صالح.' };
  const value = input as Record<string, unknown>;
  const nickname = typeof value.nickname === 'string' ? value.nickname.trim() : '';
  const incrementBaisa = Number(value.incrementBaisa);
  const expectedVersion = Number(value.expectedVersion);
  const lotId = typeof value.lotId === 'string' ? value.lotId : '';
  const participantId = typeof value.participantId === 'string' ? value.participantId : '';
  const idempotencyKey = typeof value.idempotencyKey === 'string' ? value.idempotencyKey : '';

  if (lotId !== LOT_ID) return { ok: false as const, message: 'القطعة غير متاحة في هذه المعاينة.' };
  if (!ALLOWED_INCREMENTS.has(incrementBaisa)) return { ok: false as const, message: 'قيمة الزيادة غير متاحة.' };
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) return { ok: false as const, message: 'نسخة السعر غير صالحة.' };
  if (!ID_PATTERN.test(participantId) || !ID_PATTERN.test(idempotencyKey)) return { ok: false as const, message: 'معرّف الطلب غير صالح.' };
  if (nickname.length < 3 || nickname.length > 24) return { ok: false as const, message: 'الاسم الظاهر يجب أن يكون بين ٣ و٢٤ حرفًا.' };

  return {
    ok: true as const,
    value: { lotId, participantId, idempotencyKey, nickname, incrementBaisa, expectedVersion },
  };
}

export async function GET() {
  if (!sharedPreviewEnabled()) {
    return json({
      mode: 'local-preview',
      snapshot: fallbackSnapshot(),
      limitation: 'SHARED_DEMO_DISABLED',
    });
  }

  try {
    const db = getDatabase();
    if (!db) throw new Error('D1 binding missing');
    return json({ mode: 'shared-preview', snapshot: await readSnapshot(db) });
  } catch {
    return json({
      mode: 'local-preview',
      snapshot: fallbackSnapshot(),
      limitation: 'D1_UNAVAILABLE',
    });
  }
}

export async function POST(request: Request) {
  if (!sharedPreviewEnabled()) {
    return json({
      code: 'SHARED_PREVIEW_DISABLED',
      message: 'المزايدة المشتركة غير مفعّلة. تعمل هذه النسخة محليًا داخل جهازك فقط.',
    }, 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ code: 'INVALID_JSON', message: 'تعذّر قراءة الطلب.' }, 400);
  }

  const validated = validateBid(body);
  if (!validated.ok) return json({ code: 'INVALID_BID', message: validated.message }, 400);

  const bid = validated.value;
  const now = Date.now();
  const bidId = crypto.randomUUID();
  const auditId = crypto.randomUUID();

  try {
    const db = getDatabase();
    if (!db) throw new Error('D1 binding missing');

    const duplicate = await db
      .prepare(
        `SELECT id FROM demo_bids
         WHERE idempotency_key = ?1 AND participant_id = ?2
         LIMIT 1`,
      )
      .bind(bid.idempotencyKey, bid.participantId)
      .first<{ id: string }>();

    if (duplicate) {
      return json({
        accepted: true,
        idempotent: true,
        snapshot: await readSnapshot(db),
      });
    }

    const recent = await db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM demo_bids
         WHERE participant_id = ?1 AND created_at_ms >= ?2`,
      )
      .bind(bid.participantId, now - 5_000)
      .first<{ count: number }>();

    if (Number(recent?.count ?? 0) >= 5) {
      return json({ code: 'RATE_LIMITED', message: 'تمهّل لحظة قبل المزايدة التالية.' }, 429);
    }

    await db
      .prepare(
        `INSERT INTO demo_auction_state
           (lot_id, current_baisa, leader_nickname, leader_participant_id, last_bid_id, version, status, updated_at_ms)
         VALUES (?1, ?2, NULL, NULL, NULL, 0, 'live', ?3)
         ON CONFLICT(lot_id) DO NOTHING`,
      )
      .bind(LOT_ID, OPENING_BAISA, now)
      .run();

    const nextVersion = bid.expectedVersion + 1;
    const results = await db.batch([
      db
        .prepare(
          `UPDATE demo_auction_state
           SET current_baisa = current_baisa + ?1,
               leader_nickname = ?2,
               leader_participant_id = ?3,
               last_bid_id = ?4,
               version = version + 1,
               updated_at_ms = ?5
           WHERE lot_id = ?6 AND version = ?7 AND status = 'live'`,
        )
        .bind(bid.incrementBaisa, bid.nickname, bid.participantId, bidId, now, LOT_ID, bid.expectedVersion),
      db
        .prepare(
          `INSERT INTO demo_bids
             (id, idempotency_key, lot_id, participant_id, nickname, increment_baisa, amount_baisa, created_at_ms)
           SELECT ?1, ?2, lot_id, ?3, ?4, ?5, current_baisa, ?6
           FROM demo_auction_state
           WHERE lot_id = ?7 AND version = ?8
             AND leader_participant_id = ?3 AND updated_at_ms = ?6
             AND last_bid_id = ?1`,
        )
        .bind(bidId, bid.idempotencyKey, bid.participantId, bid.nickname, bid.incrementBaisa, now, LOT_ID, nextVersion),
      db
        .prepare(
          `INSERT INTO demo_audit_events
             (id, event_type, lot_id, actor_id, payload_json, created_at_ms)
           SELECT ?1, 'bid.accepted', lot_id, ?2, ?3, ?4
           FROM demo_auction_state
           WHERE lot_id = ?5 AND version = ?6
             AND leader_participant_id = ?2 AND updated_at_ms = ?4
             AND last_bid_id = ?7`,
        )
        .bind(
          auditId,
          bid.participantId,
          JSON.stringify({ incrementBaisa: bid.incrementBaisa, expectedVersion: bid.expectedVersion }),
          now,
          LOT_ID,
          nextVersion,
          bidId,
        ),
    ]);

    if (Number(results[0]?.meta?.changes ?? 0) !== 1) {
      return json({
        code: 'STALE_VERSION',
        message: 'تغيّر السعر قبل تأكيد عرضك. راجع السعر الجديد ثم زايد مجددًا.',
        snapshot: await readSnapshot(db),
      }, 409);
    }

    return json({
      accepted: true,
      extended: false,
      snapshot: await readSnapshot(db),
    });
  } catch {
    return json({
      code: 'STORAGE_UNAVAILABLE',
      message: 'تعذّر الوصول إلى خادم المعاينة. لم تُسجّل مزايدتك.',
    }, 503);
  }
}

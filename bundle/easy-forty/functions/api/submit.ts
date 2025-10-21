import { getDb } from '../lib/db';
import { sendInitialSms } from '../lib/telnyx';
import { ensureActiveLink } from '../lib/links';
import { maybeWeeklyReset } from '../lib/reset';

export const onRequestPost: PagesFunction<{
  DB: D1Database
}> = async (ctx) => {
  try {
    const body = await ctx.request.json();
    const { phone, acornsStatus, payoutMethod, venmo, zelle } = body || {};

    if (!phone || typeof phone !== 'string') return json({ error: 'Invalid phone' }, 400);
    if (!['no','not_sure'].includes(acornsStatus)) return json({ error: 'Ineligible or invalid status' }, 400);
    if (!['venmo','zelle'].includes(payoutMethod)) return json({ error: 'Invalid payout method' }, 400);
    const payoutHandle = payoutMethod === 'venmo' ? venmo : zelle;
    if (!payoutHandle || typeof payoutHandle !== 'string') return json({ error: 'Missing payout handle' }, 400);

    await maybeWeeklyReset(ctx.env.DB);
    const db = getDb(ctx.env.DB);
    const active = await ensureActiveLink(db);

    const userId = cryptoRandomId();
    await db.exec(`INSERT INTO users (id, phone, acorns_status, payout_method, payout_handle, status, active_link_id)
                   VALUES (?, ?, ?, ?, ?, 'new', ?)`,[userId, phone, acornsStatus, payoutMethod, payoutHandle, active.id]);

    await sendInitialSms(ctx.env as any, phone);

    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e.message || 'Server error' }, 500);
  }
};

function json(data: any, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' }}); }
function cryptoRandomId() { return [...crypto.getRandomValues(new Uint8Array(16))].map(b=>b.toString(16).padStart(2,'0')).join(''); }

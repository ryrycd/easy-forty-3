import { getDb } from '../../lib/db';

export const onRequestGet: PagesFunction<{
  DB: D1Database
}> = async (ctx) => {
  // Middleware enforces auth

  const db = getDb(ctx.env.DB);
  const links = await db.query(`SELECT id, url, threshold, uses, active, sort_order FROM links ORDER BY sort_order`);
  const settings = await db.get(`SELECT reset_monday as resetMonday, notify_email as notifyEmail FROM settings LIMIT 1`) || { resetMonday: 0, notifyEmail: null };
  const recentUsers = await db.query(`SELECT id, phone, payout_method, payout_handle, status, state, created_at FROM users ORDER BY created_at DESC LIMIT 20`);

  return json({ links, settings, recentUsers });
};

function json(data: any, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' }}); }

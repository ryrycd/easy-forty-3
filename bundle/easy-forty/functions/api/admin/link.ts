import { getDb } from '../../lib/db';

export const onRequestPost: PagesFunction<{
  DB: D1Database
}> = async (ctx) => {
  const body = await ctx.request.json();
  const { url, threshold } = body || {};
  if (!url || !threshold) return new Response('Bad Request', { status: 400 });
  const db = getDb(ctx.env.DB);
  const id = cryptoId();
  const maxSort = await db.get<{ max: number }>(`SELECT COALESCE(MAX(sort_order),0) as max FROM links`);
  await db.exec(`INSERT INTO links (id, url, threshold, uses, active, sort_order) VALUES (?, ?, ?, 0, 0, ?)`, [id, url, Number(threshold), (maxSort?.max || 0) + 1]);
  return new Response('ok');
};

export const onRequestDelete: PagesFunction<{
  DB: D1Database
}> = async (ctx) => {
  const body = await ctx.request.json();
  const { id } = body || {};
  if (!id) return new Response('Bad Request', { status: 400 });
  const db = getDb(ctx.env.DB);
  await db.exec(`DELETE FROM links WHERE id = ?`, [id]);
  return new Response('ok');
};

function cryptoId() { return [...crypto.getRandomValues(new Uint8Array(16))].map(b=>b.toString(16).padStart(2,'0')).join(''); }

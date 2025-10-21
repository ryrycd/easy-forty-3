import { getDb } from '../../lib/db';

export const onRequestPost: PagesFunction<{
  DB: D1Database
}> = async (ctx) => {
  const body = await ctx.request.json();
  const links = (body?.links || []) as { url: string; threshold: number }[];
  const db = getDb(ctx.env.DB);
  const existing = await db.query<any>(`SELECT id, url FROM links ORDER BY sort_order`);

  // Rebuild ordered list; if url matches, keep id; otherwise create new
  let order = 1;
  for (const item of links) {
    const found = existing.find(e => e.url === item.url);
    if (found) {
      await db.exec(`UPDATE links SET threshold = ?, sort_order = ? WHERE id = ?`, [Number(item.threshold), order++, found.id]);
    } else {
      const id = cryptoId();
      await db.exec(`INSERT INTO links (id, url, threshold, uses, active, sort_order) VALUES (?, ?, ?, 0, 0, ?)`, [id, item.url, Number(item.threshold), order++]);
    }
  }

  // Remove extras not in list
  const keepUrls = new Set(links.map(l => l.url));
  for (const e of existing) {
    if (!keepUrls.has(e.url)) await db.exec(`DELETE FROM links WHERE id = ?`, [e.id]);
  }

  return new Response('ok');
};

function cryptoId() { return [...crypto.getRandomValues(new Uint8Array(16))].map(b=>b.toString(16).padStart(2,'0')).join(''); }

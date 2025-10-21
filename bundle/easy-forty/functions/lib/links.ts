import { getDb } from './db';

export type Link = { id: string; url: string; threshold: number; uses: number; active: number; sort_order: number };

export async function ensureActiveLink(db: ReturnType<typeof getDb>): Promise<Link> {
  let active = await db.get<Link>(`SELECT * FROM links WHERE active = 1 ORDER BY sort_order LIMIT 1`);
  if (active) return active;
  const first = await db.get<Link>(`SELECT * FROM links ORDER BY sort_order LIMIT 1`);
  if (!first) throw new Error('No referral links configured');
  await db.exec(`UPDATE links SET active = 0`);
  await db.exec(`UPDATE links SET active = 1 WHERE id = ?`, [first.id]);
  active = await db.get<Link>(`SELECT * FROM links WHERE id = ?`, [first.id]);
  if (!active) throw new Error('Failed to activate link');
  return active;
}

export async function recordUseAndRotate(db: ReturnType<typeof getDb>, linkId: string): Promise<void> {
  const link = await db.get<Link>(`SELECT * FROM links WHERE id = ?`, [linkId]);
  if (!link) return;
  const newUses = (link.uses ?? 0) + 1;
  await db.exec(`UPDATE links SET uses = ? WHERE id = ?`, [newUses, linkId]);
  if (newUses >= link.threshold) {
    // deactivate current and activate next
    await db.exec(`UPDATE links SET active = 0 WHERE id = ?`, [linkId]);
    const next = await db.get<Link>(`SELECT * FROM links WHERE id != ? ORDER BY sort_order LIMIT 1`, [linkId]);
    if (next) await db.exec(`UPDATE links SET active = 1 WHERE id = ?`, [next.id]);
  }
}

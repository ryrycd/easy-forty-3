import { getDb } from './db';

export async function maybeWeeklyReset(DB: D1Database) {
  const db = getDb(DB);
  const settings = await db.get<{ reset_monday: number }>(`SELECT reset_monday FROM settings WHERE id='singleton'`);
  if (!settings || !settings.reset_monday) return;
  // We store last reset date in settings; if not Monday or already reset today, skip
  const today = new Date();
  const day = today.getUTCDay(); // 1 = Monday
  const isMonday = day === 1;
  const last = await db.get<{ last_reset: string }>(`SELECT last_reset FROM settings WHERE id='singleton'`);
  const todayStr = today.toISOString().slice(0,10);
  if (!isMonday || last?.last_reset === todayStr) return;
  await db.exec(`UPDATE links SET uses = 0`);
  await db.exec(`INSERT INTO settings (id, last_reset) VALUES ('singleton', ?) ON CONFLICT(id) DO UPDATE SET last_reset = excluded.last_reset`, [todayStr]);
}

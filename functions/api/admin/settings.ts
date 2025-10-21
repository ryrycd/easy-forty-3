import { getDb } from '../../lib/db';

export const onRequestPost: PagesFunction<{
  DB: D1Database
}> = async (ctx) => {
  if (!(await requireAuth(ctx))) return new Response('Unauthorized', { status: 401 });
  const body = await ctx.request.json();
  const { resetMonday, notifyEmail, newAdminPassword } = body || {};
  const db = getDb(ctx.env.DB);
  await db.exec(`INSERT INTO settings (id, reset_monday, notify_email) VALUES ('singleton', ?, ?) ON CONFLICT(id) DO UPDATE SET reset_monday = excluded.reset_monday, notify_email = excluded.notify_email`, [resetMonday ? 1 : 0, notifyEmail]);
  if (newAdminPassword) {
    // Cloudflare Pages vars cannot be mutated here; instruction only. Still accept and store a hint
    await db.exec(`INSERT INTO settings (id, admin_pw_hint) VALUES ('singleton', ?) ON CONFLICT(id) DO UPDATE SET admin_pw_hint = excluded.admin_pw_hint`, [newAdminPassword.slice(0,2) + '••••']);
  }
  return new Response('ok');
};

async function requireAuth(ctx: EventContext<any, any, any>) {
  const auth = ctx.request.headers.get('Authorization') || '';
  if (!auth.startsWith('Basic ')) return false;
  const token = atob(auth.slice(6));
  const [user, pass] = token.split(':');
  return pass && pass === ctx.env.ADMIN_PASSWORD;
}

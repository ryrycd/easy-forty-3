// functions/api/admin/config.js
import { getConfig, setConfig, getLinks, setLinks } from '../../../lib/store.js';

function ok(body) { return new Response(JSON.stringify(body, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } }); }
function err(msg, code=400) { return new Response(msg, { status: code }); }

export async function onRequest({ request, env }) {
  const key = request.headers.get('X-Admin-Key');
  if (!env.ADMIN_KEY) return err('Server not configured: ADMIN_KEY missing', 500);
  if (key !== env.ADMIN_KEY) return err('Unauthorized', 401);

  const url = new URL(request.url);
  if (request.method === 'GET') {
    const cfg = await getConfig(env);
    return ok(cfg);
  }

  if (request.method === 'POST') {
    const action = url.searchParams.get('action') || '';
    if (action === 'resetNow') {
      const links = await getLinks(env);
      if (Array.isArray(links.items)) for (const L of links.items) L.used = 0;
      links.updatedAt = new Date().toISOString();
      await setLinks(env, links);
      return ok({ reset: true, at: links.updatedAt });
    }
    let body;
    try { body = await request.json(); } catch { return err('Invalid JSON'); }
    const cfg = await getConfig(env);
    const next = {
      autoResetWeekly: Boolean(body.autoResetWeekly ?? cfg.autoResetWeekly),
      lastResetMonday: cfg.lastResetMonday || null
    };
    await setConfig(env, next);
    return ok(next);
  }

  return err('Method not allowed', 405);
}

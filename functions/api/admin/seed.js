import { setLinks, logEvent } from '../../../lib/store.js';

export async function onRequestPost({ request, env }) {
  const key = request.headers.get('X-Admin-Key');
  if (!key || key !== env.ADMIN_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }
  let incoming;
  try {
    incoming = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  const items = Array.isArray(incoming) ? incoming : (incoming.items || []);
  const norm = items.map((it, i) => ({
    id: i + 1,
    url: String(it.url || '').trim(),
    quota: Number(it.quota || 0),
    used: Number(it.used || 0),
    note: it.note || ''
  })).filter(x => x.url && x.quota > 0);
  const data = { items: norm, activeIndex: 0, updatedAt: new Date().toISOString() };
  await setLinks(env, data);
  await logEvent(env, { type: 'seed', count: norm.length, t: Date.now() });
  return new Response(`Seeded ${norm.length} links.`, { status: 200 });
}

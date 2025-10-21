// functions/api/admin/seed.js
import { getLinks, setLinks, logEvent } from '../../../lib/store.js';

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_KEY) return new Response('Server not configured: ADMIN_KEY is missing in environment variables.', { status: 500 });
  const key = request.headers.get('X-Admin-Key');
  if (key !== env.ADMIN_KEY) return new Response('Unauthorized: Invalid admin key.', { status: 401 });

  const url = new URL(request.url);
  const mode = url.searchParams.get('mode') || 'replace'; // 'append' | 'replace'
  let incoming;
  try { incoming = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }

  const arr = Array.isArray(incoming) ? incoming : (incoming.items || []);
  const norm = arr.map((it, i) => ({
    id: i + 1, // purely client ordering hint
    url: String(it.url || '').trim(),
    quota: Number(it.quota ?? it.weekly ?? 0),
    used: Number(it.used || 0),
    dateAdded: it.dateAdded || null,
    note: it.note || ''
  })).filter(x => x.url && x.quota >= 0);

  if (mode === 'append') {
    const existing = await getLinks(env);
    const merged = (existing?.items || []).concat(norm);
    const data = { items: merged, activeIndex: 0, updatedAt: new Date().toISOString() };
    await setLinks(env, data);
    await logEvent(env, { type: 'seed_append', added: norm.length, total: merged.length, t: Date.now() });
    return new Response(`Appended ${norm.length} links. Total now ${merged.length}.`, { status: 200 });
  } else {
    const data = { items: norm, activeIndex: 0, updatedAt: new Date().toISOString() };
    await setLinks(env, data);
    await logEvent(env, { type: 'seed_replace', count: norm.length, t: Date.now() });
    return new Response(`Replaced with ${norm.length} links.`, { status: 200 });
  }
}

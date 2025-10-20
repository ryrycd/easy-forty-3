import { getLinks } from '../../../lib/store.js';

export async function onRequest({ request, env }) {
  const cfgKey = env.ADMIN_KEY;
  if (!cfgKey) {
    return new Response('Server not configured: ADMIN_KEY is missing.', { status: 500 });
  }
  const key = request.headers.get('X-Admin-Key');
  if (!key || key !== cfgKey) {
    return new Response('Unauthorized: Invalid admin key.', { status: 401 });
  }
  const links = await getLinks(env);
  const items = links?.items || [];
  const totals = {
    totalUsed: items.reduce((a,b)=>a+Number(b.used||0),0),
    totalQuota: items.reduce((a,b)=>a+Number(b.quota||0),0),
  };
  let activeIndex = -1;
  for (let i=0;i<items.length;i++){
    if (Number(items[i].used||0) < Number(items[i].quota||0)) { activeIndex = i; break; }
  }
  return new Response(JSON.stringify({ items, activeIndex, totals }, null, 2), {
    status: 200,
    headers: { 'Content-Type':'application/json' }
  });
}

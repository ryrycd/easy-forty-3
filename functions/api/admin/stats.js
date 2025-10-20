import { getLinks } from '../../../lib/store.js';

export async function onRequest({ request, env }) {
  const key = request.headers.get('X-Admin-Key');
  if (!key || key !== env.ADMIN_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }
  const links = await getLinks(env);
  return new Response(JSON.stringify(links, null, 2), { status: 200, headers: { 'Content-Type':'application/json' } });
}

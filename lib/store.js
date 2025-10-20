async function getJSON(kv, key, fallback) {
  const val = await kv.get(key);
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}
async function putJSON(kv, key, value) {
  await kv.put(key, JSON.stringify(value));
}
export async function getLinks(env) {
  return await getJSON(env.EASY40_DATA, 'links', { items: [], activeIndex: 0 });
}
export async function setLinks(env, data) {
  await putJSON(env.EASY40_DATA, 'links', data);
}
export async function getUser(env, phone) {
  return await getJSON(env.EASY40_DATA, `user:${phone}`, null);
}
export async function setUser(env, phone, obj) {
  await putJSON(env.EASY40_DATA, `user:${phone}`, obj);
}
export async function logEvent(env, obj) {
  const key = `event:${Date.now()}:${obj.phone || 'unknown'}`;
  await putJSON(env.EASY40_DATA, key, obj);
}
export function pickActiveLink(links) {
  if (!links || !links.items) return null;
  for (let i = 0; i < links.items.length; i++) {
    const L = links.items[i];
    const used = Number(L.used || 0);
    const quota = Number(L.quota || 0);
    if (quota === 0) continue; // skip invalid
    if (used < quota) return { index: i, link: L };
  }
  return null;
}
export function rotatorExhausted(links) {
  return !pickActiveLink(links);
}
export async function sendSMS(env, to, text) {
  const body = { from: env.TOLL_FREE_NUMBER, to, text };
  const res = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.TELNYX_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Telnyx send failed: ${res.status} ${t}`);
  }
}
export async function replySMS(env, inboundPayload, text) {
  const from =
    inboundPayload?.data?.record?.from?.phone_number ||
    inboundPayload?.data?.payload?.from?.phone_number ||
    inboundPayload?.from?.phone_number ||
    inboundPayload?.from ||
    null;
  if (!from) throw new Error('Cannot determine sender for reply');
  return await sendSMS(env, from, text);
}
export function getInboundFrom(payload) {
  return payload?.data?.record?.from?.phone_number ||
         payload?.data?.payload?.from?.phone_number ||
         payload?.from?.phone_number ||
         payload?.from || null;
}
export function getInboundText(payload) {
  return payload?.data?.record?.text ||
         payload?.data?.payload?.text ||
         payload?.text || '';
}
export function getInboundMedia(payload) {
  const media =
    payload?.data?.record?.media ||
    payload?.data?.payload?.media ||
    payload?.media || [];
  if (Array.isArray(media)) {
    return media.map(m => (typeof m === 'string' ? m : (m?.url || m?.media_url))).filter(Boolean);
  }
  return [];
}

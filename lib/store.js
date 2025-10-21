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

export function isFrozen(env) {
  return env.FREEZE === 'true' || !env.TELNYX_API_KEY || env.TELNYX_API_KEY === 'DISABLED';
}

export async function logEvent(env, obj) {
  if (env.NO_LOG === 'true') return;            // <—— turn off logs entirely if needed
  // (Optional) sample logs to 1/20th volume:
  if (env.LOG_SAMPLE && Math.random() > Number(env.LOG_SAMPLE)) return;
  const key = `event:${Date.now()}:${obj.phone || 'unknown'}`;
  await putJSON(env.EASY40_DATA, key, obj);
}

export function pickActiveLink(links) {
  if (!links || !links.items) return null;
  for (let i = 0; i < links.items.length; i++) {
    const L = links.items[i];
    const used = Number(L.used || 0);
    const quota = Number(L.quota || 0);
    if (quota > 0 && used < quota) return { index: i, link: L };
  }
  return null;
}

function isValidUS(to) {
  return typeof to === 'string' && /^\+1\d{10}$/.test(to);
}

export async function sendSMS(env, to, text) {
  // Absolute safety: never send in freeze/dry-run, and never send to non-US.
  if (isFrozen(env)) return;
  if (!isValidUS(to)) return;

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

export function getInboundFrom(payload) {
  return payload?.data?.record?.from?.phone_number ||
         payload?.data?.payload?.from?.phone_number ||
         payload?.from?.phone_number ||
         payload?.from || null;
}
export function getInboundTo(payload) {
  return payload?.data?.record?.to?.phone_number ||
         payload?.data?.payload?.to?.phone_number ||
         payload?.to?.phone_number ||
         payload?.to || null;
}
export function getInboundText(payload) {
  return payload?.data?.record?.text ||
         payload?.data?.payload?.text ||
         payload?.text || '';
}
export function getInboundMedia(payload) {
  const media = payload?.data?.record?.media ||
                payload?.data?.payload?.media ||
                payload?.media || [];
  if (Array.isArray(media)) {
    return media.map(m => (typeof m === 'string' ? m : (m?.url || m?.media_url))).filter(Boolean);
  }
  return [];
}

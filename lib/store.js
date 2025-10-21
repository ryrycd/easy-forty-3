// lib/store.js
// Storage helpers + safety + Telnyx helpers + weekly reset

async function getJSON(kv, key, fallback) {
  const val = await kv.get(key);
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}
async function putJSON(kv, key, value) {
  await kv.put(key, JSON.stringify(value));
}

// ---------- Links ----------
export async function getLinks(env) {
  return await getJSON(env.EASY40_DATA, 'links', { items: [], activeIndex: 0, updatedAt: null });
}
export async function setLinks(env, data) {
  await putJSON(env.EASY40_DATA, 'links', data);
}

// ---------- Users ----------
export async function getUser(env, phone) {
  return await getJSON(env.EASY40_DATA, `user:${phone}`, null);
}
export async function setUser(env, phone, obj) {
  await putJSON(env.EASY40_DATA, `user:${phone}`, obj);
}

// ---------- Config ----------
export async function getConfig(env) {
  // { autoResetWeekly: bool, lastResetMonday: 'YYYY-MM-DD' }
  return await getJSON(env.EASY40_DATA, 'config', { autoResetWeekly: false, lastResetMonday: null });
}
export async function setConfig(env, cfg) {
  await putJSON(env.EASY40_DATA, 'config', cfg);
}

// Reset "used" to 0 every Monday once per week when enabled.
export async function ensureWeeklyReset(env) {
  const cfg = await getConfig(env);
  if (!cfg.autoResetWeekly) return;

  // Compute this week's Monday in UTC as YYYY-MM-DD
  const now = new Date();
  const day = now.getUTCDay();              // 0..6 (Sun..Sat)
  const diffToMonday = (day + 6) % 7;       // 0 if Monday
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - diffToMonday);
  const mondayStr = monday.toISOString().slice(0, 10);

  if (cfg.lastResetMonday === mondayStr) return;      // already reset this Monday
  if (day !== 1) return;                              // only reset on Monday

  const links = await getLinks(env);
  if (Array.isArray(links.items)) {
    for (const L of links.items) L.used = 0;
    links.updatedAt = new Date().toISOString();
    await setLinks(env, links);
  }
  cfg.lastResetMonday = mondayStr;
  await setConfig(env, cfg);
}

// ---------- Logging (KV-safe) ----------
export function isFrozen(env) {
  return env.FREEZE === 'true' || !env.TELNYX_API_KEY || env.TELNYX_API_KEY === 'DISABLED';
}
export async function logEvent(env, obj) {
  if (env.NO_LOG === 'true') return;
  if (env.LOG_SAMPLE && Math.random() > Number(env.LOG_SAMPLE)) return;
  const key = `event:${Date.now()}:${obj.phone || 'unknown'}`;
  await putJSON(env.EASY40_DATA, key, obj);
}

// ---------- Link picker ----------
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

// ---------- Telnyx ----------
function isValidUS(to) { return typeof to === 'string' && /^\+1\d{10}$/.test(to); }
export async function sendSMS(env, to, text) {
  if (isFrozen(env)) return;
  if (!isValidUS(to)) return;
  const body = { from: env.TOLL_FREE_NUMBER, to, text };
  const res = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.TELNYX_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Telnyx send failed: ${res.status} ${await res.text()}`);
}

// ---------- Webhook payload helpers ----------
export function getInboundFrom(payload) {
  return payload?.data?.record?.from?.phone_number ||
         payload?.data?.payload?.from?.phone_number ||
         payload?.from?.phone_number || payload?.from || null;
}
export function getInboundTo(payload) {
  return payload?.data?.record?.to?.phone_number ||
         payload?.data?.payload?.to?.phone_number ||
         payload?.to?.phone_number || payload?.to || null;
}
export function getInboundText(payload) {
  return payload?.data?.record?.text ||
         payload?.data?.payload?.text || payload?.text || '';
}
export function getInboundMedia(payload) {
  const media = payload?.data?.record?.media ||
                payload?.data?.payload?.media || payload?.media || [];
  if (!Array.isArray(media)) return [];
  return media.map(m => (typeof m === 'string' ? m : (m?.url || m?.media_url))).filter(Boolean);
}

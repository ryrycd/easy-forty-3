import { normalizeUS, validHandle } from '../../lib/validation.js';
import { getLinks, setUser, pickActiveLink, sendSMS, logEvent, isFrozen } from '../../lib/store.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export async function onRequestOptions() { return new Response(null, { status: 204, headers: CORS }); }

export async function onRequestPost({ request, env }) {
  try {
    const { phone, handle, consent } = await request.json();

    if (isFrozen(env)) return json({ error: 'Temporarily paused. Please try again later.' }, 503);
    if (!consent) return json({ error: 'Consent required.' }, 400);

    const e164 = normalizeUS(phone);
    if (!e164) return json({ error: 'Invalid phone.' }, 400);
    if (handle && !validHandle(handle)) return json({ error: 'Invalid payout handle.' }, 400);

    let links = await getLinks(env);
    if (!links || !links.items || links.items.length === 0) {
      return json({ error: 'No referral links configured yet. Try again later.' }, 503);
    }
    const choice = pickActiveLink(links);
    if (!choice) return json({ error: 'All referral links are currently exhausted. Try again later.' }, 503);

    const assigned = choice.link.url;
    const user = {
      phone: e164,
      handle,
      status: 'welcomed',
      assignedLinkUrl: assigned,
      linkIndex: choice.index,
      unsubscribed: false,
      createdAt: new Date().toISOString()
    };
    await setUser(env, e164, user);
    await logEvent(env, { type: 'register', phone: e164, link: assigned, t: Date.now() });

    const welcome = `Easy Forty: Your unique Acorns link: ${assigned}
1) Sign up  2) Deposit $5  3) Reply DONE
Reply STOP to opt out. HELP for help.`;

    await sendSMS(env, e164, welcome);

    return json({ ok: true });
  } catch (err) {
    return json({ error: err.message || 'Server error' }, 500);
  }
}

function json(body, status=200, extraHeaders={}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extraHeaders }
  });
}

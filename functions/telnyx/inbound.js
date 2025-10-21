// functions/telnyx/inbound.js
import {
  getLinks, setLinks, getUser, setUser, sendSMS, logEvent,
  getInboundFrom, getInboundTo, getInboundText, getInboundMedia, isFrozen
} from '../../lib/store.js';

export async function onRequestPost({ request, env }) {
  // Shared-secret gate
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!env.WEBHOOK_TOKEN || token !== env.WEBHOOK_TOKEN) {
    return new Response('Unauthorized webhook', { status: 401 });
  }

  let payload;
  try { payload = await request.json(); } catch { return new Response('Bad Request', { status: 400 }); }

  // Accept ONLY real inbound messages (ignore status/DLR/outbound events)
  const type = payload?.data?.event_type || payload?.data?.type || '';
  if (type !== 'message.received') {
    console.log('telnyx-inbound: ignored non-inbound event', { type });
    return new Response('Ignored non-inbound event', { status: 200 });
  }

  const from = getInboundFrom(payload);
  const to   = getInboundTo(payload);
  const text = String(getInboundText(payload) || '').trim();
  const media = getInboundMedia(payload) || [];
  console.log('telnyx-inbound', { type, from, to, mediaCount: media.length });

  // Only process messages addressed to YOUR TFN
  if (!to || (env.TOLL_FREE_NUMBER && to !== env.TOLL_FREE_NUMBER)) {
    return new Response('Ignored: not our number', { status: 200 });
  }

  // Never respond to ourselves (prevents TFN↔TFN loops)
  if (from && env.TOLL_FREE_NUMBER && from === env.TOLL_FREE_NUMBER) {
    return new Response('Ignored: self-message', { status: 200 });
  }

  // Frozen = acknowledge, no sends
  if (isFrozen(env)) {
    await logEvent(env, { type:'frozen_inbound', from, to, text, t: Date.now() });
    return new Response('OK', { status: 200 });
  }

  // Fetch / create user
  let user = await getUser(env, from);
  if (!user) user = { phone: from, status: 'unknown', createdAt: new Date().toISOString(), unsubscribed:false };

  const upper = text.toUpperCase();

  // STOP/HELP
  if (['STOP','STOP ALL','UNSUBSCRIBE','CANCEL','END','QUIT'].includes(upper)) {
    user.unsubscribed = true;
    user.status = 'opted_out';
    await setUser(env, from, user);
    try { await sendSMS(env, from, 'You opted out of Easy Forty. No more messages will be sent.'); } catch {}
    await logEvent(env, { type:'stop', phone: from, t: Date.now() });
    return new Response('OK', { status: 200 });
  }
  if (upper === 'HELP') {
    try { await sendSMS(env, from, 'Easy Forty help: Reply DONE after deposit, then send a screenshot. Email support@easyforty.com. Msg&data rates may apply.'); } catch {}
    await logEvent(env, { type:'help', phone: from, t: Date.now() });
    return new Response('OK', { status: 200 });
  }

  if (user.unsubscribed) return new Response('OK', { status: 200 });

  // DONE → ask for proof
  if (/^DONE\b/i.test(text)) {
    user.status = 'awaiting_proof';
    await setUser(env, from, user);
    try { await sendSMS(env, from, 'Nice! Please reply with a screenshot showing the $5 Acorns deposit.'); } catch {}
    await logEvent(env, { type:'done', phone: from, t: Date.now() });
    return new Response('OK', { status: 200 });
  }

  // MMS proof → verify + increment link usage
  if (media && media.length > 0) {
    user.status = 'verified';
    user.proofUrls = media;
    user.verifiedAt = new Date().toISOString();
    try {
      const links = await getLinks(env);
      const idx = user.linkIndex ?? null;
      if (idx !== null && links?.items?.[idx]) {
        links.items[idx].used = Number(links.items[idx].used || 0) + 1;
        await setLinks(env, links);
      }
    } catch {}
    await setUser(env, from, user);
    try {
      await sendSMS(env, from, 'Thanks! Proof received. We will review and send your payout soon.');
      if (env.OWNER_PHONE) {
        await sendSMS(env, env.OWNER_PHONE, `Easy Forty: Verified ${from} (${user.handle||'no handle'}) link#${user.linkIndex ?? '?'} proof: ${media[0]}`);
      }
    } catch {}
    await logEvent(env, { type:'verified', phone: from, t: Date.now(), mediaCount: media.length });
    return new Response('OK', { status: 200 });
  }

  // Soft nudge
  try {
    if (user.status === 'welcomed') {
      await sendSMS(env, from, 'Remember: sign up via your link, deposit $5, then reply DONE and send a screenshot. Reply HELP for help.');
    } else if (user.status === 'awaiting_proof') {
      await sendSMS(env, from, 'Please reply with a screenshot of your $5 deposit so we can verify.');
    } else {
      await sendSMS(env, from, 'Welcome to Easy Forty. Text DONE after you deposit $5 via your unique link, then send a screenshot for verification.');
    }
  } catch {}
  await setUser(env, from, user);
  return new Response('OK', { status: 200 });
}

import { getLinks, setLinks, getUser, setUser, sendSMS, logEvent, getInboundFrom, getInboundText, getInboundMedia } from '../../lib/store.js';

export async function onRequestPost({ request, env }) {
  let payload;
  try { payload = await request.json(); } catch { payload = null; }
  if (!payload) return new Response('Bad Request', { status: 400 });

  const from = getInboundFrom(payload);
  if (!from) return new Response('No sender', { status: 200 });

  const textRaw = getInboundText(payload) || '';
  const text = String(textRaw).trim();
  const media = getInboundMedia(payload);

  let user = await getUser(env, from);
  if (!user) {
    user = { phone: from, status: 'unknown', createdAt: new Date().toISOString(), unsubscribed:false };
  }

  const upper = text.toUpperCase();
  if (['STOP','STOP ALL','UNSUBSCRIBE','CANCEL','END','QUIT'].includes(upper)) {
    user.unsubscribed = true;
    user.status = 'opted_out';
    await setUser(env, from, user);
    await sendSMS(env, from, 'You opted out of Easy Forty. No more messages will be sent.');
    await logEvent(env, { type:'stop', phone: from, t: Date.now() });
    return new Response('OK', { status: 200 });
  }
  if (upper === 'HELP') {
    await sendSMS(env, from, 'Easy Forty help: Reply DONE after deposit, then send a screenshot. Email support@easyforty.com. Msg&data rates may apply.');
    await logEvent(env, { type:'help', phone: from, t: Date.now() });
    return new Response('OK', { status: 200 });
  }
  if (user.unsubscribed) {
    return new Response('OK', { status: 200 });
  }

  if (/^DONE\b/i.test(text)) {
    user.status = 'awaiting_proof';
    await setUser(env, from, user);
    await sendSMS(env, from, 'Nice! Please reply with a screenshot showing the $5 Acorns deposit.');
    await logEvent(env, { type:'done', phone: from, t: Date.now() });
    return new Response('OK', { status: 200 });
  }

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
    } catch (e) {}

    await setUser(env, from, user);
    await sendSMS(env, from, 'Thanks! Proof received. We will review and send your payout soon.');
    if (env.OWNER_PHONE) {
      await sendSMS(env, env.OWNER_PHONE, `Easy Forty: Verified ${from} (${user.handle||'no handle'}) link#${user.linkIndex ?? '?'} proof: ${media[0]}`);
    }
    await logEvent(env, { type:'verified', phone: from, t: Date.now(), mediaCount: media.length });
    return new Response('OK', { status: 200 });
  }

  if (user.status === 'welcomed') {
    await sendSMS(env, from, 'Remember: sign up via your link, deposit $5, then reply DONE and send a screenshot. Reply HELP for help.');
  } else if (user.status === 'awaiting_proof') {
    await sendSMS(env, from, 'Please reply with a screenshot of your $5 deposit so we can verify.');
  } else {
    await sendSMS(env, from, 'Welcome to Easy Forty. Text DONE after you deposit $5 via your unique link, then send a screenshot for verification.');
  }
  await setUser(env, from, user);
  return new Response('OK', { status: 200 });
}

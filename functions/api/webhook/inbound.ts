import { getDb } from '../../lib/db';
import { ensureActiveLink, recordUseAndRotate } from '../../lib/links';
import { sendMessage } from '../../lib/telnyx';

export const onRequestPost: PagesFunction<{
  DB: D1Database,
  EASYFORTY_BUCKET: R2Bucket
}> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const token = url.searchParams.get('token');
  if (!token || token !== ctx.env.WEBHOOK_TOKEN) return new Response('ignored', { status: 200 });

  // Only accept Telnyx event: message.received
  try {
    const payload = await ctx.request.json<any>();
    const eventType = payload?.data?.event_type || payload?.data?.record_type;
    if (eventType !== 'message.received') return new Response('ignored', { status: 200 });

    const toNumber = payload.data.payload?.to?.[0]?.phone_number || payload.data.payload?.to || '';
    // Prevent loops: if Telnyx posts our own outgoing messages, ignore; also ignore any message where 'to' equals our from number
    const ourFrom = ctx.env.TELNYX_FROM_NUMBER;
    if (toNumber && String(toNumber).replace(/\D/g,'') === String(ourFrom).replace(/\D/g,'')) {
      return new Response('ignored', { status: 200 });
    }

    const from = payload.data.payload?.from?.phone_number;
    const text: string = (payload.data.payload?.text || '').trim().toUpperCase();
    const media = payload.data.payload?.media || [];

    const db = getDb(ctx.env.DB);
    const user = await db.get<any>(`SELECT * FROM users WHERE phone = ? ORDER BY created_at DESC LIMIT 1`, [from]);

    if (!user) {
      // Unknown number; provide brief info and opt-out, include compliance tags
      await sendMessage(ctx.env as any, from, `${ctx.env.BUSINESS_NAME}: This line supports our referral program. Visit ${ctx.env.APP_BASE_URL} to join. Msg&data rates may apply. Reply STOP to opt out.`);
      return new Response('ok');
    }

    if (text === 'HELP') {
      await sendMessage(ctx.env as any, from, `${ctx.env.BUSINESS_NAME}: We\'re here to help. Questions? Email ${ctx.env.SUPPORT_EMAIL}. Msg&data rates may apply. Reply STOP to opt out.`);
      return new Response('ok');
    }

    if (text === 'STOP' || text === 'UNSUBSCRIBE' || text === 'CANCEL' || text === 'QUIT') {
      await db.exec(`UPDATE users SET status = 'opted_out' WHERE id = ?`, [user.id]);
      return new Response('ok');
    }

    if (!user.state || user.state === 'awaiting_ready') {
      if (text !== 'READY') {
        await sendMessage(ctx.env as any, from, `Reply READY when you’ve read the steps and are set to get your Acorns link.`);
        return new Response('ok');
      }

      const link = await ensureActiveLink(db);
      const longInstructions = [
        'Thank you for completing the form! You\'re just a few minutes away from being $40 richer. In order for you to be a valid referral, you MUST:',
        '',
        '- Deposit $5 into your Acorns account.',
        '- Keep the $5 in your account for 2 MONTHS.',
        '- After 2 months, you will be sent a text from this number letting you know you can cancel your account and withdraw your $5.',
        '- You must get an Acorns plan for these 2 months, the cheapest plan is the Bronze plan. The first month is free, and on the second month you will be charged $3. After that, you will have cancelled your account.',
        '- In return for all of this, we\'ll send you $40 via your selected method today.',
        '',
        'The following are not required, so please SKIP them on the top right when they come up:',
        'SKIP "Acorns Later"',
        'SKIP "Weekly recurring investments"',
        'SKIP "Round-ups"',
        '',
        'ONLY DO the ONE-TIME $5 Deposit.',
        '',
        'Here is your referral link:',
        link.url,
        '',
        'When you have finished the sign-up process and the $5 deposit, please reply DONE.',
        '',
        'By continuing, you consent to receive SMS/MMS from us regarding this referral. Msg&data rates may apply. Reply STOP to opt out.'
      ].join('\n');

      await sendMessage(ctx.env as any, from, longInstructions);
      await db.exec(`UPDATE users SET state = 'awaiting_done', active_link_id = ? WHERE id = ?`, [link.id, user.id]);
      return new Response('ok');
    }

    if (user.state === 'awaiting_done') {
      if (text === 'DONE') {
        await sendMessage(ctx.env as any, from, 'Please send a screenshot of proof of your $5 one-time deposit to complete verification.');
        await db.exec(`UPDATE users SET state = 'awaiting_proof' WHERE id = ?`, [user.id]);
        return new Response('ok');
      }
      await sendMessage(ctx.env as any, from, 'Reply DONE once you have completed sign-up and the $5 deposit.');
      return new Response('ok');
    }

    if (user.state === 'awaiting_proof') {
      if (Array.isArray(media) && media.length > 0) {
        // Store proof reference
        const first = media[0];
        const mediaUrl = first.url || first.media_url || first?.url_expiring || '';

        // Fetch the media payload (authenticated if needed) and upload to R2
        let arrayBuf: ArrayBuffer | null = null;
        let contentType = 'application/octet-stream';
        if (mediaUrl) {
          const res = await fetch(mediaUrl, { headers: { authorization: `Bearer ${(ctx.env as any).TELNYX_API_KEY}` } });
          if (res.ok) {
            contentType = res.headers.get('content-type') || contentType;
            arrayBuf = await res.arrayBuffer();
          }
        }
        let r2Key = '';
        if (arrayBuf) {
          const ext = contentType.includes('png') ? 'png' : contentType.includes('jpeg') ? 'jpg' : contentType.includes('gif') ? 'gif' : 'bin';
          r2Key = `proofs/${user.id}/${Date.now()}-0.${ext}`;
          await ctx.env.EASYFORTY_BUCKET.put(r2Key, arrayBuf, { httpMetadata: { contentType } });
        }
        const storedUrl = r2Key ? `/api/proofs/${encodeURIComponent(r2Key)}` : mediaUrl;
        await db.exec(`INSERT INTO proofs (id, user_id, media_url, received_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`, [cryptoId(), user.id, storedUrl]);
        await db.exec(`UPDATE users SET state = 'proof_received', status = 'pending_verification' WHERE id = ?`, [user.id]);

        // Count as a use for the link and possibly rotate
        if (user.active_link_id) await recordUseAndRotate(db, user.active_link_id);

        const payout = user.payout_method === 'venmo' ? `Venmo ${user.payout_handle}` : `Zelle ${user.payout_handle}`;
        await sendMessage(ctx.env as any, from, `Thank you! Please allow up to 24 hours to verify your deposit. Once verified, we will send $40 to ${payout}. Msg&data rates may apply. Reply STOP to opt out.`);
        return new Response('ok');
      }
      await sendMessage(ctx.env as any, from, 'Please attach your screenshot so we can verify.');
      return new Response('ok');
    }

    return new Response('ok');
  } catch (e) {
    return new Response('ignored', { status: 200 });
  }
};

function cryptoId() { return [...crypto.getRandomValues(new Uint8Array(16))].map(b=>b.toString(16).padStart(2,'0')).join(''); }

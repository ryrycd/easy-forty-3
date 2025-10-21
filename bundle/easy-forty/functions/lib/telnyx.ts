type Env = {
  TELNYX_API_KEY: string
  TELNYX_MESSAGING_PROFILE_ID: string
  TELNYX_FROM_NUMBER: string
  APP_BASE_URL: string
  BUSINESS_NAME: string
}

async function telnyxRequest(env: Env, path: string, init: RequestInit) {
  const res = await fetch(`https://api.telnyx.com/v2${path}`, {
    ...init,
    headers: {
      'authorization': `Bearer ${env.TELNYX_API_KEY}`,
      'content-type': 'application/json',
      ...(init.headers || {})
    }
  });
  if (!res.ok) throw new Error(`Telnyx ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function sendInitialSms(env: Env, to: string) {
  const text = `Thanks for your interest in ${env.BUSINESS_NAME}. By replying, you consent to receive SMS/MMS from us about this referral. Msg & data rates may apply. Reply STOP to opt out. Reply READY when you’ve read the steps to receive your unique link.`;
  await telnyxRequest(env, '/messages', {
    method: 'POST',
    body: JSON.stringify({
      from: env.TELNYX_FROM_NUMBER,
      to,
      messaging_profile_id: env.TELNYX_MESSAGING_PROFILE_ID,
      text
    })
  });
}

export async function sendMessage(env: Env, to: string, text: string) {
  await telnyxRequest(env, '/messages', {
    method: 'POST',
    body: JSON.stringify({
      from: env.TELNYX_FROM_NUMBER,
      to,
      messaging_profile_id: env.TELNYX_MESSAGING_PROFILE_ID,
      text
    })
  });
}

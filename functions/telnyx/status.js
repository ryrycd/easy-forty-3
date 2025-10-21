export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!env.STATUS_TOKEN || token !== env.STATUS_TOKEN) {
    return new Response('Unauthorized status webhook', { status: 401 });
  }
  // Minimal log for diagnosis (doesn't use KV)
  try {
    const body = await request.json();
    console.log('telnyx-status', {
      type: body?.data?.event_type || body?.data?.type,
      id: body?.data?.payload?.id || body?.data?.record?.id,
      to: body?.data?.payload?.to?.[0]?.phone_number || body?.data?.record?.to?.[0]?.phone_number
    });
  } catch {}
  return new Response('OK', { status: 200 });
}

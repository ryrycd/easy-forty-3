export const onRequestGet: PagesFunction<{ EASYFORTY_BUCKET: R2Bucket }> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const key = decodeURIComponent(url.pathname.replace(/^\/api\/proofs\//, ''));
  if (!key) return new Response('Not found', { status: 404 });
  const obj = await ctx.env.EASYFORTY_BUCKET.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, { headers: { 'content-type': obj.httpMetadata?.contentType || 'application/octet-stream', 'cache-control': 'private, max-age=31536000' } });
};

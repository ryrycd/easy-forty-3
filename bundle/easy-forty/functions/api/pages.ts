export const onRequestGet: PagesFunction = async (ctx) => {
  const url = new URL(ctx.request.url);
  if (url.pathname === '/privacy') {
    return fetch(new URL('/legal/privacy.html', url).toString());
  }
  if (url.pathname === '/terms') {
    return fetch(new URL('/legal/terms.html', url).toString());
  }
  return new Response('Not found', { status: 404 });
};

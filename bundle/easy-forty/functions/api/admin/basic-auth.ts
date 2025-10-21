export function withBasicAuth(handler: PagesFunction): PagesFunction {
  return async (ctx) => {
    const auth = ctx.request.headers.get('Authorization') || '';
    if (!auth.startsWith('Basic ')) return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="EasyForty Admin"' }});
    const token = atob(auth.slice(6));
    const [user, pass] = token.split(':');
    if (!pass || pass !== (ctx.env as any).ADMIN_PASSWORD) return new Response('Unauthorized', { status: 401 });
    return handler(ctx);
  };
}

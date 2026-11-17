import type { NextRequest } from 'next/server';

const apiOrigin = (
  process.env.API_PROXY_TARGET ||
  (process.env.VERCEL ? 'https://api.florabot.site' : 'http://127.0.0.1:5080')
).replace(/\/$/, '');

const STRIP_REQUEST_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'origin',
  'referer',
  'content-length',
  'expect',
]);

const qualityEvidencePath =
  /^\/api\/(receipts\/complaints|me\/complaints|admin\/quality-complaints|staff\/quality-complaints)\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\/evidence\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

async function handleProxy(req: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  try {
    const { path = [] } = await context.params;
    const search = req.nextUrl.search || '';
    const apiPath = `/api/${path.map(encodeURIComponent).join('/')}`;
    const qualityEvidence = qualityEvidencePath.exec(apiPath);
    if (/(?:quality-complaints|(?:receipts|me)\/complaints)\/.*\/evidence(?:\/|$)/i.test(apiPath)) {
      if (!qualityEvidence || search) return new Response(null, { status: 404 });
      const allowed = qualityEvidence[1].toLowerCase() === 'receipts/complaints' ? 'POST' : 'GET';
      if (req.method !== allowed)
        return new Response(null, { status: 405, headers: { Allow: allowed } });
    }
    const targetUrl = `${apiOrigin}${apiPath}${search}`;

    const headers = new Headers();
    req.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (
        !STRIP_REQUEST_HEADERS.has(lower) &&
        !lower.startsWith('x-forwarded-') &&
        !lower.startsWith('sec-fetch-')
      ) {
        headers.set(key, value);
      }
    });
    headers.set('origin', apiOrigin);
    if (qualityEvidence?.[1].toLowerCase() === 'receipts/complaints') {
      headers.delete('cookie');
      headers.delete('authorization');
    }

    const method = req.method.toUpperCase();
    const hasBody = method !== 'GET' && method !== 'HEAD';
    const body = hasBody ? await req.arrayBuffer() : undefined;

    const upstream = await fetch(targetUrl, {
      method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      redirect: 'manual',
      cache: 'no-store',
    });

    const responseHeaders = new Headers();
    if (qualityEvidence && upstream.status >= 300 && upstream.status < 400)
      return new Response(null, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (
        lower !== 'set-cookie' &&
        lower !== 'transfer-encoding' &&
        lower !== 'content-encoding' &&
        lower !== 'content-length'
      ) {
        responseHeaders.set(key, value);
      }
    });

    const setCookies =
      typeof upstream.headers.getSetCookie === 'function' ? upstream.headers.getSetCookie() : [];
    const isLocalHttp = req.nextUrl.protocol === 'http:';

    for (const cookie of setCookies) {
      const rewritten = isLocalHttp
        ? cookie.replace(/;\s*Domain=[^;]+/gi, '').replace(/;\s*Secure/gi, '')
        : cookie.replace(/;\s*Domain=[^;]+/gi, '');
      responseHeaders.append('set-cookie', rewritten);
    }

    const responseBody =
      upstream.status === 204 || upstream.status === 304 ? null : await upstream.arrayBuffer();

    return new Response(responseBody, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    const cause =
      err instanceof Error && 'cause' in err ? String((err as { cause?: unknown }).cause) : '';
    return Response.json(
      {
        detail: `${err instanceof Error ? err.message : String(err)}${cause ? ` (${cause})` : ''}`,
      },
      { status: 502 },
    );
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
export const OPTIONS = handleProxy;
export const HEAD = handleProxy;

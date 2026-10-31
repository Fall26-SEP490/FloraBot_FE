import { setTimeout } from 'node:timers';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const data = JSON.parse(
  await readFile(new URL('./landing-api-data.json', import.meta.url), 'utf8'),
);
let state = {};
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const send = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  if (url.pathname === '/__test/state' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const patch = JSON.parse(body || '{}');
    state = patch.reset ? { ...patch } : { ...state, ...patch };
    return send(200, { ok: true });
  }
  if (url.pathname === '/api/auth/me') return send(401, { detail: 'Anonymous fixture visitor' });
  if (url.pathname === '/health') return send(200, { status: 'ok' });
  if (req.method !== 'GET') return send(405, { detail: 'Fixture server: no real writes' });
  const key =
    url.pathname === '/api/kiosk-packages'
      ? 'packages'
      : url.pathname === '/api/kiosk-locations'
        ? 'locations'
        : url.pathname === '/api/shop/catalog'
          ? 'catalog'
          : null;
  if (!key) return send(200, []);
  if (state[key + 'Delay'])
    await new Promise((resolve) => setTimeout(resolve, state[key + 'Delay']));
  const mode = state[key] || 'success';
  if (mode === 'error') return send(503, { detail: 'Fixture unavailable' });
  if (key === 'catalog') {
    const page = Number(url.searchParams.get('page') || '1');
    return send(200, {
      items: mode === 'empty' ? [] : page === 1 ? data.catalog.slice(0, 3) : data.catalog.slice(3),
      page,
      hasMore: mode === 'empty' ? false : page === 1,
    });
  }
  return send(200, mode === 'empty' ? [] : data[key]);
});
server.listen(Number(process.env.LANDING_FIXTURE_PORT || 9473), '127.0.0.1');

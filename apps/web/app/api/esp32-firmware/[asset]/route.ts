import { readFile } from 'node:fs/promises';
import path from 'node:path';

const assets = new Set([
  'manifest.json',
  'bootloader.bin',
  'partitions.bin',
  'boot_app0.bin',
  'firmware.bin',
]);

export async function GET(request: Request, context: { params: Promise<{ asset: string }> }) {
  const { asset } = await context.params;
  if (!assets.has(asset)) return new Response(null, { status: 404 });

  const release = process.env.FLORABOT_FIRMWARE_RELEASE_URL;
  const token = process.env.FLORABOT_FIRMWARE_TOKEN;
  if (!release && !token) {
    try {
      const data = await readFile(path.join(process.cwd(), 'firmware/esp32-20261127', asset));
      return new Response(new Uint8Array(data), {
        headers: {
          'Content-Type':
            asset === 'manifest.json' ? 'application/json' : 'application/octet-stream',
          'Content-Length': String(data.length),
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch {
      return new Response(null, { status: 502 });
    }
  }
  if (!release || !token) return new Response(null, { status: 503 });

  try {
    const source = new URL(release);
    const local = ['127.0.0.1', 'localhost', '[::1]'].includes(source.hostname);
    if (source.protocol !== 'https:' && !(local && source.protocol === 'http:')) {
      return new Response(null, { status: 503 });
    }
    source.pathname = source.pathname.replace(/\/$/, '') + '/' + asset;
    const upstream = await fetch(source, {
      headers: { Authorization: 'Bearer ' + token },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]),
    });
    const bytes = Number(upstream.headers.get('Content-Length'));
    const limit = asset === 'manifest.json' ? 16 * 1024 : 3 * 1024 * 1024;
    if (!upstream.ok || !upstream.body || !Number.isInteger(bytes) || bytes < 1 || bytes > limit) {
      await upstream.body?.cancel();
      return new Response(null, { status: 502 });
    }
    return new Response(upstream.body, {
      headers: {
        'Content-Type': asset === 'manifest.json' ? 'application/json' : 'application/octet-stream',
        'Content-Length': String(bytes),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}

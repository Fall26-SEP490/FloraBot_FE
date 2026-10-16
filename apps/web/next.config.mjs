const apiOrigin = process.env.API_PROXY_TARGET || 'http://127.0.0.1:5080';
const kioskOrigin = process.env.KIOSK_PROXY_TARGET || 'http://127.0.0.1:5174';

export default {
  transpilePackages: ['@florabot/ui', '@florabot/contracts'],
  images: { disableStaticImages: true },
  async headers() {
    return [
      {
        source: '/dang-nhap',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer-when-downgrade' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
        ],
      },
      {
        source: '/dang-ky',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer-when-downgrade' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      { source: '/kiosk', destination: `${kioskOrigin}/kiosk/index.html` },
      { source: '/kiosk/:path*', destination: `${kioskOrigin}/kiosk/:path*` },
      ...['/api/:path*', '/hub/:path*', '/openapi/:path*'].map((source) => ({
        source,
        destination: `${apiOrigin}${source}`,
      })),
    ];
  },
  webpack(config) {
    config.module.rules.push({ test: /\.(webp|avif|png|jpg|svg)$/i, type: 'asset/resource' });
    return config;
  },
};

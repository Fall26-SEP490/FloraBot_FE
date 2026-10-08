const apiOrigin = process.env.API_PROXY_TARGET || 'http://127.0.0.1:8088';

export default {
  transpilePackages: ['@florabot/ui', '@florabot/contracts'],
  images: { disableStaticImages: true },
  async rewrites() {
    return ['/api/:path*', '/hub/:path*', '/openapi/:path*'].map((source) => ({
      source,
      destination: `${apiOrigin}${source}`,
    }));
  },
  webpack(config) {
    config.module.rules.push({ test: /\.(webp|avif|png|jpg|svg)$/i, type: 'asset/resource' });
    return config;
  },
};

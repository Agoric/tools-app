/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  experimental: {
    after: true,
  },
  webpack: (config) => ({
    ...config,
    module: {
      ...config.module,
      rules: [
        ...(config.module.rules || []),
        {
          test: /\.svg$/i,
          use: ['@svgr/webpack'],
        },
      ],
    },
  }),
};

export default nextConfig;

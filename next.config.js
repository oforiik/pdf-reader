/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      process: false,
    };
    return config;
  },
  async rewrites() {
    return [];
  },
  env: {
    PORT: 3000,
  },
}

module.exports = nextConfig

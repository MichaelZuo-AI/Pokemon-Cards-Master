/** @type {import('next').NextConfig} */
const basePath = '/Pokemon/cardsmaster';
const nextConfig = {
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_BUILD_ID: new Date().toISOString().slice(0, 19).replace(/\D/g, ''),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
};

module.exports = nextConfig;

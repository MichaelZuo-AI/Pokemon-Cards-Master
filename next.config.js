/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/Pokemon/cardsmaster',
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

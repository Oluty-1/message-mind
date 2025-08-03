/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
      appDir: true,
    },
    // Allow connections to your Matrix server
    async rewrites() {
      return [
        {
          source: '/api/:path*',
          destination: 'https://messagemind.duckdns.org/:path*',
        },
      ]
    },
  }
  
  module.exports = nextConfig
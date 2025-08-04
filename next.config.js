/** @type {import('next').NextConfig} */
const nextConfig = {
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
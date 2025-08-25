/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode:true,
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
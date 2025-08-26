/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode:true,
  env: {
    NEXT_PUBLIC_GEMINI_API_KEY: process.env.NEXT_PUBLIC_GEMINI_API_KEY,
    HF_API_KEY: process.env.HF_API_KEY,
    NEXT_PUBLIC_HF_API_KEY: process.env.NEXT_PUBLIC_HF_API_KEY,
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
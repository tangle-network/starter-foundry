// next.config.js — agent-marketplace-ui-ts
//
// transpilePackages is required so Next can consume the ESM-only
// @tangle-network/sandbox-ui package from node_modules without
// the App Router complaining about untranspiled package exports.

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@tangle-network/sandbox-ui'],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

module.exports = nextConfig

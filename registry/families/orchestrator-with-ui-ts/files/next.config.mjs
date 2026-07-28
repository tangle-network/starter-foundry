// next.config.mjs — orchestrator-with-ui-ts
//
// transpilePackages is required so Next can consume the ESM-only
// @tangle-network/sandbox-ui + sandbox packages from node_modules without
// the App Router complaining about untranspiled package exports.

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@tangle-network/sandbox-ui',
    '@tangle-network/sandbox',
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

export default nextConfig

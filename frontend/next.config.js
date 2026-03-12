/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverRuntimeConfig: {
    host: process.env.NEXT_HOST || "0.0.0.0",
    port: Number(process.env.NEXT_PORT || 3000)
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "/api/proxy/:path*"
      }
    ];
  }
};

module.exports = nextConfig;

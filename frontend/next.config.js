/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  standalone: {
    host: process.env.NEXT_HOST || "0.0.0.0",
    port: Number(process.env.NEXT_PORT || 3000)
  }
};

module.exports = nextConfig;

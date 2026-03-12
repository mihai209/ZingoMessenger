const path = require("path");
const nextConfig = require("../next.config.js");

const host = nextConfig?.serverRuntimeConfig?.host || "0.0.0.0";
const port = nextConfig?.serverRuntimeConfig?.port || 3000;

if (!process.env.HOSTNAME) {
  process.env.HOSTNAME = host;
}
if (!process.env.PORT) {
  process.env.PORT = String(port);
}

require(path.join(__dirname, "..", ".next", "standalone", "server.js"));

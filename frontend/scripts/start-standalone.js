const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const nextConfig = require("../next.config.js");

const envLocal = path.join(__dirname, "..", ".env.local");
const envFile = path.join(__dirname, "..", ".env");
if (fs.existsSync(envLocal)) dotenv.config({ path: envLocal });
if (fs.existsSync(envFile)) dotenv.config({ path: envFile });

const host = nextConfig?.serverRuntimeConfig?.host || "0.0.0.0";
const port = nextConfig?.serverRuntimeConfig?.port || 3000;

if (!process.env.HOSTNAME) {
  process.env.HOSTNAME = host;
}
if (!process.env.PORT) {
  process.env.PORT = String(port);
}

require(path.join(__dirname, "..", ".next", "standalone", "server.js"));

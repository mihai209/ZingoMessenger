const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const dotenv = require("dotenv");

const envLocal = path.join(__dirname, "..", ".env.local");
const envFile = path.join(__dirname, "..", ".env");
if (fs.existsSync(envLocal)) dotenv.config({ path: envLocal });
if (fs.existsSync(envFile)) dotenv.config({ path: envFile });

function startCloudflared() {
  const enabled = String(process.env.CLOUDFLARED || "").toLowerCase() === "true";
  const token = process.env.CLOUDFLARED_TOKEN;
  if (!enabled) return null;
  if (!token) {
    console.warn("CLOUDFLARED is TRUE but CLOUDFLARED_TOKEN is missing.");
    return null;
  }
  const binary = path.join(__dirname, "..", "network", "cloudflared");
  const child = spawn(binary, ["tunnel", "--no-autoupdate", "run", "--token", token], {
    stdio: "inherit"
  });
  return child;
}

const tunnel = startCloudflared();
const shutdown = () => {
  if (tunnel) {
    tunnel.kill("SIGTERM");
  }
};
process.on("exit", shutdown);
process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});
process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});

require(path.join(__dirname, "start-standalone.js"));

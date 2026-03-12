const path = require("path");
const { spawn } = require("child_process");

require("dotenv").config({
  path: process.env.ENV_FILE || path.join(__dirname, "..", ".env")
});

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

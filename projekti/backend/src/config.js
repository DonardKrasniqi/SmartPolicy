const path = require("path");
const os = require("os");

const defaultTokenSecret = "school-project-dev-secret-change-me";

function resolveDbFile() {
  if (process.env.VERCEL) {
    return path.join(os.tmpdir(), "smartpolicy.db");
  }
  return path.join(__dirname, "..", "data", "smartpolicy.db");
}

module.exports = {
  port: Number(process.env.PORT || 3000),
  /** Local SQLite file; on Vercel, stored under OS temp (ephemeral, resets between cold starts). */
  dbFile: resolveDbFile(),
  frontendRoot: path.join(__dirname, "..", "..", "frontend"),
  tokenSecret: process.env.TOKEN_SECRET || defaultTokenSecret,
  tokenTtlSeconds: Number(process.env.TOKEN_TTL_SECONDS || 60 * 60 * 8),
  appName: process.env.APP_NAME || "Edu-GRC Smart Policy Portal",
  /** When true (default), `/api/auth/demo-login` is enabled for local demos. Set `DEMO_MODE=0` to disable. */
  demoMode: process.env.DEMO_MODE !== "0",
  isDefaultTokenSecret: !process.env.TOKEN_SECRET || process.env.TOKEN_SECRET === defaultTokenSecret,
};

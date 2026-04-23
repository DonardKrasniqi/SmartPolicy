"use strict";

const { readStore } = require("../backend/src/store");
readStore();
const { handleApiRequest } = require("../backend/src/routes/api");

/**
 * Vercel catch-all for all paths under /api (required segment).
 * Use /api/[[...path]].js (optional) for edge cases — plain Node projects
 * should use a single required catch-all so routes like /api/auth/login resolve.
 * https://vercel.com/docs/functions/runtimes/node-js#dynamic-path-segments
 */
function ensureApiUrl(req) {
  const raw = String(req.url || "/");
  const pathname = raw.split("?")[0] || "/";
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return;
  }
  const q = req.query || {};
  const pathSeg = q.path;
  if (pathSeg === undefined) {
    return;
  }
  const joined = (Array.isArray(pathSeg) ? pathSeg : [pathSeg]).filter(Boolean).join("/");
  const search = raw.includes("?") ? raw.slice(raw.indexOf("?")) : "";
  if (joined) {
    Object.defineProperty(req, "url", { value: `/api/${joined}${search}`, writable: true, configurable: true });
  } else {
    Object.defineProperty(req, "url", { value: `/api${search}`, writable: true, configurable: true });
  }
}

module.exports = (req, res) => {
  ensureApiUrl(req);
  return handleApiRequest(req, res);
};

"use strict";

/**
 * Vercel: one Serverless Function for all /api/* routes.
 * File-system catch-alls (e.g. api/[...path].js) are unreliable for non-Next.js
 * projects. Express is the pattern Vercel documents for a single /api app.
 * Rewrites: https://vercel.com/docs/edge-network/rewrites
 */
const express = require("express");
const { readStore } = require("../backend/src/store");
readStore();
const { handleApiRequest } = require("../backend/src/routes/api");

const app = express();
// No body parser — readBody() consumes the raw stream (same as local server).

/**
 * Vercel only invokes `api/index.js` for `/api` and `/api/`, not nested `/api/...` paths.
 * `vercel.json` rewrites `/api/:path*` → `/api` and appends the splat to the query string.
 * We rebuild a single path string so `handleApiRequest` can route on `/api/...` like `server.js`.
 */
function resolveClientUrlForApi(req) {
  const raw = String(req.originalUrl || req.url || "/").split("#")[0];
  const u = new URL(raw, "http://127.0.0.1");
  if (u.pathname.length > 4 && u.pathname.startsWith("/api/") && u.pathname !== "/api/index.js") {
    return raw;
  }
  const p = u.searchParams.get("path");
  if (p != null && p !== "") {
    u.searchParams.delete("path");
    let tail;
    try {
      tail = decodeURIComponent(p).replace(/^\//, "");
    } catch {
      tail = p.replace(/^\//, "");
    }
    const base = "/api/" + tail;
    const rest = u.searchParams.toString();
    return rest ? `${base}?${rest}` : base;
  }
  return raw;
}

app.use((req, res) => {
  const url = resolveClientUrlForApi(req);
  Object.defineProperty(req, "url", { value: url, configurable: true, writable: true });
  Object.defineProperty(req, "originalUrl", { value: url, configurable: true, writable: true });
  return handleApiRequest(req, res);
});

module.exports = app;

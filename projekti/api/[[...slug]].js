"use strict";

const { readStore } = require("../backend/src/store");
readStore();
const { handleApiRequest } = require("../backend/src/routes/api");

/**
 * Vercel serverless entry for all /api/* routes.
 * The Node http handler is compatible with Vercel's request/response objects.
 */
function ensureUrl(req) {
  if (req.url && String(req.url).startsWith("/api")) {
    return;
  }
  const q = req.query || {};
  const slug = q.slug;
  if (slug === undefined) {
    return;
  }
  const pathPart = (Array.isArray(slug) ? slug : [slug]).filter(Boolean).join("/");
  const u = String(req.url || "/");
  const search = u.includes("?") ? u.slice(u.indexOf("?")) : "";
  const next = pathPart ? `/api/${pathPart}${search}` : `/api${search}`;
  Object.defineProperty(req, "url", { value: next, writable: true, configurable: true });
}

module.exports = (req, res) => {
  ensureUrl(req);
  return handleApiRequest(req, res);
};

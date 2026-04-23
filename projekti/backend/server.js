const fs = require("fs");
const path = require("path");
const http = require("http");
const { port, frontendRoot, appName, isDefaultTokenSecret } = require("./src/config");
const { handleApiRequest } = require("./src/routes/api");
const { text } = require("./src/utils/http");
const { readStore } = require("./src/store");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

function serveStatic(req, res) {
  const requestUrl = new URL(req.url, "http://localhost");
  let relativePath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  relativePath = relativePath.replace(/^\/+/, "");

  const absolutePath = path.normalize(path.join(frontendRoot, relativePath));
  if (!absolutePath.startsWith(frontendRoot)) {
    return text(res, 403, "Forbidden");
  }

  if (!fs.existsSync(absolutePath) || fs.statSync(absolutePath).isDirectory()) {
    return text(res, 404, "Not found");
  }

  const extension = path.extname(absolutePath).toLowerCase();
  res.writeHead(200, { "Content-Type": mimeTypes[extension] || "application/octet-stream" });
  fs.createReadStream(absolutePath).pipe(res);
}

readStore();

http
  .createServer((req, res) => {
    if ((req.url || "").startsWith("/api/")) {
      return handleApiRequest(req, res);
    }

    return serveStatic(req, res);
  })
  .listen(port, () => {
    console.log(`${appName} is running at http://localhost:${port}`);
    if (isDefaultTokenSecret) {
      console.warn("[SmartPolicy] Using default TOKEN_SECRET. Set TOKEN_SECRET in the environment for untrusted networks.");
    }
  });

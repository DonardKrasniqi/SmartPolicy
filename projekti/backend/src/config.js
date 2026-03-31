const path = require("path");

module.exports = {
  port: Number(process.env.PORT || 3000),
  dataFile: path.join(__dirname, "..", "data", "store.json"),
  frontendRoot: path.join(__dirname, "..", "..", "frontend"),
  tokenSecret: process.env.TOKEN_SECRET || "school-project-dev-secret-change-me",
  tokenTtlSeconds: Number(process.env.TOKEN_TTL_SECONDS || 60 * 60 * 8),
  appName: process.env.APP_NAME || "Edu-GRC Smart Policy Portal",
};

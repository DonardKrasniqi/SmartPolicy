const path = require("path");

module.exports = {
  port: Number(process.env.PORT || 3000),
  dataFile: path.join(__dirname, "..", "data", "store.json"),
  frontendRoot: path.join(__dirname, "..", "..", "frontend"),
  tokenSecret: "smartpolicy-portal-secret-2026",
  appName: "Edu-GRC Smart Policy Portal",
};

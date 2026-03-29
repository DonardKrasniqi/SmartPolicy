const { generateId } = require("../utils/ids");
const { updateStore } = require("../store");

function recordAudit({
  user,
  action,
  entity,
  entityId = null,
  ipAddress = "127.0.0.1",
  userAgent = "",
  metadata = {},
}) {
  const entry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    userId: user ? user.id : null,
    userName: user ? user.name : "Anonymous",
    userRole: user ? user.role : "guest",
    action,
    entity,
    entityId,
    ipAddress,
    userAgent,
    metadata,
  };

  updateStore((state) => {
    state.auditLogs.push(entry);
    return state;
  });

  return entry;
}

module.exports = {
  recordAudit,
};

const fs = require("fs");
const path = require("path");
const { dataFile } = require("./config");
const { generateId } = require("./utils/ids");
const { hashPassword } = require("./utils/security");

function buildRoles() {
  return [
    { id: "admin", name: "Administrator", permissions: ["all"] },
    { id: "manager", name: "Manager", permissions: ["view_policies", "approve_policies"] },
    { id: "staff", name: "Staff", permissions: ["view_policies", "sign_policies"] },
    { id: "student", name: "Student", permissions: ["view_policies", "sign_policies"] },
    { id: "auditor", name: "Auditor", permissions: ["view_audit", "export_logs"] },
  ];
}

function seedUsers(now) {
  return [
    {
      id: generateId(),
      name: "Dr. Sarah Johnson",
      email: "admin@school.edu",
      role: "admin",
      passwordHash: hashPassword("admin123"),
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateId(),
      name: "Olivia Bennett",
      email: "manager@school.edu",
      role: "manager",
      passwordHash: hashPassword("manager123"),
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateId(),
      name: "Mr. Robert Smith",
      email: "staff@school.edu",
      role: "staff",
      passwordHash: hashPassword("staff123"),
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateId(),
      name: "Emily Davis",
      email: "student@school.edu",
      role: "student",
      passwordHash: hashPassword("student123"),
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateId(),
      name: "James Wilson",
      email: "auditor@school.edu",
      role: "auditor",
      passwordHash: hashPassword("auditor123"),
      active: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function seedPolicies(users, now) {
  const admin = users.find((user) => user.role === "admin");

  return [
    {
      id: generateId(),
      title: "Student Code of Conduct",
      description: "Defines behavior, responsibilities, and reporting expectations for all enrolled students.",
      content:
        "<h2>Purpose</h2><p>This policy sets the standards for respectful, safe, and ethical conduct across all school activities.</p><h2>Expectations</h2><ul><li>Treat peers and staff with respect.</li><li>Follow classroom and campus safety procedures.</li><li>Report concerns promptly through the official channels.</li></ul><h2>Consequences</h2><p>Violations may result in corrective action, parent notification, or disciplinary review.</p>",
      status: "published",
      version: "1.0",
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
      approvedAt: now,
      approvedBy: admin ? admin.id : null,
      createdBy: admin ? admin.id : null,
    },
    {
      id: generateId(),
      title: "Data Privacy and Device Usage",
      description: "Draft guidance for handling institutional data and using school-managed devices responsibly.",
      content:
        "<h2>Scope</h2><p>This draft applies to staff and students using institutional systems.</p><h2>Draft Controls</h2><ol><li>Use strong passwords.</li><li>Do not share confidential student information through unsecured channels.</li><li>Lock shared devices when unattended.</li></ol>",
      status: "draft",
      version: "0.1",
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
      approvedAt: null,
      approvedBy: null,
      createdBy: admin ? admin.id : null,
    },
  ];
}

function createInitialState() {
  const now = new Date().toISOString();
  const users = seedUsers(now);

  return {
    config: {
      institutionName: "Springfield Academy",
      portalTitle: "Smart Policy & Compliance Portal",
    },
    roles: buildRoles(),
    users,
    policies: seedPolicies(users, now),
    policyVersions: [],
    acknowledgements: [],
    auditLogs: [],
  };
}

function normalizePolicyVersions(state) {
  if (!Array.isArray(state.policyVersions)) {
    state.policyVersions = [];
  }

  state.policyVersions = state.policyVersions.map((version) => ({
    id: version.id || generateId(),
    policyId: version.policyId,
    version: String(version.version || "1.0"),
    title: String(version.title || ""),
    description: String(version.description || ""),
    content: String(version.content || ""),
    archivedAt: version.archivedAt || new Date().toISOString(),
    archivedBy: version.archivedBy || null,
    changeType: ["minor", "major"].includes(version.changeType) ? version.changeType : "minor",
    changeSummary: String(version.changeSummary || ""),
  }));
}

function normalizeAcknowledgements(state) {
  if (!Array.isArray(state.acknowledgements)) {
    state.acknowledgements = [];
  }

  state.acknowledgements = state.acknowledgements.map((ack) => {
    const policy = state.policies.find((item) => item.id === ack.policyId);
    return {
      id: ack.id || generateId(),
      policyId: ack.policyId,
      policyTitle: String(ack.policyTitle || policy?.title || ""),
      policyVersion: String(ack.policyVersion || policy?.version || "1.0"),
      userId: ack.userId,
      userName: String(ack.userName || ""),
      userEmail: String(ack.userEmail || ""),
      ipAddress: String(ack.ipAddress || "127.0.0.1"),
      userAgent: String(ack.userAgent || ""),
      signedAt: ack.signedAt || new Date().toISOString(),
      evidence: {
        recordedAt: ack.evidence?.recordedAt || ack.signedAt || new Date().toISOString(),
        source: ack.evidence?.source || "portal-ui",
        policySnapshotVersion: String(ack.evidence?.policySnapshotVersion || ack.policyVersion || policy?.version || "1.0"),
      },
      auditLogId: ack.auditLogId || null,
    };
  });
}

function normalizeAuditLogs(state) {
  if (!Array.isArray(state.auditLogs)) {
    state.auditLogs = [];
  }

  state.auditLogs = state.auditLogs.map((log) => ({
    id: log.id || generateId(),
    timestamp: log.timestamp || new Date().toISOString(),
    userId: log.userId || null,
    userName: String(log.userName || "Anonymous"),
    userRole: String(log.userRole || "guest"),
    action: String(log.action || "UNKNOWN"),
    entity: String(log.entity || "unknown"),
    entityId: log.entityId || null,
    ipAddress: String(log.ipAddress || "127.0.0.1"),
    userAgent: String(log.userAgent || ""),
    metadata: log.metadata && typeof log.metadata === "object" ? log.metadata : {},
  }));
}

function normalizePolicies(state) {
  if (!Array.isArray(state.policies)) {
    state.policies = [];
  }

  state.policies = state.policies.map((policy) => ({
    ...policy,
    description: String(policy.description || ""),
    version: String(policy.version || "1.0"),
    createdAt: policy.createdAt || new Date().toISOString(),
    updatedAt: policy.updatedAt || new Date().toISOString(),
    publishedAt: policy.publishedAt || null,
    approvedAt: policy.approvedAt || null,
    approvedBy: policy.approvedBy || null,
    createdBy: policy.createdBy || null,
  }));
}

function normalizeStoreShape(state) {
  if (!state.config || typeof state.config !== "object") {
    state.config = createInitialState().config;
  }

  if (!Array.isArray(state.roles) || !state.roles.length) {
    state.roles = buildRoles();
  }

  if (!Array.isArray(state.users)) {
    state.users = [];
  }

  normalizePolicies(state);
  normalizePolicyVersions(state);
  normalizeAcknowledgements(state);
  normalizeAuditLogs(state);

  return state;
}

function ensureStoreFile() {
  const dir = path.dirname(dataFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify(createInitialState(), null, 2), "utf8");
    return;
  }

  try {
    const existing = normalizeStoreShape(JSON.parse(fs.readFileSync(dataFile, "utf8")));
    const needsReset =
      !Array.isArray(existing.users) ||
      existing.users.length === 0 ||
      !existing.users.some((user) => user.role === "manager") ||
      existing.users.some((user) => typeof user.passwordHash !== "string" || !user.passwordHash.includes(":"));

    if (needsReset) {
      fs.writeFileSync(dataFile, JSON.stringify(createInitialState(), null, 2), "utf8");
      return;
    }

    fs.writeFileSync(dataFile, JSON.stringify(existing, null, 2), "utf8");
  } catch {
    fs.writeFileSync(dataFile, JSON.stringify(createInitialState(), null, 2), "utf8");
  }
}

function readStore() {
  ensureStoreFile();
  return normalizeStoreShape(JSON.parse(fs.readFileSync(dataFile, "utf8")));
}

function writeStore(state) {
  ensureStoreFile();
  fs.writeFileSync(dataFile, JSON.stringify(normalizeStoreShape(state), null, 2), "utf8");
}

function updateStore(updater) {
  const state = readStore();
  const nextState = updater(state) || state;
  writeStore(nextState);
  return nextState;
}

function publicUser(user) {
  if (!user) {
    return null;
  }

  const { passwordHash, ...rest } = user;
  return rest;
}

module.exports = {
  readStore,
  writeStore,
  updateStore,
  publicUser,
};

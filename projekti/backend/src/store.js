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
    const existing = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    const needsReset =
      !Array.isArray(existing.users) ||
      existing.users.length === 0 ||
      !existing.users.some((user) => user.role === "manager") ||
      existing.users.some((user) => typeof user.passwordHash !== "string" || !user.passwordHash.includes(":"));

    if (needsReset) {
      fs.writeFileSync(dataFile, JSON.stringify(createInitialState(), null, 2), "utf8");
    }
  } catch {
    fs.writeFileSync(dataFile, JSON.stringify(createInitialState(), null, 2), "utf8");
  }
}

function readStore() {
  ensureStoreFile();
  return JSON.parse(fs.readFileSync(dataFile, "utf8"));
}

function writeStore(state) {
  ensureStoreFile();
  fs.writeFileSync(dataFile, JSON.stringify(state, null, 2), "utf8");
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

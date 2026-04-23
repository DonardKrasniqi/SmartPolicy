const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { dbFile } = require("./config");
const { generateId } = require("./utils/ids");

let dbInstance = null;

function getDb() {
  if (!dbInstance) {
    const dir = path.dirname(dbFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    dbInstance = new DatabaseSync(dbFile, { enableForeignKeyConstraints: true });
    try {
      dbInstance.exec("PRAGMA journal_mode = WAL;");
    } catch {
      /* ignore */
    }
    migrate(dbInstance);
    seedIfEmpty(dbInstance);
  }
  return dbInstance;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      permissions_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      password TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS policies (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL,
      version TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      published_at TEXT,
      approved_at TEXT,
      approved_by TEXT,
      created_by TEXT
    );
    CREATE TABLE IF NOT EXISTS policy_versions (
      id TEXT PRIMARY KEY NOT NULL,
      policy_id TEXT NOT NULL,
      version TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      content TEXT NOT NULL,
      archived_at TEXT NOT NULL,
      archived_by TEXT,
      change_type TEXT NOT NULL,
      change_summary TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS acknowledgements (
      id TEXT PRIMARY KEY NOT NULL,
      policy_id TEXT NOT NULL,
      policy_title TEXT NOT NULL,
      policy_version TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_email TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      user_agent TEXT NOT NULL,
      signed_at TEXT NOT NULL,
      evidence_json TEXT NOT NULL,
      audit_log_id TEXT
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY NOT NULL,
      timestamp TEXT NOT NULL,
      user_id TEXT,
      user_name TEXT NOT NULL,
      user_role TEXT NOT NULL,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      ip_address TEXT NOT NULL,
      user_agent TEXT NOT NULL,
      metadata_json TEXT NOT NULL
    );
  `);
}

function buildRoles() {
  return [
    { id: "admin", name: "Administrator", permissions: ["all"] },
    { id: "manager", name: "Manager", permissions: ["view_policies", "approve_policies"] },
    { id: "staff", name: "Staff", permissions: ["view_policies", "sign_policies"] },
    { id: "student", name: "Student", permissions: ["view_policies", "sign_policies"] },
    { id: "auditor", name: "Auditor", permissions: ["view_audit", "export_logs"] },
  ];
}

function seedUsersPlain(now) {
  return [
    { name: "Dr. Sarah Johnson", email: "admin@school.edu", role: "admin", password: "admin123" },
    { name: "Olivia Bennett", email: "manager@school.edu", role: "manager", password: "manager123" },
    { name: "Mr. Robert Smith", email: "staff@school.edu", role: "staff", password: "staff123" },
    { name: "Emily Davis", email: "student@school.edu", role: "student", password: "student123" },
    { name: "James Wilson", email: "auditor@school.edu", role: "auditor", password: "auditor123" },
  ].map((u) => ({
    id: generateId(),
    ...u,
    active: true,
    createdAt: now,
    updatedAt: now,
  }));
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
  const users = seedUsersPlain(now);

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

function rowToUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    password: row.password,
    active: row.active !== 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function readStoreFromDb(db) {
  const configRows = db.prepare("SELECT key, value FROM app_config").all();
  const config = {};
  for (const row of configRows) {
    config[row.key] = row.value;
  }

  const roles = db
    .prepare("SELECT id, name, permissions_json AS permissionsJson FROM roles")
    .all()
    .map((r) => ({
      id: r.id,
      name: r.name,
      permissions: JSON.parse(r.permissionsJson),
    }));

  const users = db.prepare("SELECT * FROM users").all().map(rowToUser);

  const policies = db
    .prepare("SELECT * FROM policies")
    .all()
    .map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      content: row.content,
      status: row.status,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      publishedAt: row.published_at,
      approvedAt: row.approved_at,
      approvedBy: row.approved_by,
      createdBy: row.created_by,
    }));

  const policyVersions = db
    .prepare("SELECT * FROM policy_versions")
    .all()
    .map((row) => ({
      id: row.id,
      policyId: row.policy_id,
      version: row.version,
      title: row.title,
      description: row.description,
      content: row.content,
      archivedAt: row.archived_at,
      archivedBy: row.archived_by,
      changeType: row.change_type,
      changeSummary: row.change_summary,
    }));

  const acknowledgements = db
    .prepare("SELECT * FROM acknowledgements")
    .all()
    .map((row) => ({
      id: row.id,
      policyId: row.policy_id,
      policyTitle: row.policy_title,
      policyVersion: row.policy_version,
      userId: row.user_id,
      userName: row.user_name,
      userEmail: row.user_email,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      signedAt: row.signed_at,
      evidence: JSON.parse(row.evidence_json),
      auditLogId: row.audit_log_id,
    }));

  const auditLogs = db
    .prepare("SELECT * FROM audit_logs")
    .all()
    .map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      userId: row.user_id,
      userName: row.user_name,
      userRole: row.user_role,
      action: row.action,
      entity: row.entity,
      entityId: row.entity_id,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      metadata: JSON.parse(row.metadata_json),
    }));

  return normalizeStoreShape({
    config,
    roles,
    users,
    policies,
    policyVersions,
    acknowledgements,
    auditLogs,
  });
}

function writeStateToDb(db, state) {
  const normalized = normalizeStoreShape(JSON.parse(JSON.stringify(state)));

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM acknowledgements").run();
    db.prepare("DELETE FROM policy_versions").run();
    db.prepare("DELETE FROM policies").run();
    db.prepare("DELETE FROM audit_logs").run();
    db.prepare("DELETE FROM users").run();
    db.prepare("DELETE FROM roles").run();
    db.prepare("DELETE FROM app_config").run();

    const insConfig = db.prepare("INSERT INTO app_config (key, value) VALUES (?, ?)");
    insConfig.run("institutionName", normalized.config.institutionName || "");
    insConfig.run("portalTitle", normalized.config.portalTitle || "");

    const insRole = db.prepare("INSERT INTO roles (id, name, permissions_json) VALUES (?, ?, ?)");
    for (const role of normalized.roles) {
      insRole.run(role.id, role.name, JSON.stringify(role.permissions || []));
    }

    const insUser = db.prepare(
      `INSERT INTO users (id, name, email, role, password, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const u of normalized.users) {
      insUser.run(u.id, u.name, u.email, u.role, u.password, u.active === false ? 0 : 1, u.createdAt, u.updatedAt);
    }

    const insPol = db.prepare(
      `INSERT INTO policies (id, title, description, content, status, version, created_at, updated_at, published_at, approved_at, approved_by, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const p of normalized.policies) {
      insPol.run(
        p.id,
        p.title,
        p.description,
        p.content,
        p.status,
        p.version,
        p.createdAt,
        p.updatedAt,
        p.publishedAt,
        p.approvedAt,
        p.approvedBy,
        p.createdBy
      );
    }

    const insVer = db.prepare(
      `INSERT INTO policy_versions (id, policy_id, version, title, description, content, archived_at, archived_by, change_type, change_summary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const v of normalized.policyVersions) {
      insVer.run(
        v.id,
        v.policyId,
        v.version,
        v.title,
        v.description,
        v.content,
        v.archivedAt,
        v.archivedBy,
        v.changeType,
        v.changeSummary
      );
    }

    const insAck = db.prepare(
      `INSERT INTO acknowledgements (id, policy_id, policy_title, policy_version, user_id, user_name, user_email, ip_address, user_agent, signed_at, evidence_json, audit_log_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const a of normalized.acknowledgements) {
      insAck.run(
        a.id,
        a.policyId,
        a.policyTitle,
        a.policyVersion,
        a.userId,
        a.userName,
        a.userEmail,
        a.ipAddress,
        a.userAgent,
        a.signedAt,
        JSON.stringify(a.evidence || {}),
        a.auditLogId
      );
    }

    const insAudit = db.prepare(
      `INSERT INTO audit_logs (id, timestamp, user_id, user_name, user_role, action, entity, entity_id, ip_address, user_agent, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const log of normalized.auditLogs) {
      insAudit.run(
        log.id,
        log.timestamp,
        log.userId,
        log.userName,
        log.userRole,
        log.action,
        log.entity,
        log.entityId,
        log.ipAddress,
        log.userAgent,
        JSON.stringify(log.metadata || {})
      );
    }

    db.exec("COMMIT");
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw err;
  }
}

function seedIfEmpty(db) {
  const row = db.prepare("SELECT COUNT(*) AS c FROM users").get();
  if (row.c > 0) {
    return;
  }

  const state = createInitialState();
  writeStateToDb(db, state);
}

function readStore() {
  const db = getDb();
  return readStoreFromDb(db);
}

function writeStore(state) {
  const db = getDb();
  writeStateToDb(db, state);
}

function updateStore(updater) {
  const db = getDb();
  const state = readStoreFromDb(db);
  const nextState = updater(state) || state;
  writeStateToDb(db, nextState);
  return nextState;
}

/**
 * Append a single audit row without rewriting the full database.
 * Must stay consistent with writeStateToDb audit row shape.
 */
function insertAuditLog(entry) {
  const db = getDb();
  const log = {
    id: entry.id || generateId(),
    timestamp: entry.timestamp || new Date().toISOString(),
    userId: entry.userId ?? null,
    userName: String(entry.userName || "Anonymous"),
    userRole: String(entry.userRole || "guest"),
    action: String(entry.action || "UNKNOWN"),
    entity: String(entry.entity || "unknown"),
    entityId: entry.entityId ?? null,
    ipAddress: String(entry.ipAddress || "127.0.0.1"),
    userAgent: String(entry.userAgent || ""),
    metadata: entry.metadata && typeof entry.metadata === "object" ? entry.metadata : {},
  };

  db.prepare(
    `INSERT INTO audit_logs (id, timestamp, user_id, user_name, user_role, action, entity, entity_id, ip_address, user_agent, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    log.id,
    log.timestamp,
    log.userId,
    log.userName,
    log.userRole,
    log.action,
    log.entity,
    log.entityId,
    log.ipAddress,
    log.userAgent,
    JSON.stringify(log.metadata)
  );

  return {
    id: log.id,
    timestamp: log.timestamp,
    userId: log.userId,
    userName: log.userName,
    userRole: log.userRole,
    action: log.action,
    entity: log.entity,
    entityId: log.entityId,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    metadata: log.metadata,
  };
}

function publicUser(user) {
  if (!user) {
    return null;
  }

  const { password, ...rest } = user;
  return rest;
}

module.exports = {
  readStore,
  writeStore,
  updateStore,
  publicUser,
  insertAuditLog,
};

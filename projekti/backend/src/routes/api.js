const { tokenSecret, tokenTtlSeconds } = require("../config");
const { readStore, updateStore, publicUser } = require("../store");
const { verifyPassword, signToken, verifyToken, hashPassword } = require("../utils/security");
const { generateId } = require("../utils/ids");
const { readBody, json, text, getTokenFromRequest, getClientIp } = require("../utils/http");
const { recordAudit } = require("../services/auditService");
const {
  validateLoginPayload,
  validatePolicyPayload,
  validateRegisterPayload,
  validateRolePayload,
  normalizeString,
} = require("../utils/validation");

function hasPermission(user, permission, roles) {
  if (!user) return false;
  if (user.role === "admin") return true;
  const role = roles.find((item) => item.id === user.role);
  return Boolean(role && (role.permissions.includes("all") || role.permissions.includes(permission)));
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function requireAuthenticatedUser(req) {
  const token = getTokenFromRequest(req);
  const payload = verifyToken(token, tokenSecret);
  if (!payload) {
    throw createHttpError(401, "Authentication required or session expired.");
  }

  const state = readStore();
  const user = state.users.find((item) => item.id === payload.userId && item.active !== false);
  if (!user) {
    throw createHttpError(401, "Authentication required or session expired.");
  }

  return user;
}

function requireRole(user, allowedRoles, message = "You do not have access to this resource.") {
  if (!allowedRoles.includes(user.role)) {
    throw createHttpError(403, message);
  }
}

function requirePermission(user, permission, roles, message = "You do not have access to this resource.") {
  if (!hasPermission(user, permission, roles)) {
    throw createHttpError(403, message);
  }
}

function getWorkflowStages(policy) {
  return [
    { key: "draft", label: "Draft", completed: true, active: policy.status === "draft" },
    {
      key: "review",
      label: "Review",
      completed: ["review", "approved", "published"].includes(policy.status),
      active: policy.status === "review",
    },
    {
      key: "approved",
      label: "Approved",
      completed: ["approved", "published"].includes(policy.status),
      active: policy.status === "approved",
    },
    {
      key: "published",
      label: "Final",
      completed: policy.status === "published",
      active: policy.status === "published",
    },
  ];
}

function parseVersion(version) {
  const [major, minor] = String(version || "1.0")
    .split(".")
    .map((value) => Number.parseInt(value, 10));
  return {
    major: Number.isFinite(major) ? major : 1,
    minor: Number.isFinite(minor) ? minor : 0,
  };
}

function incrementVersion(version, changeType = "minor") {
  const parsed = parseVersion(version);
  if (changeType === "major") {
    return `${parsed.major + 1}.0`;
  }
  return `${parsed.major}.${parsed.minor + 1}`;
}

function getUserName(state, userId) {
  const user = state.users.find((item) => item.id === userId);
  return user ? user.name : "Unknown user";
}

function getCurrentPolicyAcknowledgements(state, policy) {
  return state.acknowledgements.filter((ack) => ack.policyId === policy.id && ack.policyVersion === policy.version);
}

function getUserAcknowledgementForCurrentVersion(state, policyId, userId) {
  const policy = state.policies.find((item) => item.id === policyId);
  if (!policy) return null;
  return state.acknowledgements.find((ack) => ack.policyId === policyId && ack.userId === userId && ack.policyVersion === policy.version) || null;
}

function countUserPendingAcknowledgements(state, user) {
  if (!["staff", "student"].includes(user.role)) {
    return 0;
  }

  return state.policies
    .filter((policy) => policy.status === "published")
    .filter((policy) => !getUserAcknowledgementForCurrentVersion(state, policy.id, user.id)).length;
}

function buildSessionPayload(user) {
  const state = readStore();
  const currentUser = publicUser(user);
  currentUser.pendingCount = countUserPendingAcknowledgements(state, user);
  return {
    currentUser,
    roles: state.roles,
    config: state.config,
  };
}

function buildPolicyVersionHistory(state, policyId) {
  return state.policyVersions
    .filter((item) => item.policyId === policyId)
    .slice()
    .sort((a, b) => b.archivedAt.localeCompare(a.archivedAt))
    .map((version) => ({
      ...version,
      archivedByName: getUserName(state, version.archivedBy),
    }));
}

function buildPolicyCompliance(state, policy) {
  const applicableUsers = state.users.filter((item) => !["admin", "auditor", "manager"].includes(item.role) && item.active !== false);
  const policyAcks = getCurrentPolicyAcknowledgements(state, policy);
  const signedUserIds = new Set(policyAcks.map((ack) => ack.userId));
  const perRoleBreakdown = applicableUsers.reduce((accumulator, user) => {
    if (!accumulator[user.role]) {
      accumulator[user.role] = { role: user.role, total: 0, signed: 0, pending: 0 };
    }
    accumulator[user.role].total += 1;
    if (signedUserIds.has(user.id)) {
      accumulator[user.role].signed += 1;
    } else {
      accumulator[user.role].pending += 1;
    }
    return accumulator;
  }, {});
  const signed = policyAcks.length;
  const total = applicableUsers.length;
  const percentage = total ? Math.round((signed / total) * 100) : 100;

  return {
    policyId: policy.id,
    policyTitle: policy.title,
    version: policy.version,
    total,
    signed,
    pending: Math.max(total - signed, 0),
    percentage,
    isLowCompliance: percentage < 80,
    perRoleBreakdown: Object.values(perRoleBreakdown),
    signedUsers: applicableUsers.filter((item) => signedUserIds.has(item.id)).map((item) => {
      const ack = policyAcks.find((entry) => entry.userId === item.id);
      return {
        ...publicUser(item),
        signedAt: ack ? ack.signedAt : null,
        policyVersion: ack ? ack.policyVersion : policy.version,
        auditLogId: ack ? ack.auditLogId : null,
      };
    }),
    pendingUsers: applicableUsers.filter((item) => !signedUserIds.has(item.id)).map((item) => publicUser(item)),
  };
}

function buildComplianceReport(state) {
  const publishedPolicies = state.policies.filter((policy) => policy.status === "published");
  const applicableUsers = state.users.filter((item) => !["admin", "auditor", "manager"].includes(item.role) && item.active !== false);
  const policySummaries = publishedPolicies.map((policy) => buildPolicyCompliance(state, policy));
  const totalExpected = publishedPolicies.length * applicableUsers.length;
  const totalSigned = policySummaries.reduce((sum, item) => sum + item.signed, 0);
  const globalPercentage = totalExpected ? Math.round((totalSigned / totalExpected) * 100) : 100;

  const pendingAcknowledgements = publishedPolicies.flatMap((policy) => {
    const currentAcks = getCurrentPolicyAcknowledgements(state, policy);
    const signedUserIds = new Set(currentAcks.map((ack) => ack.userId));
    return applicableUsers
      .filter((user) => !signedUserIds.has(user.id))
      .map((user) => ({
        policyId: policy.id,
        policyTitle: policy.title,
        policyVersion: policy.version,
        userId: user.id,
        userName: user.name,
        role: user.role,
      }));
  });

  return {
    generatedAt: new Date().toISOString(),
    overview: {
      publishedPolicies: publishedPolicies.length,
      applicableUsers: applicableUsers.length,
      expectedAcknowledgements: totalExpected,
      completedAcknowledgements: totalSigned,
      pendingAcknowledgements: Math.max(totalExpected - totalSigned, 0),
      compliancePercentage: globalPercentage,
    },
    pendingAcknowledgements,
    policySummaries,
    perRoleBreakdown: Object.values(
      applicableUsers.reduce((accumulator, user) => {
        if (!accumulator[user.role]) {
          accumulator[user.role] = { role: user.role, users: 0, pendingAcknowledgements: 0 };
        }
        accumulator[user.role].users += 1;
        accumulator[user.role].pendingAcknowledgements += pendingAcknowledgements.filter((entry) => entry.role === user.role).length;
        return accumulator;
      }, {})
    ),
    lowCompliancePolicies: policySummaries.filter((item) => item.isLowCompliance).sort((a, b) => a.percentage - b.percentage),
  };
}

function buildDashboard(user) {
  const state = readStore();
  const publishedPolicies = state.policies.filter((policy) => policy.status === "published");
  const reviewPolicies = state.policies.filter((policy) => ["review", "approved"].includes(policy.status));
  const activeUsers = state.users.filter((item) => item.active !== false);
  const complianceReport = buildComplianceReport(state);
  const latestPublishedAt = publishedPolicies.reduce((latest, policy) => {
    if (!policy.publishedAt) return latest;
    return !latest || policy.publishedAt > latest ? policy.publishedAt : latest;
  }, "");

  if (user.role === "admin") {
    return {
      cards: [
        { label: "Published Policies", value: publishedPolicies.length, tone: "primary" },
        { label: "Registered Users", value: activeUsers.length, tone: "accent" },
        { label: "Awaiting Approval", value: reviewPolicies.length, tone: "warning" },
        { label: "Compliance Rate", value: `${complianceReport.overview.compliancePercentage}%`, tone: "success" },
      ],
      recentPolicies: state.policies.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4),
      recentAuditLogs: state.auditLogs.slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 5),
      lowCompliancePolicies: complianceReport.lowCompliancePolicies.slice(0, 5),
      notifications: [
        {
          id: "review-queue",
          kind: reviewPolicies.length ? "warning" : "success",
          message: reviewPolicies.length
            ? `${reviewPolicies.length} policy item(s) still need approval or publication follow-through.`
            : "No policy approvals are currently waiting on action.",
        },
      ],
    };
  }

  if (user.role === "manager") {
    return {
      cards: [
        { label: "Policies In Review", value: state.policies.filter((policy) => policy.status === "review").length, tone: "warning" },
        { label: "Approved Policies", value: state.policies.filter((policy) => policy.status === "approved").length, tone: "success" },
        { label: "Published Policies", value: publishedPolicies.length, tone: "primary" },
        { label: "Your Role", value: "Manager", tone: "accent" },
      ],
      recentPolicies: state.policies.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4),
      recentAuditLogs: [],
      notifications: [
        {
          id: "manager-review",
          kind: state.policies.some((policy) => policy.status === "review") ? "warning" : "success",
          message: state.policies.some((policy) => policy.status === "review")
            ? "Policies are waiting in review and can be approved from the policy details screen."
            : "No policies are currently waiting for manager approval.",
        },
      ],
    };
  }

  if (user.role === "auditor") {
    const today = new Date().toISOString().slice(0, 10);
    return {
      cards: [
        { label: "Total Audit Logs", value: state.auditLogs.length, tone: "primary" },
        { label: "Today's Activity", value: state.auditLogs.filter((log) => log.timestamp.startsWith(today)).length, tone: "accent" },
        { label: "Published Policies", value: publishedPolicies.length, tone: "success" },
        { label: "Tracked Users", value: activeUsers.length, tone: "warning" },
      ],
      recentPolicies: publishedPolicies.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3),
      recentAuditLogs: state.auditLogs.slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 8),
      notifications: [
        {
          id: "auditor-tools",
          kind: "primary",
          message: "Audit and reporting tools are available from the audit register.",
        },
      ],
    };
  }

  const pendingCount = countUserPendingAcknowledgements(state, user);
  const newPublishedPolicies = publishedPolicies
    .filter((policy) => !getUserAcknowledgementForCurrentVersion(state, policy.id, user.id))
    .filter((policy) => !latestPublishedAt || policy.publishedAt === latestPublishedAt || policy.updatedAt === latestPublishedAt)
    .slice(0, 3);

  return {
    cards: [
      { label: "Published Policies", value: publishedPolicies.length, tone: "primary" },
      { label: "Awaiting Signature", value: pendingCount, tone: "warning" },
      { label: "Completed Signatures", value: state.acknowledgements.filter((ack) => ack.userId === user.id).length, tone: "success" },
      { label: "Your Role", value: user.role, tone: "accent" },
    ],
    recentPolicies: publishedPolicies.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3),
    recentAuditLogs: [],
    pendingCount,
    newPublishedPolicies: newPublishedPolicies.map((policy) => ({
      id: policy.id,
      title: policy.title,
      version: policy.version,
      publishedAt: policy.publishedAt,
    })),
    notifications: [
      {
        id: "pending-acknowledgements",
        kind: pendingCount ? "warning" : "success",
        message: pendingCount
          ? `You have ${pendingCount} policy acknowledgement(s) waiting in the portal.`
          : "You are up to date on required policy acknowledgements.",
      },
    ],
  };
}

function listPoliciesForUser(user) {
  const state = readStore();
  const privileged = ["admin", "auditor", "manager"].includes(user.role);
  return state.policies
    .filter((policy) => privileged || policy.status === "published")
    .map((policy) => ({
      ...policy,
      signed: Boolean(getUserAcknowledgementForCurrentVersion(state, policy.id, user.id)),
      workflowStages: getWorkflowStages(policy),
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function getPolicyDetails(user, policyId) {
  const state = readStore();
  const policy = state.policies.find((item) => item.id === policyId);
  if (!policy) return null;

  const privileged = ["admin", "auditor", "manager"].includes(user.role);
  if (!privileged && policy.status !== "published") return null;

  const acknowledgement = getUserAcknowledgementForCurrentVersion(state, policy.id, user.id);
  const compliance = ["admin", "manager"].includes(user.role) && policy.status === "published" ? buildPolicyCompliance(state, policy) : null;

  return {
    ...policy,
    acknowledgement,
    versionHistory: buildPolicyVersionHistory(state, policy.id),
    createdByName: getUserName(state, policy.createdBy),
    approvedByName: policy.approvedBy ? getUserName(state, policy.approvedBy) : null,
    canEdit: user.role === "admin",
    canApprove: hasPermission(user, "approve_policies", state.roles) && policy.status === "review",
    canPublish: user.role === "admin" && policy.status === "approved",
    canAcknowledge: ["staff", "student"].includes(user.role) && policy.status === "published" && !acknowledgement,
    workflowStages: getWorkflowStages(policy),
    compliance,
  };
}

function buildVersionComparison(currentPolicy, archivedVersion) {
  return {
    currentVersion: {
      version: currentPolicy.version,
      title: currentPolicy.title,
      description: currentPolicy.description,
      content: currentPolicy.content,
    },
    archivedVersion,
    changedFields: ["title", "description", "content"].filter((field) => currentPolicy[field] !== archivedVersion[field]),
  };
}

function filterAuditLogs(state, searchParams) {
  const q = normalizeString(searchParams.get("q")).toLowerCase();
  const date = normalizeString(searchParams.get("date"));
  const policyId = normalizeString(searchParams.get("policyId"));
  const userId = normalizeString(searchParams.get("userId"));
  const role = normalizeString(searchParams.get("role")).toLowerCase();
  const action = normalizeString(searchParams.get("action")).toLowerCase();
  const entity = normalizeString(searchParams.get("entity")).toLowerCase();

  return state.auditLogs
    .slice()
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .filter((log) => {
      const metadataString = JSON.stringify(log.metadata || {}).toLowerCase();
      const matchesQuery =
        !q ||
        [log.userName, log.userRole, log.action, log.entity, log.entityId || "", log.ipAddress, metadataString]
          .join(" ")
          .toLowerCase()
          .includes(q);
      const matchesDate = !date || log.timestamp.startsWith(date);
      const matchesPolicy = !policyId || log.metadata?.policyId === policyId || log.entityId === policyId;
      const matchesUser = !userId || log.userId === userId || log.metadata?.userId === userId;
      const matchesRole = !role || String(log.userRole || "").toLowerCase() === role;
      const matchesAction = !action || String(log.action || "").toLowerCase().includes(action);
      const matchesEntity = !entity || String(log.entity || "").toLowerCase() === entity;
      return matchesQuery && matchesDate && matchesPolicy && matchesUser && matchesRole && matchesAction && matchesEntity;
    });
}

function toCsv(logs) {
  const headers = ["Timestamp", "User", "Role", "Action", "Entity", "Entity ID", "IP Address", "Method", "Path", "Policy ID", "Policy Version"];
  const rows = logs.map((log) =>
    [
      log.timestamp,
      log.userName,
      log.userRole,
      log.action,
      log.entity,
      log.entityId || "",
      log.ipAddress,
      log.metadata?.method || "",
      log.metadata?.path || "",
      log.metadata?.policyId || "",
      log.metadata?.policyVersion || "",
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

function buildAuditReport(logs) {
  const groupedByAction = logs.reduce((accumulator, log) => {
    accumulator[log.action] = (accumulator[log.action] || 0) + 1;
    return accumulator;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    totalRecords: logs.length,
    actionSummary: Object.entries(groupedByAction)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count),
    recentEntries: logs.slice(0, 10),
  };
}

function recordRequestLog(req, user) {
  if (!req.url.startsWith("/api/") || req.url.startsWith("/api/audit-logs")) {
    return;
  }

  recordAudit({
    user,
    action: "API_REQUEST",
    entity: "request",
    ipAddress: getClientIp(req),
    userAgent: req.headers["user-agent"] || "",
    metadata: {
      method: req.method,
      path: req.url,
    },
  });
}

async function handleApiRequest(req, res) {
  const url = new URL(req.url, "http://localhost");
  const { pathname, searchParams } = url;

  try {
    if (req.method === "POST" && pathname === "/api/auth/login") {
      const body = validateLoginPayload(await readBody(req));
      if (!body.ok) return json(res, 400, { error: body.error });

      const state = readStore();
      const user = state.users.find((item) => item.email.toLowerCase() === body.value.email && verifyPassword(body.value.password, item.passwordHash));

      if (!user) {
        recordAudit({
          user: null,
          action: "LOGIN_FAILED",
          entity: "user",
          ipAddress: getClientIp(req),
          userAgent: req.headers["user-agent"] || "",
          metadata: { email: body.value.email },
        });
        return json(res, 401, { error: "Invalid email or password." });
      }

      const token = signToken({ userId: user.id }, tokenSecret, tokenTtlSeconds);
      recordAudit({
        user,
        action: "LOGIN",
        entity: "user",
        entityId: user.id,
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"] || "",
        metadata: { method: "credentials" },
      });
      return json(res, 200, { token, session: buildSessionPayload(user) });
    }

    if (req.method === "POST" && pathname === "/api/auth/demo-login") {
      const body = await readBody(req);
      const requestedRole = normalizeString(body.role);
      const state = readStore();
      const user = state.users.find((item) => item.role === requestedRole);
      if (!user) return json(res, 404, { error: "Demo user not found." });

      const token = signToken({ userId: user.id }, tokenSecret, tokenTtlSeconds);
      recordAudit({
        user,
        action: "LOGIN_DEMO",
        entity: "user",
        entityId: user.id,
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"] || "",
        metadata: { role: requestedRole },
      });
      return json(res, 200, { token, session: buildSessionPayload(user) });
    }

    if (req.method === "POST" && pathname === "/api/auth/register") {
      const body = validateRegisterPayload(await readBody(req));
      if (!body.ok) return json(res, 400, { error: body.error });

      const now = new Date().toISOString();
      let createdUser = null;
      let duplicate = false;

      updateStore((state) => {
        duplicate = state.users.some((item) => item.email.toLowerCase() === body.value.email);
        if (duplicate) return state;

        createdUser = {
          id: generateId(),
          name: body.value.name,
          email: body.value.email,
          role: body.value.role,
          passwordHash: hashPassword(body.value.password),
          active: true,
          createdAt: now,
          updatedAt: now,
        };
        state.users.push(createdUser);
        return state;
      });

      if (duplicate) return json(res, 409, { error: "An account with that email already exists." });

      recordAudit({
        user: createdUser,
        action: "USER_REGISTERED",
        entity: "user",
        entityId: createdUser.id,
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"] || "",
        metadata: { email: body.value.email, role: body.value.role },
      });
      return json(res, 201, { message: "Account created successfully." });
    }

    if (req.method === "GET" && pathname === "/api/session") {
      const user = requireAuthenticatedUser(req);
      recordRequestLog(req, user);
      return json(res, 200, buildSessionPayload(user));
    }

    const user = requireAuthenticatedUser(req);
    recordRequestLog(req, user);

    if (req.method === "GET" && pathname === "/api/dashboard") {
      return json(res, 200, buildDashboard(user));
    }

    if (req.method === "GET" && pathname === "/api/policies") {
      return json(res, 200, { policies: listPoliciesForUser(user) });
    }

    const versionListMatch = pathname.match(/^\/api\/policies\/([^/]+)\/versions$/);
    if (req.method === "GET" && versionListMatch) {
      const policy = getPolicyDetails(user, versionListMatch[1]);
      if (!policy) return json(res, 404, { error: "Policy not found." });
      return json(res, 200, { versions: policy.versionHistory });
    }

    const versionGetMatch = pathname.match(/^\/api\/policies\/([^/]+)\/versions\/([^/]+)$/);
    if (req.method === "GET" && versionGetMatch) {
      const state = readStore();
      const policy = state.policies.find((item) => item.id === versionGetMatch[1]);
      if (!policy) return json(res, 404, { error: "Policy not found." });
      const privileged = ["admin", "auditor", "manager"].includes(user.role);
      if (!privileged && policy.status !== "published") return json(res, 403, { error: "You do not have access to this resource." });

      const version = state.policyVersions.find((item) => item.policyId === policy.id && item.id === versionGetMatch[2]);
      if (!version) return json(res, 404, { error: "Archived version not found." });
      return json(res, 200, {
        version: {
          ...version,
          archivedByName: getUserName(state, version.archivedBy),
        },
      });
    }

    const versionCompareMatch = pathname.match(/^\/api\/policies\/([^/]+)\/versions\/([^/]+)\/compare$/);
    if (req.method === "GET" && versionCompareMatch) {
      const state = readStore();
      const policy = state.policies.find((item) => item.id === versionCompareMatch[1]);
      if (!policy) return json(res, 404, { error: "Policy not found." });
      const privileged = ["admin", "auditor", "manager"].includes(user.role);
      if (!privileged && policy.status !== "published") return json(res, 403, { error: "You do not have access to this resource." });

      const version = state.policyVersions.find((item) => item.policyId === policy.id && item.id === versionCompareMatch[2]);
      if (!version) return json(res, 404, { error: "Archived version not found." });
      return json(res, 200, { comparison: buildVersionComparison(policy, version) });
    }

    const policyMatch = pathname.match(/^\/api\/policies\/([^/]+)$/);
    if (req.method === "GET" && policyMatch) {
      const policy = getPolicyDetails(user, policyMatch[1]);
      return policy ? json(res, 200, policy) : json(res, 404, { error: "Policy not found." });
    }

    if (req.method === "POST" && pathname === "/api/policies") {
      requireRole(user, ["admin"]);
      const payload = validatePolicyPayload(await readBody(req));
      if (!payload.ok) return json(res, 400, { error: payload.error });

      const now = new Date().toISOString();
      let createdPolicy = null;

      updateStore((state) => {
        createdPolicy = {
          id: generateId(),
          title: payload.value.title,
          description: payload.value.description,
          content: payload.value.content,
          status: payload.value.status === "published" ? "review" : payload.value.status,
          version: "1.0",
          createdAt: now,
          updatedAt: now,
          publishedAt: null,
          approvedAt: null,
          approvedBy: null,
          createdBy: user.id,
        };
        state.policies.push(createdPolicy);
        return state;
      });

      recordAudit({
        user,
        action: "POLICY_CREATED",
        entity: "policy",
        entityId: createdPolicy.id,
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"] || "",
        metadata: { title: createdPolicy.title, status: createdPolicy.status, version: createdPolicy.version },
      });
      return json(res, 201, createdPolicy);
    }

    const updatePolicyMatch = pathname.match(/^\/api\/policies\/([^/]+)$/);
    if (req.method === "PUT" && updatePolicyMatch) {
      requireRole(user, ["admin"]);
      const payload = validatePolicyPayload(await readBody(req));
      if (!payload.ok) return json(res, 400, { error: payload.error });

      const now = new Date().toISOString();
      const policyId = updatePolicyMatch[1];
      let updatedPolicy = null;

      updateStore((state) => {
        const index = state.policies.findIndex((item) => item.id === policyId);
        if (index === -1) return state;

        const existing = state.policies[index];
        const contentChanged =
          existing.title !== payload.value.title ||
          existing.description !== payload.value.description ||
          existing.content !== payload.value.content;

        if (contentChanged) {
          state.policyVersions.push({
            id: generateId(),
            policyId: existing.id,
            version: existing.version,
            title: existing.title,
            description: existing.description,
            content: existing.content,
            archivedAt: now,
            archivedBy: user.id,
            changeType: payload.value.versionBump,
            changeSummary: `Content updated with a ${payload.value.versionBump} version increment.`,
          });
        }

        const nextVersion = contentChanged ? incrementVersion(existing.version, payload.value.versionBump) : existing.version;
        const nextStatus = payload.value.status === "published" ? "review" : payload.value.status;
        updatedPolicy = {
          ...existing,
          title: payload.value.title,
          description: payload.value.description,
          content: payload.value.content,
          status: nextStatus,
          version: nextVersion,
          updatedAt: now,
          approvedAt: nextStatus === "approved" ? existing.approvedAt : null,
          approvedBy: nextStatus === "approved" ? existing.approvedBy : null,
          publishedAt: nextStatus === "published" ? existing.publishedAt : null,
        };
        state.policies[index] = updatedPolicy;
        return state;
      });

      if (!updatedPolicy) return json(res, 404, { error: "Policy not found." });

      recordAudit({
        user,
        action: "POLICY_UPDATED",
        entity: "policy",
        entityId: updatedPolicy.id,
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"] || "",
        metadata: {
          title: updatedPolicy.title,
          status: updatedPolicy.status,
          version: updatedPolicy.version,
          versionBump: payload.value.versionBump,
        },
      });
      return json(res, 200, updatedPolicy);
    }

    const approveMatch = pathname.match(/^\/api\/policies\/([^/]+)\/approve$/);
    if (req.method === "POST" && approveMatch) {
      const state = readStore();
      requirePermission(user, "approve_policies", state.roles);

      const policy = state.policies.find((item) => item.id === approveMatch[1]);
      if (!policy) return json(res, 404, { error: "Policy not found." });
      if (policy.status !== "review") return json(res, 409, { error: "Only policies in review can be approved." });

      const now = new Date().toISOString();
      let approvedPolicy = null;
      updateStore((nextState) => {
        const index = nextState.policies.findIndex((item) => item.id === approveMatch[1]);
        approvedPolicy = {
          ...nextState.policies[index],
          status: "approved",
          approvedAt: now,
          approvedBy: user.id,
          updatedAt: now,
        };
        nextState.policies[index] = approvedPolicy;
        return nextState;
      });

      recordAudit({
        user,
        action: "POLICY_APPROVED",
        entity: "policy",
        entityId: approvedPolicy.id,
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"] || "",
        metadata: { title: approvedPolicy.title, version: approvedPolicy.version },
      });
      return json(res, 200, approvedPolicy);
    }

    const publishMatch = pathname.match(/^\/api\/policies\/([^/]+)\/publish$/);
    if (req.method === "POST" && publishMatch) {
      requireRole(user, ["admin"]);
      const state = readStore();
      const policy = state.policies.find((item) => item.id === publishMatch[1]);
      if (!policy) return json(res, 404, { error: "Policy not found." });
      if (policy.status !== "approved") return json(res, 409, { error: "A manager must approve this policy before it can be published." });

      const now = new Date().toISOString();
      let publishedPolicy = null;
      updateStore((nextState) => {
        const index = nextState.policies.findIndex((item) => item.id === publishMatch[1]);
        publishedPolicy = {
          ...nextState.policies[index],
          status: "published",
          publishedAt: now,
          updatedAt: now,
        };
        nextState.policies[index] = publishedPolicy;
        return nextState;
      });

      recordAudit({
        user,
        action: "POLICY_PUBLISHED",
        entity: "policy",
        entityId: publishedPolicy.id,
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"] || "",
        metadata: { title: publishedPolicy.title, version: publishedPolicy.version },
      });
      return json(res, 200, publishedPolicy);
    }

    const acknowledgeMatch = pathname.match(/^\/api\/policies\/([^/]+)\/acknowledge$/);
    if (req.method === "POST" && acknowledgeMatch) {
      requireRole(user, ["staff", "student"]);

      const state = readStore();
      const policy = state.policies.find((item) => item.id === acknowledgeMatch[1] && item.status === "published");
      if (!policy) return json(res, 404, { error: "Published policy not found." });

      const existingAck = getUserAcknowledgementForCurrentVersion(state, policy.id, user.id);
      if (existingAck) return json(res, 409, { error: "You have already acknowledged the current version of this policy." });

      const signedAt = new Date().toISOString();
      const ack = {
        id: generateId(),
        policyId: policy.id,
        policyTitle: policy.title,
        policyVersion: policy.version,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"] || "",
        signedAt,
        evidence: {
          recordedAt: signedAt,
          source: "portal-ui",
          policySnapshotVersion: policy.version,
        },
        auditLogId: null,
      };

      updateStore((nextState) => {
        nextState.acknowledgements.push(ack);
        return nextState;
      });

      const auditEntry = recordAudit({
        user,
        action: "POLICY_ACKNOWLEDGED",
        entity: "acknowledgement",
        entityId: ack.id,
        ipAddress: ack.ipAddress,
        userAgent: ack.userAgent,
        metadata: {
          policyId: policy.id,
          policyTitle: policy.title,
          policyVersion: policy.version,
          userId: user.id,
          acknowledgementId: ack.id,
        },
      });

      updateStore((nextState) => {
        const index = nextState.acknowledgements.findIndex((item) => item.id === ack.id);
        if (index >= 0) {
          nextState.acknowledgements[index].auditLogId = auditEntry.id;
        }
        return nextState;
      });

      ack.auditLogId = auditEntry.id;
      return json(res, 201, ack);
    }

    if (req.method === "GET" && pathname === "/api/pending") {
      requireRole(user, ["staff", "student"]);
      const state = readStore();
      const publishedPolicies = state.policies.filter((item) => item.status === "published");

      const pending = publishedPolicies.filter((policy) => !getUserAcknowledgementForCurrentVersion(state, policy.id, user.id));
      const signed = publishedPolicies
        .filter((policy) => Boolean(getUserAcknowledgementForCurrentVersion(state, policy.id, user.id)))
        .map((policy) => ({ ...policy, acknowledgement: getUserAcknowledgementForCurrentVersion(state, policy.id, user.id) }));

      return json(res, 200, { pending, signed });
    }

    if (req.method === "GET" && pathname === "/api/reports/compliance") {
      const state = readStore();
      requirePermission(user, "view_audit", state.roles, "You do not have access to compliance reports.");
      return json(res, 200, buildComplianceReport(state));
    }

    const compliancePolicyMatch = pathname.match(/^\/api\/reports\/compliance\/policies\/([^/]+)$/);
    if (req.method === "GET" && compliancePolicyMatch) {
      const state = readStore();
      requirePermission(user, "view_audit", state.roles, "You do not have access to compliance reports.");
      const policy = state.policies.find((item) => item.id === compliancePolicyMatch[1]);
      if (!policy) return json(res, 404, { error: "Policy not found." });
      return json(res, 200, { summary: buildPolicyCompliance(state, policy) });
    }

    if (req.method === "GET" && pathname === "/api/users") {
      requireRole(user, ["admin"]);
      const state = readStore();
      return json(res, 200, { users: state.users.map((item) => publicUser(item)) });
    }

    const userRoleMatch = pathname.match(/^\/api\/users\/([^/]+)\/role$/);
    if (req.method === "PATCH" && userRoleMatch) {
      requireRole(user, ["admin"]);
      if (userRoleMatch[1] === user.id) return json(res, 400, { error: "You cannot change your own role." });

      const rolePayload = validateRolePayload(await readBody(req));
      if (!rolePayload.ok) return json(res, 400, { error: rolePayload.error });

      const now = new Date().toISOString();
      let updatedUser = null;
      let previousRole = null;
      updateStore((state) => {
        const index = state.users.findIndex((item) => item.id === userRoleMatch[1]);
        if (index === -1) return state;
        previousRole = state.users[index].role;
        updatedUser = { ...state.users[index], role: rolePayload.value.role, updatedAt: now };
        state.users[index] = updatedUser;
        return state;
      });

      if (!updatedUser) return json(res, 404, { error: "User not found." });

      recordAudit({
        user,
        action: "USER_ROLE_CHANGED",
        entity: "user",
        entityId: updatedUser.id,
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"] || "",
        metadata: { userName: updatedUser.name, oldRole: previousRole, newRole: rolePayload.value.role },
      });
      return json(res, 200, publicUser(updatedUser));
    }

    if (req.method === "GET" && pathname === "/api/audit-logs") {
      const state = readStore();
      requirePermission(user, "view_audit", state.roles);

      const filtered = filterAuditLogs(state, searchParams);
      const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
      const pageSize = Math.min(100, Math.max(5, Number.parseInt(searchParams.get("pageSize") || "20", 10)));
      const start = (page - 1) * pageSize;
      const logs = filtered.slice(start, start + pageSize);

      return json(res, 200, {
        logs,
        pagination: {
          page,
          pageSize,
          total: filtered.length,
          totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
        },
      });
    }

    if (req.method === "GET" && pathname === "/api/audit-logs/report") {
      const state = readStore();
      requirePermission(user, "view_audit", state.roles);
      const filtered = filterAuditLogs(state, searchParams);
      return json(res, 200, buildAuditReport(filtered));
    }

    if (req.method === "GET" && pathname === "/api/audit-logs/export") {
      const state = readStore();
      requirePermission(user, "export_logs", state.roles);
      const filtered = filterAuditLogs(state, searchParams);

      recordAudit({
        user,
        action: "AUDIT_LOGS_EXPORTED",
        entity: "audit",
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"] || "",
        metadata: { recordCount: filtered.length, method: req.method, path: req.url },
      });
      return text(res, 200, toCsv(filtered), "text/csv; charset=utf-8");
    }

    return json(res, 404, { error: "Resource not found." });
  } catch (error) {
    const statusCode = error.statusCode || (error.message === "Request body too large." ? 413 : 500);
    if (statusCode >= 500) {
      console.error(error);
    }
    return json(res, statusCode, { error: error.message || "Unexpected server error." });
  }
}

module.exports = {
  handleApiRequest,
};

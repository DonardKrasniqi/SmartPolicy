const { tokenSecret } = require("../config");
const { readStore, updateStore, publicUser } = require("../store");
const { hashPassword, verifyPassword, signToken, verifyToken } = require("../utils/security");
const { generateId } = require("../utils/ids");
const { readBody, json, text, getTokenFromRequest, getClientIp } = require("../utils/http");
const { recordAudit } = require("../services/auditService");

function hasPermission(user, permission, roles) {
  if (!user) return false;
  if (user.role === "admin") return true;
  const role = roles.find((item) => item.id === user.role);
  return Boolean(role && role.permissions.includes(permission));
}

function getAuthenticatedUser(req) {
  const token = getTokenFromRequest(req);
  const payload = verifyToken(token, tokenSecret);
  if (!payload) return null;

  const state = readStore();
  return state.users.find((user) => user.id === payload.userId && user.active !== false) || null;
}

function sanitizePolicyPayload(payload) {
  return {
    title: String(payload.title || "").trim(),
    description: String(payload.description || "").trim(),
    content: String(payload.content || "").trim(),
    status: ["draft", "review", "approved", "published"].includes(payload.status) ? payload.status : "draft",
  };
}

function buildSessionPayload(user) {
  const state = readStore();
  return {
    currentUser: publicUser(user),
    roles: state.roles,
    config: state.config,
  };
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

function getUserName(state, userId) {
  const user = state.users.find((item) => item.id === userId);
  return user ? user.name : "Unknown user";
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
  const policyAcks = state.acknowledgements.filter((ack) => ack.policyId === policy.id);
  const signedUserIds = new Set(policyAcks.map((ack) => ack.userId));
  const signed = policyAcks.length;
  const total = applicableUsers.length;
  const percentage = total ? Math.round((signed / total) * 100) : 100;

  return {
    total,
    signed,
    pending: Math.max(total - signed, 0),
    percentage,
    isLowCompliance: percentage < 80,
    signedUsers: applicableUsers.filter((item) => signedUserIds.has(item.id)).map((item) => {
      const ack = policyAcks.find((entry) => entry.userId === item.id);
      return {
        ...publicUser(item),
        signedAt: ack ? ack.signedAt : null,
        policyVersion: ack ? ack.policyVersion : policy.version,
      };
    }),
    pendingUsers: applicableUsers.filter((item) => !signedUserIds.has(item.id)).map((item) => publicUser(item)),
  };
}

function buildDashboard(user) {
  const state = readStore();
  const publishedPolicies = state.policies.filter((policy) => policy.status === "published");
  const reviewPolicies = state.policies.filter((policy) => ["review", "approved"].includes(policy.status));
  const acknowledgements = state.acknowledgements;
  const activeUsers = state.users.filter((item) => item.active !== false);
  const applicableUsers = activeUsers.filter((item) => !["admin", "auditor", "manager"].includes(item.role));
  const lowCompliancePolicies = publishedPolicies
    .map((policy) => ({
      id: policy.id,
      title: policy.title,
      version: policy.version,
      compliance: buildPolicyCompliance(state, policy),
    }))
    .filter((policy) => policy.compliance.isLowCompliance)
    .sort((a, b) => a.compliance.percentage - b.compliance.percentage);
  const latestPublishedAt = publishedPolicies.reduce((latest, policy) => {
    if (!policy.publishedAt) return latest;
    return !latest || policy.publishedAt > latest ? policy.publishedAt : latest;
  }, "");

  if (user.role === "admin") {
    const complianceRate =
      publishedPolicies.length && applicableUsers.length
        ? Math.round((acknowledgements.length / (publishedPolicies.length * applicableUsers.length)) * 100)
        : 100;

    return {
      cards: [
        { label: "Published Policies", value: publishedPolicies.length, tone: "primary" },
        { label: "Registered Users", value: activeUsers.length, tone: "accent" },
        { label: "Awaiting Approval", value: reviewPolicies.length, tone: "warning" },
        { label: "Compliance Rate", value: `${complianceRate}%`, tone: "success" },
      ],
      recentPolicies: state.policies.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4),
      recentAuditLogs: state.auditLogs.slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 5),
      lowCompliancePolicies: lowCompliancePolicies.slice(0, 5),
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

  const userAcks = acknowledgements.filter((item) => item.userId === user.id);
  const pendingCount = publishedPolicies.filter((policy) => !userAcks.some((ack) => ack.policyId === policy.id)).length;
  const newPublishedPolicies = publishedPolicies
    .filter((policy) => !userAcks.some((ack) => ack.policyId === policy.id))
    .filter((policy) => !latestPublishedAt || policy.publishedAt === latestPublishedAt || policy.updatedAt === latestPublishedAt)
    .slice(0, 3);

  return {
    cards: [
      { label: "Published Policies", value: publishedPolicies.length, tone: "primary" },
      { label: "Awaiting Signature", value: pendingCount, tone: "warning" },
      { label: "Completed Signatures", value: userAcks.length, tone: "success" },
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
      signed: state.acknowledgements.some((ack) => ack.policyId === policy.id && ack.userId === user.id),
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

  const acknowledgement = state.acknowledgements.find(
    (ack) => ack.policyId === policy.id && ack.userId === user.id
  );

  let compliance = null;
  if (["admin", "manager"].includes(user.role) && policy.status === "published") {
    compliance = buildPolicyCompliance(state, policy);
  }

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

function toCsv(logs) {
  const headers = ["Timestamp", "User", "Role", "Action", "Entity", "Entity ID", "IP Address", "Method", "Path"];
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
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

function recordRequestLog(req, user) {
  if (!req.url.startsWith("/api/")) {
    return;
  }

  if (req.url.startsWith("/api/audit-logs")) {
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
      const body = await readBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const state = readStore();
      const user = state.users.find((item) => item.email.toLowerCase() === email && verifyPassword(password, item.passwordHash));

      if (!user) {
        recordAudit({
          user: null,
          action: "LOGIN_FAILED",
          entity: "user",
          ipAddress: getClientIp(req),
          userAgent: req.headers["user-agent"] || "",
          metadata: { email },
        });
        return json(res, 401, { error: "Invalid email or password." });
      }

      const token = signToken({ userId: user.id }, tokenSecret);
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
      const requestedRole = String(body.role || "").trim();
      const state = readStore();
      const user = state.users.find((item) => item.role === requestedRole);

      if (!user) return json(res, 404, { error: "Demo user not found." });

      const token = signToken({ userId: user.id }, tokenSecret);
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
      const body = await readBody(req);
      const name = String(body.name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const role = ["staff", "student"].includes(body.role) ? body.role : "student";

      if (!name || !email || password.length < 6) {
        return json(res, 400, { error: "Please provide a name, email, and password with at least 6 characters." });
      }

      const now = new Date().toISOString();
      let createdUser = null;
      let duplicate = false;

      updateStore((state) => {
        duplicate = state.users.some((item) => item.email.toLowerCase() === email);
        if (duplicate) return state;

        createdUser = {
          id: generateId(),
          name,
          email,
          role,
          passwordHash: hashPassword(password),
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
        metadata: { email, role },
      });
      return json(res, 201, { message: "Account created successfully." });
    }

    const user = getAuthenticatedUser(req);
    if (req.method === "GET" && pathname === "/api/session") {
      if (!user) return json(res, 401, { error: "Authentication required or session expired." });
      recordRequestLog(req, user);
      return json(res, 200, buildSessionPayload(user));
    }

    if (!user) {
      return json(res, 401, { error: "Authentication required or session expired." });
    }

    recordRequestLog(req, user);

    if (req.method === "GET" && pathname === "/api/dashboard") {
      return json(res, 200, buildDashboard(user));
    }

    if (req.method === "GET" && pathname === "/api/policies") {
      return json(res, 200, { policies: listPoliciesForUser(user) });
    }

    const policyMatch = pathname.match(/^\/api\/policies\/([^/]+)$/);
    if (req.method === "GET" && policyMatch) {
      const policy = getPolicyDetails(user, policyMatch[1]);
      return policy ? json(res, 200, policy) : json(res, 404, { error: "Policy not found." });
    }

    if (req.method === "POST" && pathname === "/api/policies") {
      if (user.role !== "admin") return json(res, 403, { error: "You do not have access to this resource." });

      const body = sanitizePolicyPayload(await readBody(req));
      if (!body.title || !body.content) return json(res, 400, { error: "Policy title and content are required." });

      const now = new Date().toISOString();
      let createdPolicy = null;
      updateStore((state) => {
        createdPolicy = {
          id: generateId(),
          ...body,
          status: body.status === "published" ? "review" : body.status,
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
      if (user.role !== "admin") return json(res, 403, { error: "You do not have access to this resource." });

      const body = sanitizePolicyPayload(await readBody(req));
      if (!body.title || !body.content) return json(res, 400, { error: "Policy title and content are required." });

      const now = new Date().toISOString();
      const policyId = updatePolicyMatch[1];
      let updatedPolicy = null;

      updateStore((state) => {
        const index = state.policies.findIndex((item) => item.id === policyId);
        if (index === -1) return state;

        const existing = state.policies[index];
        const contentChanged =
          existing.title !== body.title ||
          existing.description !== body.description ||
          existing.content !== body.content;

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
          });
        }

        const currentVersion = Number.parseFloat(existing.version || "1.0");
        const nextVersion = contentChanged ? `${Math.floor(currentVersion) + 1}.0` : existing.version;
        const nextStatus = body.status === "published" ? "review" : body.status;

        updatedPolicy = {
          ...existing,
          ...body,
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
        metadata: { title: updatedPolicy.title, status: updatedPolicy.status, version: updatedPolicy.version },
      });
      return json(res, 200, updatedPolicy);
    }

    const approveMatch = pathname.match(/^\/api\/policies\/([^/]+)\/approve$/);
    if (req.method === "POST" && approveMatch) {
      const state = readStore();
      if (!hasPermission(user, "approve_policies", state.roles)) {
        return json(res, 403, { error: "You do not have access to this resource." });
      }

      let approvedPolicy = null;
      const now = new Date().toISOString();
      updateStore((nextState) => {
        const index = nextState.policies.findIndex((item) => item.id === approveMatch[1]);
        if (index === -1) return nextState;
        if (nextState.policies[index].status !== "review") return nextState;

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

      if (!approvedPolicy) return json(res, 409, { error: "Only policies in review can be approved." });

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
      if (user.role !== "admin") return json(res, 403, { error: "You do not have access to this resource." });

      const now = new Date().toISOString();
      let publishedPolicy = null;
      let invalidState = false;

      updateStore((state) => {
        const index = state.policies.findIndex((item) => item.id === publishMatch[1]);
        if (index === -1) return state;

        if (state.policies[index].status !== "approved") {
          invalidState = true;
          return state;
        }

        publishedPolicy = {
          ...state.policies[index],
          status: "published",
          publishedAt: now,
          updatedAt: now,
        };
        state.policies[index] = publishedPolicy;
        return state;
      });

      if (invalidState) return json(res, 409, { error: "A manager must approve this policy before it can be published." });
      if (!publishedPolicy) return json(res, 404, { error: "Policy not found." });

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
      if (!["staff", "student"].includes(user.role)) return json(res, 403, { error: "You do not have access to this resource." });

      const state = readStore();
      const policy = state.policies.find((item) => item.id === acknowledgeMatch[1] && item.status === "published");
      if (!policy) return json(res, 404, { error: "Policy not found." });

      const existingAck = state.acknowledgements.find((item) => item.policyId === policy.id && item.userId === user.id);
      if (existingAck) return json(res, 409, { error: "You have already acknowledged this policy." });

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
        signedAt: new Date().toISOString(),
      };

      updateStore((nextState) => {
        nextState.acknowledgements.push(ack);
        return nextState;
      });

      recordAudit({
        user,
        action: "POLICY_ACKNOWLEDGED",
        entity: "acknowledgement",
        entityId: ack.id,
        ipAddress: ack.ipAddress,
        userAgent: ack.userAgent,
        metadata: { policyId: policy.id, policyVersion: policy.version, userId: user.id },
      });
      return json(res, 201, ack);
    }

    if (req.method === "GET" && pathname === "/api/pending") {
      const state = readStore();
      const publishedPolicies = state.policies.filter((item) => item.status === "published");
      const userAcks = state.acknowledgements.filter((item) => item.userId === user.id);

      const pending = publishedPolicies.filter((policy) => !userAcks.some((ack) => ack.policyId === policy.id));
      const signed = publishedPolicies
        .filter((policy) => userAcks.some((ack) => ack.policyId === policy.id))
        .map((policy) => ({ ...policy, acknowledgement: userAcks.find((ack) => ack.policyId === policy.id) }));

      return json(res, 200, { pending, signed });
    }

    if (req.method === "GET" && pathname === "/api/users") {
      if (user.role !== "admin") return json(res, 403, { error: "You do not have access to this resource." });
      const state = readStore();
      return json(res, 200, { users: state.users.map((item) => publicUser(item)) });
    }

    const userRoleMatch = pathname.match(/^\/api\/users\/([^/]+)\/role$/);
    if (req.method === "PATCH" && userRoleMatch) {
      if (user.role !== "admin") return json(res, 403, { error: "You do not have access to this resource." });
      if (userRoleMatch[1] === user.id) return json(res, 400, { error: "You cannot change your own role." });

      const body = await readBody(req);
      const newRole = ["admin", "manager", "staff", "student", "auditor"].includes(body.role) ? body.role : null;
      if (!newRole) return json(res, 400, { error: "Invalid role." });

      const now = new Date().toISOString();
      let updatedUser = null;
      let previousRole = null;
      updateStore((state) => {
        const index = state.users.findIndex((item) => item.id === userRoleMatch[1]);
        if (index === -1) return state;

        previousRole = state.users[index].role;
        updatedUser = { ...state.users[index], role: newRole, updatedAt: now };
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
        metadata: { userName: updatedUser.name, oldRole: previousRole, newRole },
      });
      return json(res, 200, publicUser(updatedUser));
    }

    if (req.method === "GET" && pathname === "/api/audit-logs") {
      const state = readStore();
      if (!(user.role === "admin" || hasPermission(user, "view_audit", state.roles))) {
        return json(res, 403, { error: "You do not have access to this resource." });
      }

      const query = String(searchParams.get("q") || "").trim().toLowerCase();
      const date = String(searchParams.get("date") || "").trim();
      const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
      const pageSize = Math.min(100, Math.max(5, Number.parseInt(searchParams.get("pageSize") || "20", 10)));

      const filtered = state.auditLogs
        .slice()
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .filter((log) => {
          const matchesQuery =
            !query ||
            [log.userName, log.userRole, log.action, log.entity, log.ipAddress, JSON.stringify(log.metadata || {})]
              .join(" ")
              .toLowerCase()
              .includes(query);
          const matchesDate = !date || log.timestamp.startsWith(date);
          return matchesQuery && matchesDate;
        });

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

    if (req.method === "GET" && pathname === "/api/audit-logs/export") {
      const state = readStore();
      if (!(user.role === "admin" || hasPermission(user, "export_logs", state.roles))) {
        return json(res, 403, { error: "You do not have access to this resource." });
      }

      recordAudit({
        user,
        action: "AUDIT_LOGS_EXPORTED",
        entity: "audit",
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"] || "",
        metadata: { recordCount: state.auditLogs.length, method: req.method, path: req.url },
      });
      return text(res, 200, toCsv(state.auditLogs), "text/csv; charset=utf-8");
    }

    return json(res, 404, { error: "Resource not found." });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: "Unexpected server error." });
  }
}

module.exports = {
  handleApiRequest,
};

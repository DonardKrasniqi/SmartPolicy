const { sanitizePolicyHtml } = require("./sanitize");

const VALID_POLICY_STATUSES = ["draft", "review", "approved", "published"];
const VALID_USER_ROLES = ["admin", "manager", "staff", "student", "auditor"];

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return normalizeString(value).toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateLoginPayload(payload) {
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || "");

  if (!email || !password) {
    return { ok: false, error: "Email and password are required." };
  }

  return { ok: true, value: { email, password } };
}

function validateRegisterPayload(payload) {
  const name = normalizeString(payload.name);
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || "");
  const role = VALID_USER_ROLES.includes(payload.role) && ["staff", "student"].includes(payload.role) ? payload.role : "student";

  if (!name || name.length < 2) {
    return { ok: false, error: "Please provide a valid name." };
  }

  if (!isValidEmail(email)) {
    return { ok: false, error: "Please provide a valid email address." };
  }

  if (password.length < 6) {
    return { ok: false, error: "Please provide a password with at least 6 characters." };
  }

  return { ok: true, value: { name, email, password, role } };
}

function validatePolicyPayload(payload) {
  const title = normalizeString(payload.title);
  const description = normalizeString(payload.description);
  const content = sanitizePolicyHtml(payload.content);
  const status = VALID_POLICY_STATUSES.includes(payload.status) ? payload.status : "draft";
  const versionBump = ["none", "minor", "major"].includes(payload.versionBump) ? payload.versionBump : "minor";

  if (!title || title.length < 3) {
    return { ok: false, error: "Policy title must be at least 3 characters." };
  }

  if (!content) {
    return { ok: false, error: "Policy content is required." };
  }

  return {
    ok: true,
    value: {
      title,
      description,
      content,
      status,
      versionBump,
    },
  };
}

function validateRolePayload(payload) {
  const role = VALID_USER_ROLES.includes(payload.role) ? payload.role : null;
  if (!role) {
    return { ok: false, error: "Invalid role." };
  }
  return { ok: true, value: { role } };
}

function validateUserActivePayload(payload) {
  if (typeof payload?.active !== "boolean") {
    return { ok: false, error: "Field active must be true or false." };
  }
  return { ok: true, value: { active: payload.active } };
}

module.exports = {
  VALID_POLICY_STATUSES,
  VALID_USER_ROLES,
  normalizeString,
  normalizeEmail,
  validateLoginPayload,
  validateRegisterPayload,
  validatePolicyPayload,
  validateRolePayload,
  validateUserActivePayload,
};

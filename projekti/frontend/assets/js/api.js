const TOKEN_KEY = "smartpolicy-token";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return null;
  }

  const isJson = (response.headers.get("content-type") || "").includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    if (response.status === 401) {
      clearToken();
    }
    throw new Error(isJson ? payload.error : "Request failed");
  }

  return payload;
}

export const api = {
  getToken,
  setToken,
  clearToken,
  request,
  login(credentials) {
    return request("/api/auth/login", { method: "POST", body: JSON.stringify(credentials) });
  },
  demoLogin(role) {
    return request("/api/auth/demo-login", { method: "POST", body: JSON.stringify({ role }) });
  },
  register(payload) {
    return request("/api/auth/register", { method: "POST", body: JSON.stringify(payload) });
  },
  getSession() {
    return request("/api/session");
  },
  getDashboard() {
    return request("/api/dashboard");
  },
  getPolicies() {
    return request("/api/policies");
  },
  getPolicy(id) {
    return request(`/api/policies/${id}`);
  },
  createPolicy(payload) {
    return request("/api/policies", { method: "POST", body: JSON.stringify(payload) });
  },
  updatePolicy(id, payload) {
    return request(`/api/policies/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  },
  approvePolicy(id) {
    return request(`/api/policies/${id}/approve`, { method: "POST" });
  },
  publishPolicy(id) {
    return request(`/api/policies/${id}/publish`, { method: "POST" });
  },
  acknowledgePolicy(id) {
    return request(`/api/policies/${id}/acknowledge`, { method: "POST" });
  },
  getPending() {
    return request("/api/pending");
  },
  getUsers() {
    return request("/api/users");
  },
  changeUserRole(id, role) {
    return request(`/api/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
  },
  getAuditLogs(params = {}) {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.date) query.set("date", params.date);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));
    return request(`/api/audit-logs${query.toString() ? `?${query.toString()}` : ""}`);
  },
  async exportAuditLogs() {
    const token = getToken();
    const response = await fetch("/api/audit-logs/export", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Unable to export audit logs.");
    }

    return response.text();
  },
};

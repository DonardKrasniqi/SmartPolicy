export function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatDate(value) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatDateShort(value) {
  return new Date(value).toLocaleDateString("en-US", {
    dateStyle: "medium",
  });
}

export function formatDateTimeCompact(value) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function statusBadge(status) {
  const map = {
    draft: "muted",
    review: "warning",
    approved: "primary",
    published: "success",
    signed: "success",
    pending: "warning",
  };

  return map[status] || "primary";
}

export function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export function formatRoleLabel(role = "") {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function getHashQuery() {
  const [, query = ""] = window.location.hash.split("?");
  return new URLSearchParams(query);
}

export function updateHashQuery(route, nextQuery = {}) {
  const params = new URLSearchParams();
  Object.entries(nextQuery).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  window.location.hash = `#/${route}${params.toString() ? `?${params.toString()}` : ""}`;
}

export function downloadText(filename, contents, type = "text/plain;charset=utf-8") {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

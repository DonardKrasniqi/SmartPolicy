import { escapeHtml } from "../utils.js";

const navItems = [
  { key: "dashboard", label: "Dashboard", href: "#/dashboard", roles: ["admin", "manager", "staff", "student", "auditor"] },
  { key: "policies", label: "Policies", href: "#/policies", roles: ["admin", "manager", "staff", "student", "auditor"] },
  { key: "pending", label: "Pending", href: "#/pending", roles: ["staff", "student"] },
  { key: "users", label: "Users", href: "#/users", roles: ["admin"] },
  { key: "audit", label: "Audit", href: "#/audit", roles: ["admin", "auditor"] },
];

export function renderLayout({ state, active, content }) {
  const availableNav = navItems.filter((item) => item.roles.includes(state.currentUser.role));

  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-badge">SP</div>
          <div>
            <h1 style="margin: 0;">${escapeHtml(state.config.institutionName)}</h1>
            <div style="opacity: 0.75;">${escapeHtml(state.config.portalTitle)}</div>
          </div>
        </div>

        <nav class="nav-list">
          ${availableNav
            .map(
              (item) =>
                `<a class="nav-link ${active === item.key ? "active" : ""}" href="${item.href}">${item.label}</a>`
            )
            .join("")}
        </nav>

        <div style="margin-top: 32px;">
          <div class="muted" style="color: rgba(255,255,255,0.65);">Signed in as</div>
          <div style="font-weight: 700; margin-top: 6px;">${escapeHtml(state.currentUser.name)}</div>
          <div style="opacity: 0.75;">${escapeHtml(state.currentUser.role)}</div>
          <button class="btn btn-secondary" id="logout-button" style="margin-top: 16px;">Log out</button>
        </div>
      </aside>

      <main class="main">${content}</main>
    </div>
  `;
}

import { escapeHtml, formatDate, formatDateShort, statusBadge } from "../utils.js";

export async function renderDashboard({ api, state }) {
  const data = await api.getDashboard();

  return {
    active: "dashboard",
    content: `
      <section class="hero">
        <div class="hero-header">
          <div>
            <div class="badge primary">Overview</div>
            <h1 class="page-title">Dashboard</h1>
            <p class="page-subtitle">A clear summary of policy activity, acknowledgements, and operational signals.</p>
          </div>
        </div>
      </section>

      <section class="card-grid">
        ${data.cards
          .map(
            (card) => `
              <article class="stat-card">
                <div class="badge ${card.tone}">${escapeHtml(card.label)}</div>
                <div class="stat-value" style="margin-top: 14px;">${escapeHtml(card.value)}</div>
              </article>
            `
          )
          .join("")}
      </section>

      <section class="grid-2" style="margin-top: 22px;">
        <article class="panel">
          <div class="section-header">
            <div>
              <h2 class="page-title" style="margin: 0;">Recent policies</h2>
              <p class="page-subtitle">Latest published items visible to your role.</p>
            </div>
          </div>
          <div class="policy-list">
            ${
              data.recentPolicies.length
                ? data.recentPolicies
                    .map(
                      (policy) => `
                        <div class="policy-card">
                          <div class="list-item">
                            <div>
                              <strong>${escapeHtml(policy.title)}</strong>
                              <div class="page-subtitle">Version ${escapeHtml(policy.version)} · ${formatDateShort(policy.updatedAt)}</div>
                            </div>
                            <span class="badge ${statusBadge(policy.status)}">${escapeHtml(policy.status)}</span>
                          </div>
                        </div>
                      `
                    )
                    .join("")
                : `<div class="muted">No published policies yet.</div>`
            }
          </div>
        </article>

        <article class="panel">
          <div class="section-header">
            <div>
              <h2 class="page-title" style="margin: 0;">Recent audit activity</h2>
              <p class="page-subtitle">${
                state.currentUser.role === "admin" || state.currentUser.role === "auditor"
                  ? "Latest traceable system actions."
                  : "Audit details are only available to administrators and auditors."
              }</p>
            </div>
          </div>
          <div class="policy-list">
            ${
              data.recentAuditLogs.length
                ? data.recentAuditLogs
                    .map(
                      (log) => `
                        <div class="policy-card">
                          <div><strong>${escapeHtml(log.action.replaceAll("_", " "))}</strong></div>
                          <div class="page-subtitle">${escapeHtml(log.userName)} · ${formatDate(log.timestamp)}</div>
                        </div>
                      `
                    )
                    .join("")
                : `<div class="muted">Nothing to display for your role on this panel.</div>`
            }
          </div>
        </article>
      </section>
    `,
  };
}

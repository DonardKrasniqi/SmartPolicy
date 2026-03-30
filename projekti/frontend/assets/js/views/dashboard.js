import { escapeHtml, formatDate, formatDateShort, statusBadge } from "../utils.js";

export async function renderDashboard({ api, state }) {
  const data = await api.getDashboard();
  if (typeof data.pendingCount === "number") {
    state.currentUser.pendingCount = data.pendingCount;
  }

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

      ${
        data.notifications?.length
          ? `
            <section class="panel" style="margin-top: 22px;">
              <div class="detail-stack">
                ${data.notifications
                  .map(
                    (item) => `
                      <div class="badge ${item.kind || "primary"}" style="justify-content:flex-start;">${escapeHtml(item.message)}</div>
                    `
                  )
                  .join("")}
              </div>
            </section>
          `
          : ``
      }

      ${
        data.newPublishedPolicies?.length
          ? `
            <section class="panel" style="margin-top: 22px;">
              <div class="section-header">
                <div>
                  <h2 class="page-title" style="margin: 0;">New policy published</h2>
                  <p class="page-subtitle">Newly published policy versions waiting for your acknowledgement.</p>
                </div>
                <a class="btn btn-primary" href="#/pending">Open pending</a>
              </div>
              <div class="policy-list" style="margin-top: 16px;">
                ${data.newPublishedPolicies
                  .map(
                    (policy) => `
                      <div class="policy-card">
                        <div class="list-item policy-card__row">
                          <div>
                            <strong>${escapeHtml(policy.title)}</strong>
                            <div class="page-subtitle">Version ${escapeHtml(policy.version)} • Published ${formatDateShort(policy.publishedAt)}</div>
                          </div>
                          <a class="btn btn-secondary" href="#/policies/${policy.id}">Review</a>
                        </div>
                      </div>
                    `
                  )
                  .join("")}
              </div>
            </section>
          `
          : ``
      }

      ${
        data.lowCompliancePolicies?.length
          ? `
            <section class="panel" style="margin-top: 22px;">
              <div class="section-header">
                <div>
                  <h2 class="page-title" style="margin: 0;">Low compliance policies</h2>
                  <p class="page-subtitle">Admin visibility into policy versions that still need acknowledgement follow-up.</p>
                </div>
              </div>
              <div class="policy-list" style="margin-top: 16px;">
                ${data.lowCompliancePolicies
                  .map(
                    (policy) => `
                      <div class="policy-card">
                        <div class="list-item policy-card__row">
                          <div>
                            <strong>${escapeHtml(policy.title)}</strong>
                            <div class="page-subtitle">Version ${escapeHtml(policy.version)} • ${policy.compliance.signed}/${policy.compliance.total} signed</div>
                          </div>
                          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                            <span class="badge warning">${policy.compliance.percentage}% complete</span>
                            <a class="btn btn-secondary" href="#/policies/${policy.id}">View compliance</a>
                          </div>
                        </div>
                      </div>
                    `
                  )
                  .join("")}
              </div>
            </section>
          `
          : ``
      }

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

import { escapeHtml, formatDate, formatDateShort, statusBadge } from "../utils.js";

function renderEmptyState({ title, message, action = "" }) {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">i</div>
      <div>
        <strong>${escapeHtml(title)}</strong>
        <div class="page-subtitle">${escapeHtml(message)}</div>
      </div>
      ${action}
    </div>
  `;
}

function renderDashboardCards(cards) {
  return `
    <section class="card-grid">
      ${cards
        .map(
          (card) => `
            <article class="stat-card">
              <div class="stat-card__meta">
                <div class="badge ${card.tone}">${escapeHtml(card.label)}</div>
              </div>
              <div class="stat-value" style="margin-top: 14px;">${escapeHtml(card.value)}</div>
              <div class="stat-card__hint">${escapeHtml(
                card.label === "Awaiting Signature"
                  ? "Policies still awaiting acknowledgement."
                  : card.label === "Completed Signatures"
                    ? "Recorded acknowledgements currently on file."
                    : card.label === "Compliance Rate"
                      ? "Completion across published policy obligations."
                      : card.label === "Awaiting Approval"
                        ? "Workflow items still awaiting review or publication."
                        : "Current operational summary for this area."
              )}</div>
            </article>
          `
        )
        .join("")}
    </section>
  `;
}

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
            <div class="eyebrow">Compliance overview</div>
            <h1 class="page-title">Dashboard</h1>
            <p class="page-subtitle">A formal summary of policy publication, acknowledgements, and operational compliance signals.</p>
          </div>
        </div>
      </section>

      ${renderDashboardCards(data.cards)}

      ${
        data.notifications?.length
          ? `
            <section class="panel section-block">
              <div class="detail-stack">
                ${data.notifications
                  .map(
                    (item) => `
                      <div class="callout ${item.kind || "info"}">
                        <strong>${item.kind === "warning" ? "Attention required" : "Portal update"}</strong>
                        <div class="page-subtitle">${escapeHtml(item.message)}</div>
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
        data.newPublishedPolicies?.length
          ? `
            <section class="panel section-block">
              <div class="split-header">
                <div>
                  <h2 class="page-title" style="margin: 0;">Newly published policies</h2>
                  <p class="page-subtitle">Policy versions currently waiting for acknowledgement.</p>
                </div>
                <a class="btn btn-primary" href="#/pending">Open acknowledgements</a>
              </div>
              <div class="policy-list" style="margin-top: 16px;">
                ${data.newPublishedPolicies
                  .map(
                    (policy) => `
                      <div class="policy-card">
                        <div class="list-item policy-card__row">
                          <div>
                            <strong>${escapeHtml(policy.title)}</strong>
                            <div class="page-subtitle">Version ${escapeHtml(policy.version)} - Published ${formatDateShort(policy.publishedAt)}</div>
                          </div>
                          <a class="btn btn-secondary" href="#/policies/${policy.id}">Acknowledge policy</a>
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
            <section class="panel section-block">
              <div class="section-header">
                <div>
                  <h2 class="page-title" style="margin: 0;">Low compliance policies</h2>
                  <p class="page-subtitle">Policies needing follow-up because completion is still below the expected acknowledgement target.</p>
                </div>
              </div>
              <div class="policy-list" style="margin-top: 16px;">
                ${data.lowCompliancePolicies
                  .map(
                    (policy) => `
                      <div class="policy-card policy-card--highlight">
                        <div class="list-item policy-card__row">
                          <div>
                            <strong>${escapeHtml(policy.title)}</strong>
                            <div class="page-subtitle">Version ${escapeHtml(policy.version)} - ${policy.compliance.signed}/${policy.compliance.total} acknowledged</div>
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

      <section class="grid-2 section-block">
        <article class="panel">
          <div class="section-header">
            <div>
              <h2 class="page-title" style="margin: 0;">Published policies</h2>
              <p class="page-subtitle">Current policy versions visible to your role.</p>
            </div>
          </div>
          <div class="policy-list">
            ${
              data.recentPolicies.length
                ? data.recentPolicies
                    .map(
                      (policy) => `
                        <div class="policy-card policy-card--neutral">
                          <div class="list-item">
                            <div>
                              <strong>${escapeHtml(policy.title)}</strong>
                              <div class="page-subtitle">Version ${escapeHtml(policy.version)} - ${formatDateShort(policy.updatedAt)}</div>
                            </div>
                            <span class="badge ${statusBadge(policy.status)}">${escapeHtml(policy.status)}</span>
                          </div>
                        </div>
                      `
                    )
                    .join("")
                : renderEmptyState({
                    title: "No policies available",
                    message: "Published policies will appear here when they are available to your role.",
                  })
            }
          </div>
        </article>

        <article class="panel">
          <div class="section-header">
            <div>
              <h2 class="page-title" style="margin: 0;">Recent audit activity</h2>
              <p class="page-subtitle">${
                state.currentUser.role === "admin" || state.currentUser.role === "auditor"
                  ? "Latest traceable actions recorded in the portal."
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
                        <div class="policy-card policy-card--neutral">
                          <div><strong>${escapeHtml(log.action.replaceAll("_", " "))}</strong></div>
                          <div class="page-subtitle">${escapeHtml(log.userName)} - ${formatDate(log.timestamp)}</div>
                        </div>
                      `
                    )
                    .join("")
                : renderEmptyState({
                    title: "No audit activity available",
                    message: "Recent audit activity will appear here when your role has access to reporting data.",
                  })
            }
          </div>
        </article>
      </section>
    `,
  };
}

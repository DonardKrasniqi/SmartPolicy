import { escapeHtml, formatDateShort } from "../utils.js";

function renderEmptyState({ title, message }) {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">i</div>
      <div>
        <strong>${escapeHtml(title)}</strong>
        <div class="page-subtitle">${escapeHtml(message)}</div>
      </div>
    </div>
  `;
}

export async function renderPending({ api, state }) {
  if (!["staff", "student"].includes(state.currentUser.role)) {
    return {
      active: "dashboard",
      content: `<section class="hero"><h1 class="page-title">Pending signatures are not available for your role.</h1></section>`,
    };
  }

  const data = await api.getPending();
  state.currentUser.pendingCount = data.pending.length;

  return {
    active: "pending",
    content: `
      <section class="hero">
        <div class="eyebrow">Acknowledgements</div>
        <h1 class="page-title">Acknowledge policies</h1>
        <p class="page-subtitle">Track policy versions still awaiting your acknowledgement and review the ones already recorded.</p>
      </section>

      <section class="card-grid">
        <article class="stat-card">
          <div class="badge warning">Pending</div>
          <div class="stat-value" style="margin-top: 14px;">${data.pending.length}</div>
        </article>
        <article class="stat-card">
          <div class="badge success">Completed</div>
          <div class="stat-value" style="margin-top: 14px;">${data.signed.length}</div>
        </article>
      </section>

      <section class="grid-2" style="margin-top: 22px;">
        <article class="panel">
          <h2 class="page-title" style="margin-top: 0;">Awaiting your action</h2>
          <div class="pending-stack">
            ${
              data.pending.length
                ? data.pending
                    .map(
                      (policy) => `
                        <div class="policy-card policy-card--neutral">
                          <div class="list-item">
                            <div>
                              <strong>${escapeHtml(policy.title)}</strong>
                              <div class="page-subtitle">${escapeHtml(policy.description || "No description provided.")}</div>
                              <div class="page-subtitle">Version ${escapeHtml(policy.version)} - Published ${formatDateShort(policy.publishedAt || policy.updatedAt)}</div>
                            </div>
                            <a class="btn btn-primary" href="#/policies/${policy.id}">Acknowledge policy</a>
                          </div>
                        </div>
                      `
                    )
                    .join("")
                : renderEmptyState({
                    title: "No pending acknowledgements",
                    message: "You are fully up to date on required policy acknowledgements.",
                  })
            }
          </div>
        </article>

        <article class="panel">
          <h2 class="page-title" style="margin-top: 0;">Already signed</h2>
          <div class="pending-stack">
            ${
              data.signed.length
                ? data.signed
                    .map(
                      (policy) => `
                        <div class="policy-card policy-card--neutral">
                          <strong>${escapeHtml(policy.title)}</strong>
                          <div class="page-subtitle">Version ${escapeHtml(policy.acknowledgement.policyVersion || policy.version)} - Acknowledged on ${formatDateShort(policy.acknowledgement.signedAt)}</div>
                        </div>
                      `
                    )
                    .join("")
                : renderEmptyState({
                    title: "No completed acknowledgements",
                    message: "Acknowledged policies will appear here after you confirm them.",
                  })
            }
          </div>
        </article>
      </section>
    `,
  };
}

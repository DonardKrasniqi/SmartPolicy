import { escapeHtml, formatDateShort } from "../utils.js";

export async function renderPending({ api, state }) {
  if (!["staff", "student"].includes(state.currentUser.role)) {
    return {
      active: "dashboard",
      content: `<section class="hero"><h1 class="page-title">Pending signatures are not available for your role.</h1></section>`,
    };
  }

  const data = await api.getPending();

  return {
    active: "pending",
    content: `
      <section class="hero">
        <h1 class="page-title">Pending acknowledgements</h1>
        <p class="page-subtitle">Track the policies you still need to review and the ones you have already signed.</p>
      </section>

      <section class="grid-2">
        <article class="panel">
          <h2 class="page-title" style="margin-top: 0;">Awaiting your action</h2>
          <div class="pending-stack">
            ${
              data.pending.length
                ? data.pending
                    .map(
                      (policy) => `
                        <div class="policy-card">
                          <div class="list-item">
                            <div>
                              <strong>${escapeHtml(policy.title)}</strong>
                              <div class="page-subtitle">${escapeHtml(policy.description || "No description provided.")}</div>
                            </div>
                            <a class="btn btn-primary" href="#/policies/${policy.id}">Review</a>
                          </div>
                        </div>
                      `
                    )
                    .join("")
                : `<div class="muted">You are fully up to date.</div>`
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
                        <div class="policy-card">
                          <strong>${escapeHtml(policy.title)}</strong>
                          <div class="page-subtitle">Signed on ${formatDateShort(policy.acknowledgement.signedAt)}</div>
                        </div>
                      `
                    )
                    .join("")
                : `<div class="muted">Signed policies will appear here.</div>`
            }
          </div>
        </article>
      </section>
    `,
  };
}

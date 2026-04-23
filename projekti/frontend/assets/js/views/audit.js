import { downloadText, escapeHtml, formatDate, getHashQuery, updateHashQuery } from "../utils.js";
import { showModal } from "../components/ui.js";

function buildAuditQueryFromUrl() {
  const params = getHashQuery();
  return {
    q: params.get("q") || "",
    date: params.get("date") || "",
    page: Number.parseInt(params.get("page") || "1", 10),
    pageSize: 12,
  };
}

function updateAuditQuery(nextQuery) {
  updateHashQuery("audit", {
    q: nextQuery.q || "",
    date: nextQuery.date || "",
    page: nextQuery.page && nextQuery.page > 1 ? String(nextQuery.page) : "",
  });
}

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

export async function renderAudit({ api, showToast, state, render }) {
  if (!["admin", "auditor"].includes(state.currentUser.role)) {
    return {
      active: "dashboard",
      content: `<section class="hero"><div class="error-state"><div class="error-state__icon">!</div><div><strong>Access restricted</strong><div class="page-subtitle">Audit reporting is only available to administrators and auditors.</div></div></div></section>`,
    };
  }

  const queryState = buildAuditQueryFromUrl();
  const data = await api.getAuditLogs(queryState);

  return {
    active: "audit",
    content: `
      <section class="hero">
        <div class="hero-header">
          <div>
            <div class="eyebrow">Audit reporting</div>
            <h1 class="page-title">Audit register</h1>
            <p class="page-subtitle">Formal reporting view for traceable system activity, filtered search, and export.</p>
          </div>
          <button class="btn btn-primary" id="export-audit-button">Export CSV</button>
        </div>
      </section>

      <section class="audit-summary-grid">
        <article class="stat-card">
          <div class="badge primary">Records shown</div>
          <div class="stat-value" style="margin-top: 14px;">${data.logs.length}</div>
          <div class="stat-card__hint">Records visible in the current result set.</div>
        </article>
        <article class="stat-card">
          <div class="badge info">Total records</div>
          <div class="stat-value" style="margin-top: 14px;">${data.pagination.total}</div>
          <div class="stat-card__hint">All matching records across pages.</div>
        </article>
        <article class="stat-card">
          <div class="badge muted">Page</div>
          <div class="stat-value" style="margin-top: 14px;">${data.pagination.page}</div>
          <div class="stat-card__hint">Current page in the audit register.</div>
        </article>
        <article class="stat-card">
          <div class="badge warning">Filtered by</div>
          <div class="stat-value" style="margin-top: 14px;">${escapeHtml(queryState.q || queryState.date || "None")}</div>
          <div class="stat-card__hint">Current search term or date filter.</div>
        </article>
      </section>

      <section class="panel section-block">
        <div class="audit-toolbar">
          <div class="section-header">
            <div>
              <h2 class="page-title" style="margin: 0;">Filters</h2>
              <p class="page-subtitle">Refine the audit register by keyword or date.</p>
            </div>
          </div>
          <form id="audit-filter-form" class="grid-3">
            <div class="field">
              <label for="audit-search">Search user or action</label>
              <input class="input" id="audit-search" value="${escapeHtml(queryState.q)}" placeholder="Search by user, role, action, or IP" />
            </div>
            <div class="field">
              <label for="audit-date">Date</label>
              <input class="input" id="audit-date" type="date" value="${escapeHtml(queryState.date)}" />
            </div>
            <div class="field" style="align-self:end;">
              <div class="button-row">
                <button class="btn btn-primary" type="submit">Apply filters</button>
                <button class="btn btn-secondary" type="button" id="clear-audit-filters">Clear filters</button>
              </div>
            </div>
          </form>
        </div>
      </section>

      <section class="table-card table-card--audit section-block">
        <div class="table-card__header">
          <div class="section-header">
            <div>
              <h2 class="page-title" style="margin: 0;">Audit log entries</h2>
              <p class="page-subtitle">Detailed register of traceable policy and system activity.</p>
            </div>
          </div>
        </div>
        ${
          data.logs.length
            ? `
              <div class="table-wrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>User</th>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>IP address</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${data.logs
                      .map(
                        (log, index) => `
                          <tr>
                            <td>${formatDate(log.timestamp)}</td>
                            <td>
                              <div><strong>${escapeHtml(log.userName)}</strong></div>
                              <div class="page-subtitle">${escapeHtml(log.userRole)}</div>
                            </td>
                            <td><span class="badge info">${escapeHtml(log.action.replaceAll("_", " "))}</span></td>
                            <td>${escapeHtml(log.entity)}</td>
                            <td>${escapeHtml(log.ipAddress)}</td>
                            <td><button class="btn btn-secondary" data-audit-index="${index}">View details</button></td>
                          </tr>
                        `
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>
            `
            : `
              <div style="padding: 22px;">
                ${renderEmptyState({
                  title: "No audit logs found",
                  message: "No records matched the current audit filters.",
                })}
              </div>
            `
        }
        <div class="table-card__footer">
          <div class="section-header">
            <div class="page-subtitle">Page ${data.pagination.page} of ${data.pagination.totalPages} - ${data.pagination.total} total record(s)</div>
            <div class="button-row">
              <button class="btn btn-secondary" id="audit-prev-page" ${data.pagination.page <= 1 ? "disabled" : ""}>Previous page</button>
              <button class="btn btn-secondary" id="audit-next-page" ${data.pagination.page >= data.pagination.totalPages ? "disabled" : ""}>Next page</button>
            </div>
          </div>
        </div>
      </section>
    `,
    bind() {
      document.getElementById("export-audit-button")?.addEventListener("click", async () => {
        try {
          const csv = await api.exportAuditLogs();
          downloadText(`audit-logs-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8");
          showToast("Audit log export downloaded.", "success");
        } catch (error) {
          showToast(error.message, "error");
        }
      });

      document.getElementById("audit-filter-form")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        updateAuditQuery({
          q: document.getElementById("audit-search").value.trim(),
          date: document.getElementById("audit-date").value,
          page: 1,
        });
        await render();
      });

      document.getElementById("clear-audit-filters")?.addEventListener("click", async () => {
        updateAuditQuery({ q: "", date: "", page: 1 });
        await render();
      });

      document.getElementById("audit-prev-page")?.addEventListener("click", async () => {
        updateAuditQuery({ ...queryState, page: Math.max(1, data.pagination.page - 1) });
        await render();
      });

      document.getElementById("audit-next-page")?.addEventListener("click", async () => {
        updateAuditQuery({ ...queryState, page: Math.min(data.pagination.totalPages, data.pagination.page + 1) });
        await render();
      });

      document.querySelectorAll("[data-audit-index]").forEach((button) => {
        button.addEventListener("click", () => {
          const log = data.logs[Number(button.dataset.auditIndex)];
          showModal({
            title: "Audit log details",
            body: `
              <div class="detail-stack">
                <div><strong>Timestamp:</strong> ${formatDate(log.timestamp)}</div>
                <div><strong>User:</strong> ${escapeHtml(log.userName)} (${escapeHtml(log.userRole)})</div>
                <div><strong>Action:</strong> ${escapeHtml(log.action)}</div>
                <div><strong>Entity:</strong> ${escapeHtml(log.entity)} / ${escapeHtml(log.entityId || "N/A")}</div>
                <div><strong>IP address:</strong> ${escapeHtml(log.ipAddress)}</div>
                <div><strong>Metadata:</strong><pre>${escapeHtml(JSON.stringify(log.metadata || {}, null, 2))}</pre></div>
              </div>
            `,
          });
        });
      });
    },
  };
}

import { downloadText, escapeHtml, formatDate } from "../utils.js";
import { showModal } from "../components/ui.js";

function buildAuditQueryFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    q: params.get("q") || "",
    date: params.get("date") || "",
    page: Number.parseInt(params.get("page") || "1", 10),
    pageSize: 12,
  };
}

function updateAuditQuery(nextQuery) {
  const params = new URLSearchParams();
  if (nextQuery.q) params.set("q", nextQuery.q);
  if (nextQuery.date) params.set("date", nextQuery.date);
  if (nextQuery.page && nextQuery.page > 1) params.set("page", String(nextQuery.page));
  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState({}, "", nextUrl);
}

export async function renderAudit({ api, showToast, state, render }) {
  if (!["admin", "auditor"].includes(state.currentUser.role)) {
    return {
      active: "dashboard",
      content: `<section class="hero"><h1 class="page-title">Audit logs are only available to administrators and auditors.</h1></section>`,
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
            <h1 class="page-title">Audit log register</h1>
            <p class="page-subtitle">Searchable, paginated activity history filtered by user, action, or date.</p>
          </div>
          <button class="btn btn-primary" id="export-audit-button">Export CSV</button>
        </div>
      </section>

      <section class="panel" style="margin-bottom:20px;">
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
              <button class="btn btn-secondary" type="button" id="clear-audit-filters">Clear</button>
            </div>
          </div>
        </form>
      </section>

      <section class="table-card">
        <table class="table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Action</th>
              <th>Entity</th>
              <th>IP</th>
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
                    <td>${escapeHtml(log.action)}</td>
                    <td>${escapeHtml(log.entity)}</td>
                    <td>${escapeHtml(log.ipAddress)}</td>
                    <td><button class="btn btn-secondary" data-audit-index="${index}">View</button></td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
        ${
          data.logs.length === 0
            ? `<div class="muted" style="padding-top:16px;">No audit records matched the current filters.</div>`
            : ``
        }
        <div class="hero-header" style="margin-top:18px;">
          <div class="page-subtitle">Page ${data.pagination.page} of ${data.pagination.totalPages} · ${data.pagination.total} total record(s)</div>
          <div class="button-row">
            <button class="btn btn-secondary" id="audit-prev-page" ${data.pagination.page <= 1 ? "disabled" : ""}>Previous</button>
            <button class="btn btn-secondary" id="audit-next-page" ${data.pagination.page >= data.pagination.totalPages ? "disabled" : ""}>Next</button>
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
                <div><strong>IP Address:</strong> ${escapeHtml(log.ipAddress)}</div>
                <div><strong>Metadata:</strong><pre>${escapeHtml(JSON.stringify(log.metadata || {}, null, 2))}</pre></div>
              </div>
            `,
          });
        });
      });
    },
  };
}

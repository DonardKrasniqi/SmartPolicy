import { showModal } from "../components/ui.js";
import {
  escapeHtml,
  formatDate,
  formatDateShort,
  formatDateTimeCompact,
  formatRoleLabel,
  getHashQuery,
  statusBadge,
  updateHashQuery,
} from "../utils.js";

const ACK_STORAGE_KEY = "smartpolicy-last-acknowledgement";

function renderWorkflowTracker(stages) {
  return `
    <div class="button-row" style="margin-top: 14px;">
      ${stages
        .map(
          (stage) => `
            <div class="badge ${stage.completed ? "success" : stage.active ? "warning" : "muted"}">${escapeHtml(stage.label)}</div>
          `
        )
        .join("")}
    </div>
  `;
}

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

function saveAcknowledgementConfirmation(acknowledgement) {
  sessionStorage.setItem(ACK_STORAGE_KEY, JSON.stringify(acknowledgement));
}

function getAcknowledgementConfirmation(policyId) {
  const raw = sessionStorage.getItem(ACK_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed.policyId === policyId ? parsed : null;
  } catch {
    return null;
  }
}

function buildPolicyFilterState() {
  const query = getHashQuery();
  return {
    status: query.get("status") || "all",
  };
}

function renderPolicyCards(policies, state) {
  if (!policies.length) {
    return renderEmptyState({
      title: "No policies available",
      message: "Policies matching this filter will appear here when they are available.",
    });
  }

  const canEdit = state.currentUser.role === "admin";

  return `
    <div class="policy-list">
      ${policies
        .map(
          (policy) => `
            <article class="policy-card policy-card--neutral">
              <div class="list-item policy-card__row">
                <div style="flex:1;">
                  <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                    <strong>${escapeHtml(policy.title)}</strong>
                    <span class="badge ${statusBadge(policy.status)}">${escapeHtml(policy.status)}</span>
                    <span class="badge muted">Version ${escapeHtml(policy.version)}</span>
                    ${policy.signed ? `<span class="badge success">Acknowledged</span>` : ``}
                    ${policy.versionHistory?.length ? `<span class="badge info">${policy.versionHistory.length} archived</span>` : ``}
                  </div>
                  <div class="page-subtitle">${escapeHtml(policy.description || "No description provided.")}</div>
                  <div class="page-subtitle">Updated ${formatDateShort(policy.updatedAt)}</div>
                  ${renderWorkflowTracker(policy.workflowStages || [])}
                </div>
                <div class="button-row">
                  <a class="btn btn-secondary" href="#/policies/${policy.id}">Open policy</a>
                  ${canEdit ? `<a class="btn btn-primary" href="#/policies/${policy.id}/edit">Edit policy</a>` : ``}
                </div>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

async function renderPoliciesList({ api, state }) {
  const data = await api.getPolicies();
  const filterState = buildPolicyFilterState();
  const canCreate = state.currentUser.role === "admin";
  const statuses = ["all", "draft", "review", "approved", "published"];
  const filteredPolicies =
    filterState.status === "all" ? data.policies : data.policies.filter((policy) => policy.status === filterState.status);

  return {
    active: "policies",
    content: `
      <section class="hero">
        <div class="hero-header">
          <div>
            <div class="eyebrow">Policy library</div>
            <h1 class="page-title">Policies</h1>
            <p class="page-subtitle">Centralized policy documents with formal workflow, acknowledgements, and version history.</p>
          </div>
          ${canCreate ? `<a class="btn btn-primary" href="#/policies/new">Create policy</a>` : ``}
        </div>
      </section>

      <section class="panel">
        <div class="section-header">
          <div>
            <h2 class="page-title" style="margin: 0;">Filter policies</h2>
            <p class="page-subtitle">View policy records by workflow status.</p>
          </div>
        </div>
        <form id="policy-filter-form" class="grid-3" style="margin-top: 16px;">
          <div class="field">
            <label for="policy-status-filter">Status</label>
            <select class="select" id="policy-status-filter">
              ${statuses
                .map(
                  (status) =>
                    `<option value="${status}" ${status === filterState.status ? "selected" : ""}>${
                      status === "all" ? "All statuses" : formatRoleLabel(status)
                    }</option>`
                )
                .join("")}
            </select>
          </div>
        </form>
      </section>

      <section class="section-block">
        ${renderPolicyCards(filteredPolicies, state)}
      </section>
    `,
    bind() {
      document.getElementById("policy-status-filter")?.addEventListener("change", () => {
        updateHashQuery("policies", {
          status: document.getElementById("policy-status-filter").value === "all" ? "" : document.getElementById("policy-status-filter").value,
        });
      });
    },
  };
}

function editorToolbar() {
  return `
    <div class="editor-toolbar">
      <button type="button" data-editor-command="bold">Bold</button>
      <button type="button" data-editor-command="italic">Italic</button>
      <button type="button" data-editor-command="insertUnorderedList">Bullets</button>
      <button type="button" data-editor-command="insertOrderedList">Numbers</button>
    </div>
  `;
}

function renderVersionHistory(versionHistory) {
  return `
    <section class="panel">
      <div class="policy-section__header">
        <div>
          <div class="eyebrow">Version history</div>
          <h2 class="page-title" style="margin: 6px 0 0;">Archived versions</h2>
          <p class="page-subtitle">Snapshots captured whenever policy content is materially changed.</p>
        </div>
        <div class="badge info">${versionHistory.length} archived</div>
      </div>
      <div class="detail-stack">
        ${
          versionHistory.length
            ? versionHistory
                .map(
                  (version, index) => `
                    <article class="policy-card policy-card--neutral">
                      <div class="list-item policy-card__row">
                        <div>
                          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                            <strong>Version ${escapeHtml(version.version)}</strong>
                            <span class="badge muted">Archived ${formatDateShort(version.archivedAt)}</span>
                          </div>
                          <div class="page-subtitle">Archived by ${escapeHtml(version.archivedByName || "Unknown user")}</div>
                          <div class="page-subtitle">${escapeHtml(version.description || "No description saved for this version.")}</div>
                        </div>
                        <button class="btn btn-secondary" type="button" data-version-index="${index}">View archived version</button>
                      </div>
                    </article>
                  `
                )
                .join("")
            : renderEmptyState({
                title: "No archived versions yet",
                message: "Archived versions will appear here after the policy content is updated.",
              })
        }
      </div>
    </section>
  `;
}

function renderAcknowledgementSummary(policy, latestAcknowledgement) {
  if (!policy.acknowledgement && !latestAcknowledgement) {
    return "";
  }

  const signed = latestAcknowledgement || policy.acknowledgement;
  return `
    <section class="panel">
      <div class="policy-section__header">
        <div>
          <div class="eyebrow">Acknowledgement</div>
          <h2 class="page-title" style="margin: 6px 0 0;">Acknowledgement recorded</h2>
          <p class="page-subtitle">This policy version has already been acknowledged and stored for audit review.</p>
        </div>
        <span class="badge success">Version ${escapeHtml(signed.policyVersion || policy.version)}</span>
      </div>
      <div class="metric-grid">
        <div class="metric-panel">
          <div class="page-subtitle">Acknowledged on</div>
          <strong>${escapeHtml(formatDateShort(signed.signedAt))}</strong>
        </div>
        <div class="metric-panel">
          <div class="page-subtitle">Recorded version</div>
          <strong>${escapeHtml(signed.policyVersion || policy.version)}</strong>
        </div>
        <div class="metric-panel">
          <div class="page-subtitle">Recorded from IP</div>
          <strong style="font-size:1.1rem;">${escapeHtml(signed.ipAddress || "Not captured")}</strong>
        </div>
      </div>
    </section>
  `;
}

async function renderPolicyEditor({ api, route, showToast, go, render }) {
  const isNew = route === "policies/new";
  const policyId = isNew ? null : route.match(/^policies\/([^/]+)\/edit$/)?.[1];
  const policy = isNew ? null : await api.getPolicy(policyId);
  const statusLocked = policy && ["approved", "published"].includes(policy.status);
  const statusField = statusLocked
    ? `
            <div class="field">
              <label>Workflow status</label>
              <div><span class="badge ${statusBadge(policy.status)}">${escapeHtml(policy.status)}</span></div>
              <input type="hidden" id="policy-status" value="${escapeHtml(policy.status)}" />
              <p class="page-subtitle">Use Approve and Publish on the policy page to move the workflow. Editing content does not change status here.</p>
            </div>
          `
    : `
            <div class="field">
              <label for="policy-status">Status</label>
              <select class="select" id="policy-status">
                <option value="draft" ${policy?.status === "draft" ? "selected" : ""}>Draft</option>
                <option value="review" ${policy?.status === "review" ? "selected" : ""}>Send to review</option>
              </select>
            </div>
          `;
  const versionBumpField = !isNew
    ? `
          <div class="field">
            <label for="policy-version-bump">Version change (content updates)</label>
            <select class="select" id="policy-version-bump">
              <option value="none">No version bump (typos and minor text fixes only)</option>
              <option value="minor" selected>Minor version bump (material edits)</option>
              <option value="major">Major version bump (substantive change)</option>
            </select>
            <p class="page-subtitle">A minor/major bump archives the previous content snapshot for audit.</p>
          </div>
        `
    : "";

  return {
    active: "policies",
    content: `
      <section class="hero">
        <div class="detail-header">
          <div>
            <div class="eyebrow">${isNew ? "New policy" : "Policy editing"}</div>
            <h1 class="page-title">${isNew ? "Create policy" : "Edit policy"}</h1>
            <p class="page-subtitle">${isNew ? "Create a new formal policy record." : `Updating ${escapeHtml(policy.title)}.`}</p>
          </div>
          <a class="btn btn-secondary" href="#/policies">Back to list</a>
        </div>
      </section>

      <section class="detail-card">
        <form id="policy-form" class="form-grid">
          <div class="grid-2">
            <div class="field">
              <label for="policy-title">Policy title</label>
              <input class="input" id="policy-title" value="${escapeHtml(policy?.title || "")}" required />
            </div>
            ${statusField}
          </div>
          ${versionBumpField}

          <div class="field">
            <label for="policy-description">Description</label>
            <textarea class="textarea" id="policy-description">${escapeHtml(policy?.description || "")}</textarea>
          </div>

          <div class="field">
            <label>Policy content</label>
            ${editorToolbar()}
            <div id="policy-content" class="editor policy-content" contenteditable="true">${policy?.content || "<p>Enter policy content here...</p>"}</div>
          </div>

          <div class="button-row">
            <button class="btn btn-primary" type="submit">${isNew ? "Create policy" : "Save changes"}</button>
            ${
              !isNew
                ? `<button class="btn btn-success" type="button" id="publish-policy-button" ${policy.canPublish ? "" : "disabled"}>Publish final version</button>`
                : ``
            }
          </div>
          ${
            !isNew && !policy.canPublish
              ? `<div class="page-subtitle">Publication remains locked until the policy is approved in the review workflow.</div>`
              : ``
          }
        </form>
      </section>
    `,
    bind() {
      document.querySelectorAll("[data-editor-command]").forEach((button) => {
        button.addEventListener("click", () => {
          document.execCommand(button.dataset.editorCommand, false, null);
          document.getElementById("policy-content").focus();
        });
      });

      document.getElementById("policy-form")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const payload = {
          title: document.getElementById("policy-title").value,
          description: document.getElementById("policy-description").value,
          status: document.getElementById("policy-status").value,
          content: document.getElementById("policy-content").innerHTML,
          versionBump: document.getElementById("policy-version-bump") ? document.getElementById("policy-version-bump").value : "minor",
        };

        try {
          if (isNew) {
            await api.createPolicy(payload);
            showToast("Policy created successfully.", "success");
            go("policies");
            return;
          }

          await api.updatePolicy(policyId, payload);
          showToast("Policy updated successfully.", "success");
          go(`policies/${policyId}`);
        } catch (error) {
          showToast(error.message, "error");
        }
      });

      document.getElementById("publish-policy-button")?.addEventListener("click", () => {
        showModal({
          title: "Publish policy",
          body: "Publishing will make this policy available for formal acknowledgement in the portal.",
          actions: [
            {
              label: "Publish final version",
              onClick: async () => {
                try {
                  await api.publishPolicy(policyId);
                  showToast("Policy published successfully.", "success");
                  await render();
                } catch (error) {
                  showToast(error.message, "error");
                }
              },
            },
          ],
        });
      });
    },
  };
}

async function renderPolicyDetails({ api, route, showToast, render, state }) {
  const policyId = route.match(/^policies\/([^/]+)$/)?.[1];
  const policy = await api.getPolicy(policyId);
  const percentage = policy.compliance?.percentage ?? 0;
  const latestAcknowledgement = getAcknowledgementConfirmation(policy.id);
  const isAdmin = state.currentUser.role === "admin";
  const isManager = state.currentUser.role === "manager";

  return {
    active: "policies",
    content: `
      <section class="hero policy-header-card">
        <div class="detail-header">
          <div>
            <div class="eyebrow">Policy record</div>
            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-top: 10px;">
              <h1 class="page-title" style="margin:0;">${escapeHtml(policy.title)}</h1>
              <span class="badge ${statusBadge(policy.status)}">${escapeHtml(policy.status)}</span>
              <span class="badge info">Version ${escapeHtml(policy.version)}</span>
            </div>
            <p class="page-subtitle" style="margin-top: 12px;">
              Created by ${escapeHtml(policy.createdByName || "Unknown user")}
              ${policy.approvedByName ? ` - Approved by ${escapeHtml(policy.approvedByName)}` : ""}
              - Updated ${formatDate(policy.updatedAt)}
            </p>
            ${renderWorkflowTracker(policy.workflowStages || [])}
          </div>
          <div class="button-row">
            <a class="btn btn-secondary" href="#/policies">Back to policies</a>
            ${policy.canEdit ? `<a class="btn btn-primary" href="#/policies/${policy.id}/edit">Edit policy</a>` : ``}
            ${policy.canApprove ? `<button class="btn btn-success" id="approve-policy-button">Approve policy</button>` : ``}
          </div>
        </div>
      </section>

      <section class="policy-detail-grid">
        ${
          policy.compliance
            ? `
              <section class="panel">
                <div class="policy-section__header">
                  <div>
                    <div class="eyebrow">Compliance overview</div>
                    <h2 class="page-title" style="margin: 6px 0 0;">Acknowledgement progress</h2>
                    <p class="page-subtitle">${policy.compliance.signed} of ${policy.compliance.total} applicable users have acknowledged this version.</p>
                  </div>
                  <span class="badge ${policy.compliance.isLowCompliance ? "warning" : "success"}">${percentage}% complete</span>
                </div>
                <div class="progress ${policy.compliance.isLowCompliance ? "warning" : ""}"><span style="width: ${percentage}%"></span></div>
                <div class="metric-grid section-block">
                  <div class="metric-panel">
                    <div class="page-subtitle">Acknowledged</div>
                    <strong>${policy.compliance.signed}</strong>
                  </div>
                  <div class="metric-panel">
                    <div class="page-subtitle">Pending</div>
                    <strong>${policy.compliance.pending}</strong>
                  </div>
                  <div class="metric-panel">
                    <div class="page-subtitle">Completion</div>
                    <strong>${percentage}%</strong>
                  </div>
                </div>
                ${
                  isAdmin && policy.compliance.isLowCompliance
                    ? `<div class="callout warning section-block"><strong>Low compliance</strong><div class="page-subtitle">${policy.compliance.pending} user(s) still need to acknowledge this policy.</div></div>`
                    : ``
                }
              </section>
            `
            : ``
        }

        ${renderAcknowledgementSummary(policy, latestAcknowledgement)}

        ${
          policy.canAcknowledge
            ? `
              <section class="panel">
                <div class="policy-section__header">
                  <div>
                    <div class="eyebrow">Acknowledgement</div>
                    <h2 class="page-title" style="margin: 6px 0 0;">Acknowledge policy</h2>
                    <p class="page-subtitle">You are acknowledging version ${escapeHtml(policy.version)}. The confirmation will be recorded with a timestamp for audit review.</p>
                  </div>
                  <span class="badge info">Version ${escapeHtml(policy.version)}</span>
                </div>
                <label style="display:flex; gap:12px; align-items:flex-start;">
                  <input type="checkbox" id="acknowledge-check" />
                  <span>I have read, understood, and agree to comply with this policy. My acknowledgement will be stored for audit purposes.</span>
                </label>
                <button class="btn btn-primary" id="acknowledge-button" style="margin-top:16px;" disabled>Acknowledge policy</button>
              </section>
            `
            : ``
        }

        <section class="detail-card policy-content-shell">
          <div class="policy-section__header">
            <div>
              <div class="eyebrow">Policy content</div>
              <h2 class="page-title" style="margin: 6px 0 0;">Document</h2>
              <p class="page-subtitle">Formal policy text for review and acknowledgement.</p>
            </div>
          </div>
          <div class="policy-content">${policy.content}</div>
        </section>

        ${
          policy.compliance
            ? `
              <section class="grid-2">
                <article class="panel">
                  <div class="policy-section__header">
                    <div>
                      <div class="eyebrow">Acknowledged users</div>
                      <h2 class="page-title" style="margin: 6px 0 0;">Completed acknowledgements</h2>
                    </div>
                  </div>
                  <div class="detail-stack">
                    ${
                      policy.compliance.signedUsers.length
                        ? policy.compliance.signedUsers
                            .map(
                              (user) => `
                                <div class="policy-card policy-card--neutral">
                                  <div class="list-item policy-card__row">
                                    <div>
                                      <strong>${escapeHtml(user.name)}</strong>
                                      <div class="page-subtitle">${escapeHtml(formatRoleLabel(user.role))}</div>
                                    </div>
                                    <div class="page-subtitle">Acknowledged ${formatDateShort(user.signedAt)} - v${escapeHtml(user.policyVersion || policy.version)}</div>
                                  </div>
                                </div>
                              `
                            )
                            .join("")
                        : renderEmptyState({
                            title: "No acknowledgements recorded",
                            message: "Acknowledged users will appear here once responses are submitted.",
                          })
                    }
                  </div>
                </article>
                <article class="panel">
                  <div class="policy-section__header">
                    <div>
                      <div class="eyebrow">Pending users</div>
                      <h2 class="page-title" style="margin: 6px 0 0;">Awaiting acknowledgement</h2>
                    </div>
                  </div>
                  <div class="detail-stack">
                    ${
                      policy.compliance.pendingUsers.length
                        ? policy.compliance.pendingUsers
                            .map(
                              (user) => `
                                <div class="policy-card policy-card--neutral">
                                  <div class="list-item policy-card__row">
                                    <span><strong>${escapeHtml(user.name)}</strong></span>
                                    <span class="page-subtitle">${escapeHtml(formatRoleLabel(user.role))}</span>
                                  </div>
                                </div>
                              `
                            )
                            .join("")
                        : renderEmptyState({
                            title: "Everyone has acknowledged",
                            message: "There are no pending users for this policy version.",
                          })
                    }
                  </div>
                </article>
              </section>
            `
            : ``
        }

        ${(isAdmin || isManager || state.currentUser.role === "auditor") ? renderVersionHistory(policy.versionHistory || []) : ``}
      </section>
    `,
    bind() {
      const checkbox = document.getElementById("acknowledge-check");
      const button = document.getElementById("acknowledge-button");
      if (checkbox && button) {
        checkbox.addEventListener("change", () => {
          button.disabled = !checkbox.checked;
        });
        button.addEventListener("click", async () => {
          try {
            const acknowledgement = await api.acknowledgePolicy(policy.id);
            saveAcknowledgementConfirmation(acknowledgement);
            state.currentUser.pendingCount = Math.max(Number(state.currentUser.pendingCount || 1) - 1, 0);
            showToast(`Acknowledged policy version ${acknowledgement.policyVersion}.`, "success");
            await render();
          } catch (error) {
            showToast(error.message, "error");
          }
        });
      }

      document.getElementById("approve-policy-button")?.addEventListener("click", () => {
        showModal({
          title: "Approve policy",
          body: "Approving this policy will move it forward to the final publication step for administrators.",
          actions: [
            {
              label: "Approve policy",
              onClick: async () => {
                try {
                  await api.approvePolicy(policy.id);
                  showToast("Policy approved successfully.", "success");
                  await render();
                } catch (error) {
                  showToast(error.message, "error");
                }
              },
            },
          ],
        });
      });

      document.querySelectorAll("[data-version-index]").forEach((button) => {
        button.addEventListener("click", () => {
          const version = policy.versionHistory[Number(button.dataset.versionIndex)];
          showModal({
            title: `${policy.title} - Version ${version.version}`,
            body: `
              <div class="detail-stack">
                <div class="page-subtitle">Archived ${formatDateTimeCompact(version.archivedAt)} by ${escapeHtml(version.archivedByName || "Unknown user")}</div>
                <div class="page-subtitle">${escapeHtml(version.description || "No description saved for this version.")}</div>
                <div class="detail-card" style="padding: 18px; margin-top: 12px;">
                  <div class="policy-content">${version.content}</div>
                </div>
              </div>
            `,
          });
        });
      });
    },
  };
}

export async function renderPoliciesRoute(context) {
  if (context.route === "policies") {
    return renderPoliciesList(context);
  }

  if (context.route === "policies/new" || /^policies\/[^/]+\/edit$/.test(context.route)) {
    if (context.state.currentUser.role !== "admin") {
      return {
        active: "policies",
        content: `<section class="hero"><div class="error-state"><div class="error-state__icon">!</div><div><strong>Access restricted</strong><div class="page-subtitle">Only administrators can edit policy records.</div></div></div></section>`,
      };
    }
    return renderPolicyEditor(context);
  }

  if (/^policies\/[^/]+$/.test(context.route)) {
    return renderPolicyDetails(context);
  }

  return {
    active: "policies",
    content: `<section class="hero"><div class="error-state"><div class="error-state__icon">!</div><div><strong>Policy page not found</strong><div class="page-subtitle">The requested policy page is not available.</div></div></div></section>`,
  };
}

import { showModal } from "../components/ui.js";
import { escapeHtml, formatDate, formatDateShort, statusBadge } from "../utils.js";

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

function renderPolicyCards(policies, state) {
  if (!policies.length) {
    return `<div class="panel"><div class="muted">No policies are available yet.</div></div>`;
  }

  const canEdit = state.currentUser.role === "admin";

  return `
    <div class="policy-list">
      ${policies
        .map(
          (policy) => `
            <article class="policy-card">
              <div class="list-item">
                <div style="flex:1;">
                  <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                    <strong>${escapeHtml(policy.title)}</strong>
                    <span class="badge ${statusBadge(policy.status)}">${escapeHtml(policy.status)}</span>
                    ${policy.signed ? `<span class="badge success">signed</span>` : ``}
                  </div>
                  <div class="page-subtitle">${escapeHtml(policy.description || "No description provided.")}</div>
                  <div class="page-subtitle">Version ${escapeHtml(policy.version)} · Updated ${formatDateShort(policy.updatedAt)}</div>
                  ${renderWorkflowTracker(policy.workflowStages || [])}
                </div>
                <div class="button-row">
                  <a class="btn btn-secondary" href="#/policies/${policy.id}">Open</a>
                  ${canEdit ? `<a class="btn btn-primary" href="#/policies/${policy.id}/edit">Edit</a>` : ``}
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
  const canCreate = state.currentUser.role === "admin";

  return {
    active: "policies",
    content: `
      <section class="hero">
        <div class="hero-header">
          <div>
            <h1 class="page-title">Policy library</h1>
            <p class="page-subtitle">Centralized policy documents with draft, review, approval, final publication, and acknowledgement flow.</p>
          </div>
          ${canCreate ? `<a class="btn btn-primary" href="#/policies/new">Create policy</a>` : ``}
        </div>
      </section>
      ${renderPolicyCards(data.policies, state)}
    `,
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

async function renderPolicyEditor({ api, route, showToast, go, render }) {
  const isNew = route === "policies/new";
  const policyId = isNew ? null : route.match(/^policies\/([^/]+)\/edit$/)?.[1];
  const policy = isNew ? null : await api.getPolicy(policyId);

  return {
    active: "policies",
    content: `
      <section class="hero">
        <div class="detail-header">
          <div>
            <h1 class="page-title">${isNew ? "Create policy" : "Edit policy"}</h1>
            <p class="page-subtitle">${isNew ? "Draft a new policy document in the workshop." : `Updating ${escapeHtml(policy.title)}.`}</p>
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
            <div class="field">
              <label for="policy-status">Status</label>
              <select class="select" id="policy-status">
                <option value="draft" ${policy?.status === "draft" ? "selected" : ""}>Draft</option>
                <option value="review" ${policy?.status === "review" ? "selected" : ""}>Review</option>
                <option value="approved" ${policy?.status === "approved" ? "selected" : ""}>Approved</option>
              </select>
            </div>
          </div>

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
              ? `<div class="page-subtitle">Publishing is locked until a manager approves the policy in review.</div>`
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
        };

        try {
          if (isNew) {
            await api.createPolicy(payload);
            showToast("Policy created successfully.", "success");
          } else {
            await api.updatePolicy(policyId, payload);
            showToast("Policy updated successfully.", "success");
          }
          go("policies");
        } catch (error) {
          showToast(error.message, "error");
        }
      });

      document.getElementById("publish-policy-button")?.addEventListener("click", () => {
        showModal({
          title: "Publish policy",
          body: "Publishing will move this policy to the final stage and make it available to staff and students for acknowledgement.",
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
  const percentage = policy.compliance?.total
    ? Math.round((policy.compliance.signed / policy.compliance.total) * 100)
    : 0;

  return {
    active: "policies",
    content: `
      <section class="hero">
        <div class="detail-header">
          <div>
            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
              <h1 class="page-title" style="margin:0;">${escapeHtml(policy.title)}</h1>
              <span class="badge ${statusBadge(policy.status)}">${escapeHtml(policy.status)}</span>
            </div>
            <p class="page-subtitle">Version ${escapeHtml(policy.version)} · Updated ${formatDate(policy.updatedAt)}</p>
            ${renderWorkflowTracker(policy.workflowStages || [])}
          </div>
          <div class="button-row">
            <a class="btn btn-secondary" href="#/policies">Back</a>
            ${policy.canEdit ? `<a class="btn btn-primary" href="#/policies/${policy.id}/edit">Edit</a>` : ``}
            ${policy.canApprove ? `<button class="btn btn-success" id="approve-policy-button">Approve</button>` : ``}
          </div>
        </div>
      </section>

      ${
        policy.compliance
          ? `
            <section class="panel" style="margin-bottom: 20px;">
              <div class="section-header">
                <div>
                  <h2 class="page-title" style="margin: 0;">Compliance overview</h2>
                  <p class="page-subtitle">${policy.compliance.signed} of ${policy.compliance.total} applicable users have signed.</p>
                </div>
                <span class="badge success">${percentage}% complete</span>
              </div>
              <div class="progress" style="margin-top: 16px;"><span style="width: ${percentage}%"></span></div>
            </section>
          `
          : ``
      }

      ${
        policy.acknowledgement
          ? `
            <section class="panel" style="margin-bottom: 20px;">
              <div class="badge success">Acknowledged</div>
              <p class="page-subtitle">Signed on ${formatDate(policy.acknowledgement.signedAt)} from IP ${escapeHtml(policy.acknowledgement.ipAddress)}</p>
            </section>
          `
          : ``
      }

      <section class="detail-card">
        <div class="policy-content">${policy.content}</div>
      </section>

      ${
        policy.canAcknowledge
          ? `
            <section class="panel" style="margin-top: 20px;">
              <label style="display:flex; gap:12px; align-items:flex-start;">
                <input type="checkbox" id="acknowledge-check" />
                <span>I have read, understood, and agree to comply with this policy. My acknowledgement will be stored for audit purposes.</span>
              </label>
              <button class="btn btn-primary" id="acknowledge-button" style="margin-top:16px;" disabled>Acknowledge policy</button>
            </section>
          `
          : ``
      }

      ${
        policy.compliance
          ? `
            <section class="grid-2" style="margin-top: 20px;">
              <article class="panel">
                <h2 class="page-title" style="margin-top: 0;">Signed users</h2>
                <div class="detail-stack">
                  ${
                    policy.compliance.signedUsers.length
                      ? policy.compliance.signedUsers
                          .map(
                            (user) => `
                              <div class="list-item">
                                <span>${escapeHtml(user.name)}</span>
                                <span class="page-subtitle">${formatDateShort(user.signedAt)}</span>
                              </div>
                            `
                          )
                          .join("")
                      : `<div class="muted">No signatures yet.</div>`
                  }
                </div>
              </article>
              <article class="panel">
                <h2 class="page-title" style="margin-top: 0;">Pending users</h2>
                <div class="detail-stack">
                  ${
                    policy.compliance.pendingUsers.length
                      ? policy.compliance.pendingUsers
                          .map(
                            (user) => `
                              <div class="list-item">
                                <span>${escapeHtml(user.name)}</span>
                                <span class="page-subtitle">${escapeHtml(user.role)}</span>
                              </div>
                            `
                          )
                          .join("")
                      : `<div class="muted">Everyone has signed.</div>`
                  }
                </div>
              </article>
            </section>
          `
          : ``
      }
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
            await api.acknowledgePolicy(policy.id);
            showToast("Policy acknowledged successfully.", "success");
            await render();
          } catch (error) {
            showToast(error.message, "error");
          }
        });
      }

      document.getElementById("approve-policy-button")?.addEventListener("click", () => {
        showModal({
          title: "Approve policy",
          body: "Approving this policy will unlock the final publication step for administrators.",
          actions: [
            {
              label: "Approve",
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
        content: `<section class="hero"><h1 class="page-title">Only administrators can edit policies.</h1></section>`,
      };
    }
    return renderPolicyEditor(context);
  }

  if (/^policies\/[^/]+$/.test(context.route)) {
    return renderPolicyDetails(context);
  }

  return {
    active: "policies",
    content: `<section class="hero"><h1 class="page-title">Policy page not found.</h1></section>`,
  };
}

import { escapeHtml, formatDateShort, initials } from "../utils.js";
import { showModal } from "../components/ui.js";

export async function renderUsers({ api, showToast, render, state }) {
  if (state.currentUser.role !== "admin") {
    return {
      active: "dashboard",
      content: `<section class="hero"><h1 class="page-title">User management is only available to administrators.</h1></section>`,
    };
  }

  const data = await api.getUsers();
  const roleOptions = ["admin", "manager", "staff", "student", "auditor"];

  return {
    active: "users",
    content: `
      <section class="hero">
        <div class="hero-header">
          <div>
            <h1 class="page-title">User management</h1>
            <p class="page-subtitle">Review active accounts and maintain role assignments with audit visibility.</p>
          </div>
          <div class="badge primary">${data.users.length} users</div>
        </div>
      </section>

      <section class="table-card">
        <table class="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${data.users
              .map(
                (user) => `
                  <tr>
                    <td>
                      <div style="display:flex; gap:12px; align-items:center;">
                        <div class="badge primary" style="min-width:38px; justify-content:center;">${initials(user.name)}</div>
                        <div>
                          <div><strong>${escapeHtml(user.name)}</strong></div>
                          <div class="page-subtitle">${escapeHtml(user.email)}</div>
                        </div>
                      </div>
                    </td>
                    <td>${escapeHtml(user.role)}</td>
                    <td><span class="badge ${user.active === false ? "danger" : "success"}">${user.active === false ? "Inactive" : "Active"}</span></td>
                    <td>${formatDateShort(user.createdAt)}</td>
                    <td>
                      ${
                        user.id === state.currentUser.id
                          ? `<span class="muted">Current user</span>`
                          : `<div class="button-row" style="flex-wrap:wrap;">
                              <button class="btn btn-secondary" data-role-user="${user.id}" data-current-role="${user.role}">Change role</button>
                              <button class="btn ${user.active === false ? "btn-primary" : "btn-secondary"}" data-toggle-active="${user.id}" data-active="${user.active !== false}">${user.active === false ? "Activate" : "Deactivate"}</button>
                            </div>`
                      }
                    </td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </section>
    `,
    bind() {
      document.querySelectorAll("[data-role-user]").forEach((button) => {
        button.addEventListener("click", () => {
          const userId = button.dataset.roleUser;
          const currentRole = button.dataset.currentRole;
          showModal({
            title: "Change user role",
            body: `
              <div class="field">
                <label for="role-select">Role</label>
                <select id="role-select" class="select">
                  ${roleOptions
                    .map((role) => `<option value="${role}" ${role === currentRole ? "selected" : ""}>${role}</option>`)
                    .join("")}
                </select>
              </div>
            `,
            actions: [
              {
                label: "Update role",
                onClick: async () => {
                  try {
                    await api.changeUserRole(userId, document.getElementById("role-select").value);
                    showToast("User role updated successfully.", "success");
                    await render();
                  } catch (error) {
                    showToast(error.message, "error");
                  }
                },
              },
            ],
          });
        });
      });

      document.querySelectorAll("[data-toggle-active]").forEach((button) => {
        button.addEventListener("click", async () => {
          const userId = button.dataset.toggleActive;
          const isActive = button.dataset.active === "true";
          const next = !isActive;
          try {
            await api.changeUserActive(userId, next);
            showToast(next ? "User activated." : "User deactivated.", "success");
            await render();
          } catch (error) {
            showToast(error.message, "error");
          }
        });
      });
    },
  };
}

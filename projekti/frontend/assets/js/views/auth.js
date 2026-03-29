export function renderAuthView(mode = "login") {
  return `
    <div class="auth-shell">
      <section class="auth-showcase">
        <div class="auth-showcase__badge">Smart Policy Portal</div>
        <h1 class="auth-showcase__title">Compliance workflows that feel clear, fast, and trustworthy.</h1>
        <p class="auth-showcase__text">
          Manage policy drafting, approval, publication, acknowledgements, and audit history from one professional workspace.
        </p>

        <div class="auth-showcase__grid">
          <article class="auth-metric">
            <strong>Role-aware access</strong>
            <span>Admin, manager, staff, student, and auditor journeys stay separated cleanly.</span>
          </article>
          <article class="auth-metric">
            <strong>Approval pipeline</strong>
            <span>Draft, review, approved, and final publication are visible at a glance.</span>
          </article>
          <article class="auth-metric">
            <strong>Audit-ready records</strong>
            <span>Every action can be traced through searchable logs and exports.</span>
          </article>
        </div>
      </section>

      <section class="auth-card auth-card--elevated">
        <div class="auth-header auth-header--left">
          <div class="badge primary">Professional Project Build</div>
          <h1 class="page-title">${mode === "login" ? "Sign in to continue" : "Create your account"}</h1>
          <p class="page-subtitle">
            ${mode === "login"
              ? "Use your credentials or jump in with a demo role."
              : "Register as a staff member or student to access published policies."}
          </p>
        </div>

        <div class="toggle-row">
          <button type="button" class="${mode === "login" ? "active" : ""}" data-auth-mode="login">Sign in</button>
          <button type="button" class="${mode === "register" ? "active" : ""}" data-auth-mode="register">Register</button>
        </div>

        ${
          mode === "login"
            ? `
              <form id="login-form" class="form-grid">
                <div class="field">
                  <label for="login-email">Email</label>
                  <input class="input" id="login-email" type="email" autocomplete="username" required />
                </div>
                <div class="field">
                  <label for="login-password">Password</label>
                  <input class="input" id="login-password" type="password" autocomplete="current-password" required />
                </div>
                <button class="btn btn-primary btn-block" type="submit">Sign in</button>
              </form>

              <div class="auth-demo-panel">
                <div class="section-header">
                  <div>
                    <h3 style="margin:0;">Quick demo access</h3>
                    <p class="page-subtitle" style="margin:6px 0 0;">Open the portal instantly with seeded roles.</p>
                  </div>
                </div>
                <div class="auth-demo-grid">
                  <button type="button" class="auth-demo-card" data-demo-role="admin">
                    <strong>Admin</strong>
                    <span>Controls users, policies, and publication.</span>
                  </button>
                  <button type="button" class="auth-demo-card" data-demo-role="manager">
                    <strong>Manager</strong>
                    <span>Approves policies before final release.</span>
                  </button>
                  <button type="button" class="auth-demo-card" data-demo-role="staff">
                    <strong>Staff</strong>
                    <span>Reads and acknowledges published policies.</span>
                  </button>
                  <button type="button" class="auth-demo-card" data-demo-role="student">
                    <strong>Student</strong>
                    <span>Signs off on required policy updates.</span>
                  </button>
                  <button type="button" class="auth-demo-card" data-demo-role="auditor">
                    <strong>Auditor</strong>
                    <span>Reviews filtered logs and exports evidence.</span>
                  </button>
                </div>
              </div>
            `
            : `
              <form id="register-form" class="form-grid">
                <div class="field">
                  <label for="register-name">Full name</label>
                  <input class="input" id="register-name" type="text" autocomplete="name" required />
                </div>
                <div class="field">
                  <label for="register-email">Email</label>
                  <input class="input" id="register-email" type="email" autocomplete="email" required />
                </div>
                <div class="field">
                  <label for="register-password">Password</label>
                  <input class="input" id="register-password" type="password" minlength="6" autocomplete="new-password" required />
                </div>
                <div class="field">
                  <label for="register-role">Role</label>
                  <select class="select" id="register-role">
                    <option value="student">Student</option>
                    <option value="staff">Staff</option>
                  </select>
                </div>
                <button class="btn btn-primary btn-block" type="submit">Create account</button>
              </form>
            `
        }
      </section>
    </div>
  `;
}

export function renderAuthView(mode = "login") {
  return `
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="auth-header">
          <div class="badge primary">Professional Project Build</div>
          <h1 class="page-title">${mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p class="page-subtitle">Policy governance, acknowledgements, and audit tracking in one portal.</p>
        </div>

        <div class="toggle-row">
          <button class="${mode === "login" ? "active" : ""}" data-auth-mode="login">Sign in</button>
          <button class="${mode === "register" ? "active" : ""}" data-auth-mode="register">Register</button>
        </div>

        ${
          mode === "login"
            ? `
              <form id="login-form" class="form-grid">
                <div class="field">
                  <label for="login-email">Email</label>
                  <input class="input" id="login-email" type="email" required />
                </div>
                <div class="field">
                  <label for="login-password">Password</label>
                  <input class="input" id="login-password" type="password" required />
                </div>
                <button class="btn btn-primary" type="submit">Sign in</button>
              </form>
              <div class="panel" style="margin-top: 18px;">
                <h3 style="margin-top: 0;">Quick demo access</h3>
                <div class="button-row">
                  <button class="btn btn-secondary" data-demo-role="admin">Admin</button>
                  <button class="btn btn-secondary" data-demo-role="manager">Manager</button>
                  <button class="btn btn-secondary" data-demo-role="staff">Staff</button>
                  <button class="btn btn-secondary" data-demo-role="student">Student</button>
                  <button class="btn btn-secondary" data-demo-role="auditor">Auditor</button>
                </div>
              </div>
            `
            : `
              <form id="register-form" class="form-grid">
                <div class="field">
                  <label for="register-name">Full name</label>
                  <input class="input" id="register-name" type="text" required />
                </div>
                <div class="field">
                  <label for="register-email">Email</label>
                  <input class="input" id="register-email" type="email" required />
                </div>
                <div class="field">
                  <label for="register-password">Password</label>
                  <input class="input" id="register-password" type="password" minlength="6" required />
                </div>
                <div class="field">
                  <label for="register-role">Role</label>
                  <select class="select" id="register-role">
                    <option value="student">Student</option>
                    <option value="staff">Staff</option>
                  </select>
                </div>
                <button class="btn btn-primary" type="submit">Create account</button>
              </form>
            `
        }
      </div>
    </div>
  `;
}

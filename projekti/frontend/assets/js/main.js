import { api } from "./api.js";
import { showToast } from "./components/ui.js";
import { renderLayout } from "./components/layout.js";
import { renderAuthView } from "./views/auth.js";

const state = {
  currentUser: null,
  roles: [],
  config: {
    institutionName: "Springfield Academy",
    portalTitle: "Smart Policy & Compliance Portal",
  },
};

const app = document.getElementById("app");

function getRoute() {
  return window.location.hash.replace(/^#\//, "") || "dashboard";
}

function go(route) {
  window.location.hash = `#/${route}`;
}

function logout() {
  api.clearToken();
  state.currentUser = null;
  render();
}

function attachLayoutHandlers() {
  const button = document.getElementById("logout-button");
  if (button) {
    button.addEventListener("click", logout);
  }
}

async function renderProtectedPage(route) {
  const routeHandlers = await import("./routes.js");
  const view = await routeHandlers.renderRoute({ route, state, go, render, api, showToast });
  app.innerHTML = renderLayout({ state, active: view.active, content: view.content });
  attachLayoutHandlers();
  if (typeof view.bind === "function") {
    view.bind();
  }
}

function bindAuth(mode) {
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => renderAuth(button.dataset.authMode));
  });

  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const result = await api.login({
          email: document.getElementById("login-email").value,
          password: document.getElementById("login-password").value,
        });
        api.setToken(result.token);
        state.currentUser = result.session.currentUser;
        state.roles = result.session.roles;
        state.config = result.session.config;
        go("dashboard");
      } catch (error) {
        showToast(error.message, "error");
      }
    });

    document.querySelectorAll("[data-demo-role]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          const result = await api.demoLogin(button.dataset.demoRole);
          api.setToken(result.token);
          state.currentUser = result.session.currentUser;
          state.roles = result.session.roles;
          state.config = result.session.config;
          go("dashboard");
        } catch (error) {
          showToast(error.message, "error");
        }
      });
    });
  }

  const registerForm = document.getElementById("register-form");
  if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await api.register({
          name: document.getElementById("register-name").value,
          email: document.getElementById("register-email").value,
          password: document.getElementById("register-password").value,
          role: document.getElementById("register-role").value,
        });
        showToast("Account created. You can sign in now.", "success");
        renderAuth("login");
      } catch (error) {
        showToast(error.message, "error");
      }
    });
  }
}

function renderAuth(mode = "login") {
  app.innerHTML = renderAuthView(mode);
  bindAuth(mode);
}

async function render() {
  if (!api.getToken()) {
    renderAuth("login");
    return;
  }

  if (!state.currentUser) {
    try {
      const session = await api.getSession();
      state.currentUser = session.currentUser;
      state.roles = session.roles;
      state.config = session.config;
    } catch {
      api.clearToken();
      renderAuth("login");
      return;
    }
  }

  try {
    await renderProtectedPage(getRoute());
  } catch (error) {
    if (!api.getToken()) {
      state.currentUser = null;
      renderAuth("login");
      showToast("Your session expired. Please sign in again.", "warning");
      return;
    }

    showToast(error.message, "error");
  }
}

window.addEventListener("hashchange", render);
render();

export { state, go, render };

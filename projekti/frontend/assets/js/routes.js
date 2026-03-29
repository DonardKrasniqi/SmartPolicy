export async function renderRoute(context) {
  const route = context.route;

  if (route === "dashboard") {
    const module = await import("./views/dashboard.js");
    return module.renderDashboard(context);
  }

  if (route === "policies" || route === "policies/new" || route.startsWith("policies/")) {
    const module = await import("./views/policies.js");
    return module.renderPoliciesRoute(context);
  }

  if (route === "pending") {
    const module = await import("./views/pending.js");
    return module.renderPending(context);
  }

  if (route === "users") {
    const module = await import("./views/users.js");
    return module.renderUsers(context);
  }

  if (route === "audit") {
    const module = await import("./views/audit.js");
    return module.renderAudit(context);
  }

  return {
    active: "dashboard",
    content: `<div class="hero"><h1 class="page-title">Page not found</h1><p class="page-subtitle">Redirecting you back to the dashboard.</p></div>`,
    bind() {
      context.go("dashboard");
    },
  };
}

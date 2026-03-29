export function showToast(message, type = "info") {
  const root = document.getElementById("toast-root");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  root.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

export function showModal({ title, body, actions = [] }) {
  const root = document.getElementById("modal-root");
  root.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card">
        <div class="section-header">
          <h3>${title}</h3>
          <button class="btn btn-secondary" data-close-modal>Close</button>
        </div>
        <div class="muted" style="margin-top: 12px;">${body}</div>
        <div class="button-row" style="margin-top: 20px;">
          ${actions
            .map(
              (action, index) =>
                `<button class="btn ${action.variant || "btn-primary"}" data-modal-action="${index}">${action.label}</button>`
            )
            .join("")}
        </div>
      </div>
    </div>
  `;

  root.querySelector("[data-close-modal]").addEventListener("click", closeModal);
  root.querySelector(".modal-overlay").addEventListener("click", (event) => {
    if (event.target.classList.contains("modal-overlay")) {
      closeModal();
    }
  });

  root.querySelectorAll("[data-modal-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = actions[Number(button.dataset.modalAction)];
      if (action?.onClick) {
        await action.onClick();
      }
      if (action?.keepOpen !== true) {
        closeModal();
      }
    });
  });
}

export function closeModal() {
  document.getElementById("modal-root").innerHTML = "";
}

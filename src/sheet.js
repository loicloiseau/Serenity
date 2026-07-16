/**
 * Shared bottom-sheet chrome for Serenity cards. Cards embed SHEET_CSS in
 * their stylesheet and call createSheet(shadowRoot) once; the sheet slides
 * up over the whole screen (same look as the climate card menus).
 */

export const SHEET_CSS = `
  .s-overlay {
    position: fixed; inset: 0; z-index: 998;
    background: rgba(14, 19, 16, 0.38);
    display: flex; align-items: flex-end; justify-content: center;
    padding: 0 12px calc(16px + env(safe-area-inset-bottom, 0px));
    box-sizing: border-box;
    animation: s-overlay-in 0.18s ease;
  }
  @keyframes s-overlay-in { from { opacity: 0; } to { opacity: 1; } }
  .s-overlay.hidden { display: none; }
  .s-sheet {
    width: 100%; max-width: 420px; max-height: 68vh; overflow-y: auto;
    background: var(--ha-card-background, var(--card-background-color, #fff));
    border-radius: 22px; padding: 10px;
    box-shadow: 0 18px 48px rgba(10, 16, 12, 0.35);
    animation: s-sheet-in 0.2s ease;
    box-sizing: border-box;
  }
  @keyframes s-sheet-in { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) {
    .s-overlay, .s-sheet { animation: none; }
  }
  .s-title {
    font-size: 11.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--_muted, var(--secondary-text-color, #9aa3af)); padding: 8px 12px 7px;
  }
`;

/** Builds the (hidden) sheet inside the card's shadow root. */
export function createSheet(root) {
  const ov = document.createElement("div");
  ov.className = "s-overlay hidden";
  ov.innerHTML = `
    <div class="s-sheet">
      <div class="s-title"></div>
      <div class="s-body"></div>
    </div>`;
  root.appendChild(ov);
  const api = {
    el: ov,
    title: ov.querySelector(".s-title"),
    body: ov.querySelector(".s-body"),
    open() {
      ov.classList.remove("hidden");
    },
    close() {
      ov.classList.add("hidden");
    },
  };
  ov.addEventListener("click", (ev) => {
    if (ev.target === ov) api.close();
  });
  return api;
}

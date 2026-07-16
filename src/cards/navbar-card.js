/**
 * Serenity Navbar Card — custom:serenity-navbar-card
 *
 * A floating bottom navigation bar in the Serenity style. Place it as the
 * last card of every view: the in-flow part is a transparent spacer so the
 * content never hides behind the fixed bar.
 *
 * items: [{icon, label, path, badge?}] — badge is a count-spec
 * ({entities|domain, state…}); a red pill with the count shows when > 0.
 */

import { countEntities } from "../header-utils.js";

export class SerenityNavbarCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
    this._onNav = () => this._syncActive();
  }

  setConfig(config) {
    if (!config || !Array.isArray(config.items) || !config.items.length) {
      throw new Error("You must define items: [{icon, label, path}]");
    }
    this._config = { ...config };
    if (this._built) {
      this._buildItems();
      this._update();
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.isConnected) return;
    this._ensureBuilt();
    this._update();
  }

  connectedCallback() {
    this._ensureBuilt();
    if (this._hass) this._update();
    window.addEventListener("location-changed", this._onNav);
    window.addEventListener("popstate", this._onNav);
    this._syncActive();
  }

  disconnectedCallback() {
    window.removeEventListener("location-changed", this._onNav);
    window.removeEventListener("popstate", this._onNav);
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return { columns: 12, rows: "auto" };
  }

  static getStubConfig() {
    return {
      items: [
        { icon: "mdi:home", label: "Maison", path: "home" },
        { icon: "mdi:lightbulb-group", label: "Lumières", path: "lights" },
      ],
    };
  }

  _ensureBuilt() {
    if (this._built) return;
    const root = this.shadowRoot;

    const style = document.createElement("style");
    style.textContent = this._css();
    root.appendChild(style);

    // In-flow spacer (keeps content clear of the fixed bar).
    const spacer = document.createElement("div");
    spacer.className = "spacer";
    root.appendChild(spacer);

    const bar = document.createElement("nav");
    bar.className = "bar";
    root.appendChild(bar);

    this._els = { bar, spacer };
    this._built = true;
    this._buildItems();
  }

  _css() {
    return `
      :host {
        --_accent: var(--serenity-navbar-color, #3F9E6B);
        --_value: var(--serenity-value-color, var(--primary-text-color, #16201b));
        --_muted: var(--serenity-muted-color, var(--secondary-text-color, #9aa3af));
        --_font: var(--serenity-header-font, "Inter", "Roboto", system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif);
        display: block;
        font-family: var(--_font);
      }
      .spacer { height: 76px; }
      .bar {
        position: fixed; z-index: 20;
        left: 50%; transform: translateX(-50%);
        bottom: calc(12px + env(safe-area-inset-bottom, 0px));
        display: flex; gap: 2px; align-items: stretch;
        max-width: calc(100vw - 24px);
        padding: 6px;
        background: var(--serenity-navbar-bg, var(--ha-card-background, var(--card-background-color, #fff)));
        border-radius: 22px;
        box-shadow: 0 6px 24px rgba(12, 18, 14, 0.16), 0 1px 3px rgba(12, 18, 14, 0.10);
        backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
        overflow-x: auto; scrollbar-width: none;
      }
      .bar::-webkit-scrollbar { display: none; }
      .item {
        position: relative; flex: 1 0 auto;
        display: flex; flex-direction: column; align-items: center; gap: 2px;
        border: none; background: none; cursor: pointer;
        padding: 8px 13px 7px; border-radius: 16px;
        font-family: inherit; color: var(--_muted);
        transition: background 0.18s ease, color 0.18s ease, transform 0.06s ease;
        -webkit-tap-highlight-color: transparent;
      }
      .item:active { transform: scale(0.94); }
      .item ha-icon { --mdc-icon-size: 21px; }
      .item .lbl { font-size: 10.5px; font-weight: 600; letter-spacing: 0.01em; white-space: nowrap; }
      .item.active {
        color: var(--_accent);
        background: var(--i-soft, rgba(63, 158, 107, 0.13));
      }
      .item .badge {
        position: absolute; top: 4px; right: 6px;
        min-width: 15px; height: 15px; padding: 0 4px; box-sizing: border-box;
        border-radius: 999px; background: #E06B5B; color: #fff;
        font-size: 9.5px; font-weight: 700; line-height: 15px; text-align: center;
      }
      .item .badge.hidden { display: none; }
    `;
  }

  _buildItems() {
    if (!this._built) return;
    const bar = this._els.bar;
    bar.textContent = "";
    this._items = [];
    for (const it of this._config.items) {
      const btn = document.createElement("button");
      btn.className = "item";
      const accent = it.accent || this._config.accent || "#3F9E6B";
      btn.style.setProperty("--_accent", accent);
      btn.style.setProperty("--i-soft", this._soft(accent));
      btn.innerHTML = `
        <ha-icon icon="${it.icon || "mdi:circle-outline"}"></ha-icon>
        <span class="lbl"></span>
        <span class="badge hidden"></span>`;
      btn.querySelector(".lbl").textContent = it.label || "";
      btn.addEventListener("click", () => this._navigate(it.path));
      bar.appendChild(btn);
      this._items.push({ btn, spec: it });
    }
    this._syncActive();
  }

  _soft(hex) {
    const h = String(hex).replace("#", "");
    const n =
      h.length === 3
        ? h
            .split("")
            .map((c) => c + c)
            .join("")
        : h;
    return `rgba(${parseInt(n.substr(0, 2), 16)}, ${parseInt(n.substr(2, 2), 16)}, ${parseInt(n.substr(4, 2), 16)}, 0.13)`;
  }

  _navigate(path) {
    if (!path) return;
    const target = path.startsWith("/")
      ? path
      : `${window.location.pathname.split("/").slice(0, -1).join("/")}/${path}`;
    window.history.pushState(null, "", target);
    window.dispatchEvent(
      new CustomEvent("location-changed", { detail: { replace: false } })
    );
  }

  _syncActive() {
    if (!this._items) return;
    const here = window.location.pathname;
    for (const { btn, spec } of this._items) {
      const p = spec.path || "";
      const active = p.startsWith("/")
        ? here === p
        : here.endsWith(`/${p}`) || here === p;
      btn.classList.toggle("active", active);
    }
  }

  _update() {
    if (!this._built || !this._items) return;
    this._syncActive();
    if (!this._hass) return;
    for (const { btn, spec } of this._items) {
      const badge = btn.querySelector(".badge");
      const b = spec.badge;
      if (!b || !(b.entities || b.domain)) {
        badge.classList.add("hidden");
        continue;
      }
      const n = countEntities(this._hass, { state: "on", ...b });
      badge.classList.toggle("hidden", n === 0);
      if (n > 0) badge.textContent = n > 9 ? "9+" : String(n);
    }
  }
}

if (!customElements.get("serenity-navbar-card")) {
  customElements.define("serenity-navbar-card", SerenityNavbarCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "serenity-navbar-card",
  name: "Serenity Navbar",
  description:
    "Floating bottom navigation bar with active tab and live count badges.",
  preview: true,
  documentationURL: "https://github.com/your-username/serenity-cards",
});

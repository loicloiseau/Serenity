import { countEntities, countText, greetingText } from "./header-utils.js";

/**
 * Shared logic for header cards. A subclass sets `static variant = "title" | "subtitle"`.
 * Both variants support the same options; only the default sizing differs.
 */
export class SerenityHeaderCardBase extends HTMLElement {
  static variant = "title";

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    this._config = { ...config };
    if (this._built) {
      this._applyClasses();
      this._applyVars();
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
    this._update();
  }

  getCardSize() {
    return 1;
  }

  /* ----------------------------- build ----------------------------- */

  _ensureBuilt() {
    if (this._built) return;
    const root = this.shadowRoot;

    const style = document.createElement("style");
    style.textContent = this._css();
    root.appendChild(style);

    const card = document.createElement("ha-card");
    card.innerHTML = `
      <div class="wrap">
        <div class="eyebrow"></div>
        <div class="row">
          <div class="left">
            <div class="icon-box"><ha-icon></ha-icon></div>
            <div class="text">
              <div class="title"></div>
              <div class="secondary"></div>
            </div>
          </div>
          <div class="rule"></div>
          <div class="badge"><span class="dot"></span><span class="badge-text"></span></div>
          <div class="buttons"></div>
        </div>
      </div>`;
    root.appendChild(card);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      card.animate(
        [
          { opacity: 0, transform: "translateY(4px)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 240, easing: "ease-out" }
      );
    }

    const $ = (s) => root.querySelector(s);
    this._els = {
      card,
      wrap: $(".wrap"),
      eyebrow: $(".eyebrow"),
      iconBox: $(".icon-box"),
      icon: $(".icon-box ha-icon"),
      text: $(".text"),
      title: $(".title"),
      secondary: $(".secondary"),
      rule: $(".rule"),
      badge: $(".badge"),
      badgeDot: $(".badge .dot"),
      badgeText: $(".badge .badge-text"),
      buttons: $(".buttons"),
    };

    this.classList.add("v-" + this.constructor.variant);
    this._els.wrap.addEventListener("click", () => this._handleAction());

    this._built = true;
    this._applyClasses();
    this._applyVars();
  }

  _css() {
    return `
      :host {
        --_accent: var(--serenity-header-color, #3E9E6B);
        --_soft: var(--serenity-header-soft, color-mix(in srgb, var(--_accent) 14%, transparent));
        --_value: var(--serenity-value-color, var(--primary-text-color, #0f1a16));
        --_muted: var(--serenity-muted-color, var(--secondary-text-color, #9aa3af));
        --_rule: var(--serenity-rule-color, var(--divider-color, rgba(120, 130, 138, 0.28)));
        --_font: var(--serenity-header-font, "Inter", "Roboto", system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif);
        display: block;
        font-family: var(--_font);
      }
      ha-card { padding: 16px 18px; }
      ha-card.flush {
        --ha-card-background: transparent;
        --ha-card-box-shadow: none;
        --ha-card-border-width: 0;
        background: transparent;
        box-shadow: none;
        border: none;
        padding: 4px 8px 8px;
      }
      .wrap.actionable { cursor: pointer; }
      .eyebrow {
        font-size: 11px; font-weight: 700; letter-spacing: 0.09em;
        color: var(--_muted); margin-bottom: 6px;
      }
      .eyebrow.upper { text-transform: uppercase; }
      :host(.v-title) .eyebrow { margin-bottom: 10px; }
      .eyebrow.hidden, .icon-box.hidden, .secondary.hidden, .badge.hidden, .buttons.hidden { display: none; }
      .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .left { display: flex; align-items: center; gap: 10px; min-width: 0; }
      :host(.v-title) .left { flex: 1 1 auto; }
      :host(.v-subtitle) .left { flex: 0 1 auto; }
      .text { display: flex; min-width: 0; }
      :host(.v-title) .text { flex-direction: column; gap: 2px; }
      :host(.v-subtitle) .text { flex-direction: row; align-items: baseline; gap: 8px; }
      .icon-box {
        flex: 0 0 auto; width: 36px; height: 36px; border-radius: 11px;
        background: var(--_soft); display: flex; align-items: center; justify-content: center;
      }
      .icon-box ha-icon { --mdc-icon-size: 20px; color: var(--_accent); }
      .title { color: var(--_value); line-height: 1.2; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      :host(.v-title) .title { font-size: 24px; font-weight: 800; letter-spacing: -0.3px; }
      :host(.v-subtitle) .title { font-size: 17px; font-weight: 700; }
      .secondary { color: var(--_muted); font-size: 14px; font-weight: 500; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .rule { display: none; }
      :host(.v-subtitle) .rule {
        display: block; flex: 1 1 auto; min-width: 16px;
        height: 1px; border-radius: 1px; background: var(--_rule);
      }
      .badge {
        display: flex; align-items: center; gap: 6px; flex: 0 0 auto;
        background: var(--_soft); padding: 5px 11px; border-radius: 999px;
      }
      .buttons { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
      .hbtn {
        width: 40px; height: 40px; flex: 0 0 auto; padding: 0; border: none; cursor: pointer;
        border-radius: 12px; background: var(--serenity-button-bg, var(--ha-card-background, var(--card-background-color, #ffffff)));
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 1px 2px rgba(17, 24, 20, 0.08), 0 2px 6px rgba(17, 24, 20, 0.05);
        transition: background 0.15s ease, box-shadow 0.15s ease, transform 0.05s ease;
      }
      .hbtn:hover { filter: brightness(0.97); }
      .hbtn:active { transform: scale(0.96); }
      .hbtn ha-icon { --mdc-icon-size: 20px; color: var(--serenity-button-icon, var(--primary-text-color, #374151)); }
      .badge .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--_accent); }
      .badge .badge-text { font-size: 13px; font-weight: 600; color: var(--_accent); white-space: nowrap; }
      .badge.no-dot .dot { display: none; }
      :host(.align-center) .row, :host(.align-center) .left { justify-content: center; }
      :host(.align-center) .eyebrow { text-align: center; }
    `;
  }

  _applyClasses() {
    const c = this._config || {};
    this._els.card.classList.toggle("flush", c.transparent !== false);
    if (c.padding) this._els.card.style.padding = c.padding;
    this.classList.toggle("align-center", c.align === "center");
  }

  _applyVars() {
    const c = this._config || {};
    this.style.removeProperty("--_accent");
    this.style.removeProperty("--_soft");
    if (c.accent) this.style.setProperty("--_accent", c.accent);
    if (c.icon_background) this.style.setProperty("--_soft", c.icon_background);
  }

  /* --------------------------- update --------------------------- */

  _update() {
    if (!this._built || !this._config) return;
    const c = this._config;
    const els = this._els;

    // Eyebrow / label
    els.eyebrow.textContent = c.label || "";
    els.eyebrow.classList.toggle("hidden", !c.label);
    els.eyebrow.classList.toggle("upper", c.label_uppercase !== false);
    els.eyebrow.style.color = c.label_color || "";

    // Icon
    const hasIcon = !!c.icon;
    els.iconBox.classList.toggle("hidden", !hasIcon);
    if (hasIcon) {
      els.icon.setAttribute("icon", c.icon);
      els.icon.style.color = c.icon_color || "";
    }

    // Title
    els.title.textContent = c.title != null ? c.title : "";
    els.title.style.color = c.title_color || "";
    els.title.style.fontSize = c.title_size
      ? typeof c.title_size === "number"
        ? c.title_size + "px"
        : c.title_size
      : "";

    // Secondary (inline muted text); "greeting" renders a time-of-day hello
    const sec =
      c.secondary === "greeting"
        ? greetingText(this._hass)
        : this._resolveCountable(c.secondary);
    els.secondary.textContent = sec || "";
    els.secondary.classList.toggle("hidden", !sec);
    els.secondary.style.color = c.secondary_color || "";

    // Badge (right side)
    const badge = this._resolveBadge();
    const show = !!(badge && badge.text);
    els.badge.classList.toggle("hidden", !show);
    if (show) {
      els.badgeText.textContent = badge.text;
      els.badge.classList.toggle("no-dot", badge.dot === false);
      els.badgeText.style.color = badge.color || "";
      els.badgeDot.style.background = badge.color || "";
    }

    // Buttons (right-side action squares)
    this._renderButtons(Array.isArray(c.buttons) ? c.buttons : []);

    // Tap target
    const ta = c.tap_action;
    els.wrap.classList.toggle(
      "actionable",
      !!(ta && ta.action && ta.action !== "none")
    );
  }

  _renderButtons(buttons) {
    const host = this._els.buttons;
    host.classList.toggle("hidden", buttons.length === 0);
    host.textContent = "";
    for (const b of buttons) {
      const btn = document.createElement("button");
      btn.className = "hbtn";
      if (b.title) btn.setAttribute("aria-label", b.title);
      const icon = document.createElement("ha-icon");
      icon.setAttribute("icon", b.icon || "mdi:dots-horizontal");
      if (b.icon_color) icon.style.color = b.icon_color;
      btn.appendChild(icon);
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._runAction(b.tap_action, b.entity);
      });
      host.appendChild(btn);
    }
  }

  /** Resolve a string | count-spec | entity-spec into display text. */
  _resolveCountable(value) {
    if (value == null) return null;
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
    if (value.entity) {
      const st = this._hass && this._hass.states[value.entity];
      const s = st ? st.state : "—";
      if (value.map && value.map[s] != null) return String(value.map[s]);
      if (value.format) return String(value.format).replace(/\{state\}/g, s);
      return s;
    }
    if (value.entities || value.domain)
      return countText(countEntities(this._hass, value), value);
    if (value.text != null) return String(value.text);
    return null;
  }

  _resolveBadge() {
    const b = this._config.badge;
    if (b == null || b === false) return null;
    if (typeof b === "string") return b === "" ? null : { text: b, dot: true };
    const dot = b.dot !== false;
    const color = b.color || null;
    const text = this._resolveCountable(b);
    return text == null ? null : { text, dot, color };
  }

  _handleAction() {
    this._runAction(this._config.tap_action);
  }

  _runAction(ta, fallbackEntity) {
    if (!ta || !ta.action || ta.action === "none") return;
    if (ta.action === "navigate" && ta.navigation_path) {
      window.history.pushState(null, "", ta.navigation_path);
      window.dispatchEvent(
        new CustomEvent("location-changed", { detail: { replace: false } })
      );
    } else if (ta.action === "url" && ta.url_path) {
      window.open(ta.url_path, ta.new_tab === false ? "_self" : "_blank");
    } else if (ta.action === "menu") {
      this.dispatchEvent(
        new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true })
      );
    } else if (ta.action === "toggle") {
      const ent = ta.entity || fallbackEntity || this._config.entity;
      if (ent && this._hass)
        this._hass.callService("homeassistant", "toggle", { entity_id: ent });
    } else if (ta.action === "more-info") {
      const ent = ta.entity || fallbackEntity || this._config.entity;
      if (ent)
        this.dispatchEvent(
          new CustomEvent("hass-more-info", {
            detail: { entityId: ent },
            bubbles: true,
            composed: true,
          })
        );
    }
  }
}

/**
 * Serenity Tile Card — custom:serenity-tile-card
 *
 * A navigation tile: round-square icon plate, title and a live subtitle
 * (entity count, entity state or static text). When "active" the tile
 * glows with its accent colour. Fits two-up by default.
 */

import { countEntities, countText, isActiveState } from "../header-utils.js";

function hexToRgba(hex, a) {
  const h = String(hex).replace("#", "");
  const n =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return `rgba(${parseInt(n.substr(0, 2), 16)}, ${parseInt(n.substr(2, 2), 16)}, ${parseInt(n.substr(4, 2), 16)}, ${a})`;
}

export class SerenityTileCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
  }

  setConfig(config) {
    if (!config || !config.title) throw new Error("You must define a title");
    this._config = { ...config };
    if (this._built) this._update();
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
  }

  getCardSize() {
    return 2;
  }

  getGridOptions() {
    return { columns: 6, rows: "auto", min_columns: 3 };
  }

  static getStubConfig() {
    return {
      title: "Lumières",
      icon: "mdi:lightbulb-group",
      accent: "#E2B33C",
      subtitle: "Tout est éteint",
    };
  }

  _ensureBuilt() {
    if (this._built) return;
    const root = this.shadowRoot;

    const style = document.createElement("style");
    style.textContent = this._css();
    root.appendChild(style);

    const card = document.createElement("ha-card");
    card.innerHTML = `
      <div class="tile">
        <div class="icon-box"><ha-icon></ha-icon></div>
        <div class="txt">
          <div class="title"></div>
          <div class="sub"></div>
        </div>
      </div>`;
    root.appendChild(card);

    const $ = (s) => root.querySelector(s);
    this._els = {
      card,
      icon: $(".icon-box ha-icon"),
      iconBox: $(".icon-box"),
      title: $(".title"),
      sub: $(".sub"),
    };

    card.addEventListener("click", () => this._runAction());
    this._built = true;
  }

  _css() {
    return `
      :host {
        --_accent: #3E9E6B;
        --_value: var(--serenity-value-color, var(--primary-text-color, #16201b));
        --_muted: var(--serenity-muted-color, var(--secondary-text-color, #9aa3af));
        --_plate: var(--serenity-tile-plate, rgba(120, 130, 138, 0.10));
        --_font: var(--serenity-header-font, "Inter", "Roboto", system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif);
        display: block;
        height: 100%;
        font-family: var(--_font);
      }
      ha-card {
        height: 100%; box-sizing: border-box; padding: 14px 16px; cursor: pointer;
        overflow: hidden; position: relative;
        transition: background-image 0.25s ease, border-color 0.25s ease;
      }
      ha-card.on {
        background-image:
          radial-gradient(circle at 12% -4%, var(--_glow, transparent) 0%, transparent 62%),
          linear-gradient(135deg, var(--_soft, transparent) 0%, transparent 65%);
      }
      .tile { display: flex; flex-direction: column; gap: 13px; height: 100%; }
      .icon-box {
        flex: 0 0 auto; width: 42px; height: 42px; border-radius: 13px;
        background: var(--_plate); display: flex; align-items: center; justify-content: center;
        transition: background 0.25s ease;
      }
      .icon-box ha-icon { --mdc-icon-size: 22px; color: var(--_muted); transition: color 0.25s ease; }
      ha-card.on .icon-box { background: var(--_soft); }
      ha-card.on .icon-box ha-icon { color: var(--_accent); }
      .txt { min-width: 0; }
      .title { font-size: 15px; font-weight: 700; letter-spacing: -0.2px; color: var(--_value);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sub { margin-top: 2px; font-size: 12.5px; font-weight: 500; color: var(--_muted);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    `;
  }

  /** subtitle: string | count-spec | {entity, format, map} */
  _resolveSubtitle(v) {
    if (v == null) return { text: "", active: null };
    if (typeof v === "string") return { text: v, active: null };
    if (v.entity) {
      const st = this._hass && this._hass.states[v.entity];
      const s = st ? st.state : "—";
      let text = s;
      if (v.map && v.map[s] != null) text = String(v.map[s]);
      else if (v.format) text = String(v.format).replace(/\{state\}/g, s);
      return { text, active: null };
    }
    if (v.entities || v.domain) {
      const n = countEntities(this._hass, v);
      return { text: countText(n, v), active: n > 0 };
    }
    return { text: "", active: null };
  }

  _update() {
    if (!this._built || !this._config) return;
    const c = this._config;
    const els = this._els;

    els.title.textContent = c.title;
    els.icon.setAttribute("icon", c.icon || "mdi:view-dashboard-outline");

    // Alert spec: when it matches, it overrides subtitle, accent and state.
    // e.g. alert: { entities: [...], state: "on", format: "{n} ouverte{s}" }
    let alertHit = null;
    if (this._hass && c.alert && (c.alert.entities || c.alert.domain)) {
      const spec = { state: "on", ...c.alert };
      const n = countEntities(this._hass, spec);
      if (n > 0) {
        alertHit = {
          text: countText(n, {
            format: "{n} ouverte{s}",
            ...spec,
          }),
          color: c.alert.color || "#E06B5B",
        };
      }
    }

    const sub = alertHit || this._resolveSubtitle(c.subtitle);
    els.sub.textContent = sub.text;
    els.sub.style.display = sub.text ? "" : "none";

    // Active: alert > count > watched entity's state > config flag.
    let active = alertHit ? true : sub.active;
    if (active == null && c.entity && this._hass) {
      const st = this._hass.states[c.entity];
      const s = st ? st.state : "off";
      active = Array.isArray(c.active_states)
        ? c.active_states.includes(s)
        : isActiveState(s);
    }
    if (active == null) active = c.active === true;

    const accent = alertHit ? alertHit.color : c.accent || "#3E9E6B";
    this.style.setProperty("--_accent", accent);
    this.style.setProperty("--_soft", hexToRgba(accent, 0.16));
    this.style.setProperty("--_glow", hexToRgba(accent, 0.28));
    els.card.classList.toggle("on", !!active);
  }

  _runAction() {
    const ta = this._config.tap_action;
    if (!ta || !ta.action || ta.action === "none") return;
    if (ta.action === "navigate" && ta.navigation_path) {
      window.history.pushState(null, "", ta.navigation_path);
      window.dispatchEvent(
        new CustomEvent("location-changed", { detail: { replace: false } })
      );
    } else if (ta.action === "url" && ta.url_path) {
      window.open(ta.url_path, ta.new_tab === false ? "_self" : "_blank");
    } else if (ta.action === "more-info") {
      const ent = ta.entity || this._config.entity;
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

if (!customElements.get("serenity-tile-card")) {
  customElements.define("serenity-tile-card", SerenityTileCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "serenity-tile-card",
  name: "Serenity Tile",
  description:
    "Navigation tile with icon, live count/state subtitle and accent glow when active.",
  preview: true,
  documentationURL: "https://github.com/your-username/serenity-cards",
});

/**
 * Serenity Entity Card — custom:serenity-entity-card
 *
 * A generic entity row: icon plate, name, a French state label and a
 * relative "depuis …" time. Controllable domains toggle on tap; sensors
 * open more-info. The card tints with its accent while active — pick a
 * red accent for door/window alerts, orange for motion, etc.
 */

import { relativeTime, isActiveState } from "../header-utils.js";

const TOGGLE_DOMAINS = new Set([
  "switch",
  "light",
  "input_boolean",
  "fan",
  "siren",
  "automation",
]);

// Default labels / icons / accents per binary_sensor device_class.
const DC_META = {
  door: { on: "Ouverte", off: "Fermée", icon: "mdi:door", accent: "#E06B5B" },
  window: { on: "Ouverte", off: "Fermée", icon: "mdi:window-closed", accent: "#E06B5B" },
  opening: { on: "Ouvert", off: "Fermé", icon: "mdi:door", accent: "#E06B5B" },
  garage_door: { on: "Ouverte", off: "Fermée", icon: "mdi:garage", accent: "#E06B5B" },
  motion: { on: "Mouvement", off: "Au calme", icon: "mdi:motion-sensor", accent: "#E0A95B" },
  occupancy: { on: "Présence", off: "Au calme", icon: "mdi:motion-sensor", accent: "#E0A95B" },
  presence: { on: "Présence", off: "Au calme", icon: "mdi:motion-sensor", accent: "#E0A95B" },
  smoke: { on: "Fumée détectée !", off: "Aucune fumée", icon: "mdi:smoke-detector-variant", accent: "#E06B5B" },
  moisture: { on: "Fuite détectée !", off: "Aucune fuite", icon: "mdi:water-alert", accent: "#5B9BF5" },
};

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

export class SerenityEntityCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
    this._timer = null;
  }

  setConfig(config) {
    if (!config || !config.entity) throw new Error("You must define an entity");
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
    this._timer = window.setInterval(() => this._update(), 60000);
  }

  disconnectedCallback() {
    if (this._timer) {
      window.clearInterval(this._timer);
      this._timer = null;
    }
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return { columns: 6, rows: 1, min_columns: 3 };
  }

  static getStubConfig(hass) {
    let entity = "";
    if (hass && hass.states) {
      entity =
        Object.keys(hass.states).find(
          (e) => e.startsWith("switch.") || e.startsWith("binary_sensor.")
        ) || "";
    }
    return { entity };
  }

  _ensureBuilt() {
    if (this._built) return;
    const root = this.shadowRoot;

    const style = document.createElement("style");
    style.textContent = this._css();
    root.appendChild(style);

    const card = document.createElement("ha-card");
    card.innerHTML = `
      <div class="row">
        <div class="icon-box"><ha-icon></ha-icon></div>
        <div class="mid">
          <div class="name"></div>
          <div class="state"></div>
        </div>
        <div class="since"></div>
      </div>`;
    root.appendChild(card);

    const $ = (s) => root.querySelector(s);
    this._els = {
      card,
      iconBox: $(".icon-box"),
      icon: $(".icon-box ha-icon"),
      name: $(".name"),
      state: $(".state"),
      since: $(".since"),
    };

    card.addEventListener("click", () => this._tap());
    this._built = true;
  }

  _css() {
    return `
      :host {
        --_accent: #3F9E6B;
        --_value: var(--serenity-value-color, var(--primary-text-color, #16201b));
        --_muted: var(--serenity-muted-color, var(--secondary-text-color, #9aa3af));
        --_plate: var(--serenity-tile-plate, rgba(120, 130, 138, 0.10));
        --_font: var(--serenity-header-font, "Inter", "Roboto", system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif);
        display: block;
        height: 100%;
        font-family: var(--_font);
      }
      ha-card {
        height: 100%; box-sizing: border-box; padding: 11px 14px; cursor: pointer;
        overflow: hidden; transition: background-color 0.25s ease;
      }
      ha-card.on.tint { background-color: var(--_soft); }
      .row { display: flex; align-items: center; gap: 12px; min-width: 0; height: 100%; }
      .icon-box {
        flex: 0 0 auto; width: 40px; height: 40px; border-radius: 13px;
        background: var(--_plate); display: flex; align-items: center; justify-content: center;
        transition: background 0.25s ease;
      }
      .icon-box ha-icon { --mdc-icon-size: 21px; color: var(--_muted); transition: color 0.25s ease; }
      ha-card.on .icon-box { background: var(--_soft2); }
      ha-card.on .icon-box ha-icon { color: var(--_accent); }
      .mid { flex: 1 1 auto; min-width: 0; }
      .name { font-size: 15px; font-weight: 700; line-height: 1.2; letter-spacing: -0.2px;
        color: var(--_value); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .state { margin-top: 2px; font-size: 12.5px; font-weight: 500; color: var(--_muted);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      ha-card.on .state { color: var(--_accent); font-weight: 600; }
      .since { flex: 0 0 auto; font-size: 12px; font-weight: 500; color: var(--_muted); white-space: nowrap; }
      .since.hidden { display: none; }
      .unavail .name { color: var(--_muted); }
    `;
  }

  _entity() {
    return this._hass && this._config
      ? this._hass.states[this._config.entity]
      : null;
  }

  _update() {
    if (!this._built || !this._config) return;
    const c = this._config;
    const els = this._els;
    const st = this._entity();

    const dc = (st && st.attributes.device_class) || "";
    const meta = DC_META[dc] || null;
    const domain = c.entity.split(".")[0];

    els.name.textContent =
      c.name || (st && st.attributes.friendly_name) || c.entity;
    els.icon.setAttribute(
      "icon",
      c.icon ||
        (st && st.attributes.icon) ||
        (meta && meta.icon) ||
        "mdi:power"
    );

    if (!st || st.state === "unavailable") {
      els.card.classList.add("unavail");
      els.card.classList.remove("on");
      els.state.textContent = "Indisponible";
      els.since.classList.add("hidden");
      return;
    }
    els.card.classList.remove("unavail");

    const on = isActiveState(st.state);
    const labels = c.labels || {};
    const defOn = meta ? meta.on : TOGGLE_DOMAINS.has(domain) ? "Activé" : "Actif";
    const defOff = meta ? meta.off : TOGGLE_DOMAINS.has(domain) ? "Désactivé" : "Inactif";
    els.state.textContent = on ? labels.on || defOn : labels.off || defOff;

    const accent = c.accent || (meta && meta.accent) || "#3F9E6B";
    this.style.setProperty("--_accent", accent);
    this.style.setProperty("--_soft", hexToRgba(accent, 0.12));
    this.style.setProperty("--_soft2", hexToRgba(accent, 0.18));
    els.card.classList.toggle("on", on);
    els.card.classList.toggle("tint", c.tint !== false);

    const since = c.show_since === false ? "" : relativeTime(st.last_changed);
    els.since.textContent = since;
    els.since.classList.toggle("hidden", !since);
  }

  _tap() {
    const c = this._config;
    const ta = c.tap_action;
    const domain = c.entity.split(".")[0];
    const action =
      (ta && ta.action) ||
      (TOGGLE_DOMAINS.has(domain) ? "toggle" : "more-info");
    if (action === "none") return;
    if (action === "toggle" && this._hass) {
      this._hass.callService("homeassistant", "toggle", {
        entity_id: c.entity,
      });
    } else if (action === "navigate" && ta && ta.navigation_path) {
      window.history.pushState(null, "", ta.navigation_path);
      window.dispatchEvent(
        new CustomEvent("location-changed", { detail: { replace: false } })
      );
    } else if (action === "more-info") {
      this.dispatchEvent(
        new CustomEvent("hass-more-info", {
          detail: { entityId: c.entity },
          bubbles: true,
          composed: true,
        })
      );
    }
  }
}

if (!customElements.get("serenity-entity-card")) {
  customElements.define("serenity-entity-card", SerenityEntityCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "serenity-entity-card",
  name: "Serenity Entity",
  description:
    "Entity row with French state labels, relative time and accent tint when active.",
  preview: true,
  documentationURL: "https://github.com/your-username/serenity-cards",
});

/**
 * Serenity Alerts Card — custom:serenity-alerts-card
 *
 * Aggregates household alerts into Serenity-styled rows: open doors and
 * windows, low printer ink, plus custom entity/state rules. When nothing
 * needs attention it shows a calm green "all clear" row.
 */

import { relativeTime } from "../header-utils.js";

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

export class SerenityAlertsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
    this._timer = null;
  }

  setConfig(config) {
    this._config = { ...(config || {}) };
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

  static getStubConfig() {
    return { empty_message: "Vous n'avez aucune alerte !" };
  }

  _ensureBuilt() {
    if (this._built) return;
    const root = this.shadowRoot;

    const style = document.createElement("style");
    style.textContent = this._css();
    root.appendChild(style);

    const card = document.createElement("ha-card");
    card.innerHTML = `<div class="list"></div>`;
    root.appendChild(card);

    this._els = { card, list: root.querySelector(".list") };
    this._built = true;
  }

  _css() {
    return `
      :host {
        --_value: var(--serenity-value-color, var(--primary-text-color, #16201b));
        --_muted: var(--serenity-muted-color, var(--secondary-text-color, #9aa3af));
        --_plate: var(--serenity-tile-plate, rgba(120, 130, 138, 0.10));
        --_ok: var(--serenity-ok-color, #3F9E6B);
        --_font: var(--serenity-header-font, "Inter", "Roboto", system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif);
        display: block;
        font-family: var(--_font);
      }
      ha-card { padding: 8px 10px; overflow: hidden; }
      .list { display: flex; flex-direction: column; }
      .row {
        display: flex; align-items: center; gap: 12px; min-width: 0;
        padding: 8px 6px; border-radius: 12px; cursor: pointer;
      }
      .row + .row { margin-top: 2px; }
      .icon-box {
        flex: 0 0 auto; width: 36px; height: 36px; border-radius: 11px;
        display: flex; align-items: center; justify-content: center;
        background: var(--row-soft, var(--_plate));
      }
      .icon-box ha-icon { --mdc-icon-size: 19px; color: var(--row-accent, var(--_muted)); }
      .msg { flex: 1 1 auto; min-width: 0; font-size: 14px; font-weight: 600; color: var(--_value);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .when { flex: 0 0 auto; font-size: 12px; font-weight: 500; color: var(--_muted); white-space: nowrap; }
      .row.ok { cursor: default; }
      .row.ok .msg { color: var(--_ok); }
    `;
  }

  /** Collect active alerts: {entity, message, icon, color, since}. */
  _alerts() {
    const c = this._config;
    const hs = this._hass.states;
    const out = [];
    const name = (st, id) =>
      (st && st.attributes.friendly_name) || id.split(".")[1];

    for (const id of c.door_entities || []) {
      const st = hs[id];
      if (st && st.state === "on")
        out.push({
          entity: id,
          message: `${name(st, id)} ouverte`,
          icon: "mdi:door-open",
          color: "#E06B5B",
          since: st.last_changed,
        });
    }
    for (const id of c.window_entities || []) {
      const st = hs[id];
      if (st && st.state === "on")
        out.push({
          entity: id,
          message: `${name(st, id)} ouverte`,
          icon: "mdi:window-open-variant",
          color: "#E06B5B",
          since: st.last_changed,
        });
    }
    const inkTh = c.ink_threshold != null ? c.ink_threshold : 15;
    for (const id of c.ink_entities || []) {
      const st = hs[id];
      const v = st ? parseFloat(st.state) : NaN;
      if (!isNaN(v) && v <= inkTh)
        out.push({
          entity: id,
          message: `${name(st, id)} faible (${Math.round(v)}%)`,
          icon: "mdi:printer-alert",
          color: "#E0A95B",
          since: st.last_changed,
        });
    }
    const battTh = c.battery_threshold != null ? c.battery_threshold : 15;
    for (const id of c.battery_entities || []) {
      const st = hs[id];
      const v = st ? parseFloat(st.state) : NaN;
      if (!isNaN(v) && v <= battTh)
        out.push({
          entity: id,
          message: `${name(st, id)} : batterie faible (${Math.round(v)}%)`,
          icon: "mdi:battery-alert-variant-outline",
          color: "#E0A95B",
          since: st.last_changed,
        });
    }
    for (const al of c.alerts || []) {
      const st = hs[al.entity];
      if (!st) continue;
      let hit = false;
      if (al.state != null) hit = String(st.state) === String(al.state);
      else if (al.state_not != null)
        hit = String(st.state) !== String(al.state_not);
      else if (al.below != null) hit = parseFloat(st.state) < al.below;
      else if (al.above != null) hit = parseFloat(st.state) > al.above;
      if (hit)
        out.push({
          entity: al.entity,
          message: al.message || `${name(st, al.entity)} : ${st.state}`,
          icon: al.icon || "mdi:alert-circle-outline",
          color: al.color || "#E0A95B",
          since: st.last_changed,
        });
    }
    // Unavailable watch (opt-in)
    for (const id of c.unavailable_entities || []) {
      const st = hs[id];
      if (!st || st.state === "unavailable")
        out.push({
          entity: id,
          message: `${st ? name(st, id) : id} indisponible`,
          icon: "mdi:lan-disconnect",
          color: "#9aa3af",
          since: st && st.last_changed,
        });
    }
    return out;
  }

  _update() {
    if (!this._built || !this._config || !this._hass) return;
    const c = this._config;
    const list = this._els.list;
    const alerts = this._alerts();
    const max = c.max_alerts || 6;

    list.textContent = "";
    if (!alerts.length) {
      const row = document.createElement("div");
      row.className = "row ok";
      row.style.setProperty("--row-accent", "var(--_ok)");
      row.style.setProperty("--row-soft", hexToRgba("#3F9E6B", 0.14));
      row.innerHTML = `
        <div class="icon-box"><ha-icon icon="mdi:check"></ha-icon></div>
        <div class="msg"></div>`;
      row.querySelector(".msg").textContent =
        c.empty_message || "Vous n'avez aucune alerte !";
      list.appendChild(row);
      return;
    }

    for (const al of alerts.slice(0, max)) {
      const row = document.createElement("div");
      row.className = "row";
      row.style.setProperty("--row-accent", al.color);
      row.style.setProperty("--row-soft", hexToRgba(al.color, 0.13));
      row.innerHTML = `
        <div class="icon-box"><ha-icon></ha-icon></div>
        <div class="msg"></div>
        <div class="when"></div>`;
      row.querySelector("ha-icon").setAttribute("icon", al.icon);
      row.querySelector(".msg").textContent = al.message;
      row.querySelector(".when").textContent = al.since
        ? relativeTime(al.since)
        : "";
      row.addEventListener("click", () => {
        this.dispatchEvent(
          new CustomEvent("hass-more-info", {
            detail: { entityId: al.entity },
            bubbles: true,
            composed: true,
          })
        );
      });
      list.appendChild(row);
    }
  }
}

if (!customElements.get("serenity-alerts-card")) {
  customElements.define("serenity-alerts-card", SerenityAlertsCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "serenity-alerts-card",
  name: "Serenity Alerts",
  description:
    "Household alerts (open doors/windows, low ink/battery, custom rules) with an all-clear state.",
  preview: true,
  documentationURL: "https://github.com/your-username/serenity-cards",
});

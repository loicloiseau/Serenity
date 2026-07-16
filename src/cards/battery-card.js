/**
 * Serenity Battery Card — custom:serenity-battery-card
 *
 * A battery overview: every battery sorted lowest-first, with a level
 * bar, percentage and low/mid colouring. Entities can be listed
 * explicitly and/or auto-discovered (device_class: battery).
 *
 *   entities: [sensor.x, {entity: sensor.y, name: "Voiture", icon: …}]
 *   auto: true            # add every battery sensor found
 *   max_items: 8          # cap the list (default 10)
 *   threshold_low: 20, threshold_mid: 40
 *   show_ok: true         # show healthy batteries too (default true)
 */

import { statesDiffer } from "../header-utils.js";

const LOW_COLOR = "#E06B5B";
const MID_COLOR = "#E0A95B";
const OK_COLOR = "#3F9E6B";

function batteryIcon(lvl, charging) {
  if (charging) return "mdi:battery-charging";
  if (lvl >= 95) return "mdi:battery";
  if (lvl < 10) return "mdi:battery-alert-variant-outline";
  return `mdi:battery-${Math.max(10, Math.round(lvl / 10) * 10)}`;
}

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

export class SerenityBatteryCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
  }

  setConfig(config) {
    this._config = {
      max_items: 10,
      threshold_low: 20,
      threshold_mid: 40,
      ...(config || {}),
    };
    if (this._built) this._update();
  }

  set hass(hass) {
    const prev = this._hass;
    this._hass = hass;
    if (!this.isConnected) return;
    this._ensureBuilt();
    // Skip the re-render when none of the watched entities changed.
    if (prev && !statesDiffer(prev, hass, this._watchedIds())) return;
    this._update();
  }

  _watchedIds() {
    const c = this._config || {};
    if (c.auto === true) return null; // discovery scans all sensors
    return (c.entities || []).map((e) => (typeof e === "string" ? e : e.entity));
  }

  connectedCallback() {
    this._ensureBuilt();
    if (this._hass) this._update();
  }

  getCardSize() {
    return 3;
  }

  static getStubConfig() {
    return { title: "Batteries", auto: true };
  }

  _ensureBuilt() {
    if (this._built) return;
    const root = this.shadowRoot;

    const style = document.createElement("style");
    style.textContent = this._css();
    root.appendChild(style);

    const card = document.createElement("ha-card");
    card.innerHTML = `
      <div class="head hidden"><div class="title"></div><div class="count"></div></div>
      <div class="list"></div>`;
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

    this._els = {
      card,
      head: root.querySelector(".head"),
      title: root.querySelector(".title"),
      count: root.querySelector(".count"),
      list: root.querySelector(".list"),
    };
    this._built = true;
  }

  _css() {
    return `
      :host {
        --_value: var(--serenity-value-color, var(--primary-text-color, #16201b));
        --_muted: var(--serenity-muted-color, var(--secondary-text-color, #9aa3af));
        --_plate: var(--serenity-tile-plate, rgba(120, 130, 138, 0.10));
        --_font: var(--serenity-header-font, "Inter", "Roboto", system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif);
        display: block;
        font-family: var(--_font);
      }
      ha-card { padding: 13px 14px; overflow: hidden; }
      .head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 10px; }
      .head.hidden { display: none; }
      .title { font-size: 14.5px; font-weight: 700; letter-spacing: -0.2px; color: var(--_value); }
      .count { font-size: 12px; font-weight: 600; color: var(--_muted); }
      .list { display: flex; flex-direction: column; gap: 3px; }
      .row {
        display: flex; align-items: center; gap: 10px; min-width: 0;
        padding: 6px 6px; border-radius: 12px; cursor: pointer;
      }
      .row ha-icon { --mdc-icon-size: 18px; color: var(--b-color); flex: 0 0 auto; }
      .b-name { flex: 0 0 auto; width: 34%; min-width: 0; font-size: 13px; font-weight: 600;
        color: var(--_value); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .track { flex: 1 1 auto; height: 7px; border-radius: 999px; background: var(--_plate);
        overflow: hidden; position: relative; }
      .fill { position: absolute; left: 0; top: 0; bottom: 0; width: var(--b-pct, 0%);
        border-radius: 999px; background: var(--b-color); transition: width 0.4s ease; }
      .b-pct-txt { flex: 0 0 auto; min-width: 38px; text-align: right;
        font-size: 12.5px; font-weight: 700; color: var(--b-color);
        font-variant-numeric: tabular-nums; }
      .empty { padding: 6px; font-size: 13px; font-weight: 500; color: var(--_muted); }
    `;
  }

  /** Collect [{entity, name, icon, level}] from config + auto-discovery. */
  _batteries() {
    const c = this._config;
    const hs = this._hass.states;
    const seen = new Set();
    const out = [];

    const push = (id, spec) => {
      if (seen.has(id)) return;
      const st = hs[id];
      if (!st) return;
      const lvl = parseFloat(st.state);
      if (isNaN(lvl)) return;
      seen.add(id);
      out.push({
        entity: id,
        name:
          (spec && spec.name) ||
          (st.attributes.friendly_name || id)
            .replace(/ ?batter(ie|y)( level)?/i, "")
            .trim(),
        icon: spec && spec.icon,
        level: Math.round(lvl),
      });
    };

    for (const e of c.entities || []) {
      if (typeof e === "string") push(e, null);
      else if (e && e.entity) push(e.entity, e);
    }

    if (c.auto === true) {
      for (const id in hs) {
        if (id.indexOf("sensor.") !== 0) continue;
        const st = hs[id];
        if (
          st.attributes.device_class === "battery" &&
          st.attributes.unit_of_measurement === "%" &&
          !isNaN(parseFloat(st.state))
        ) {
          push(id, null);
        }
      }
    }

    out.sort((a, b) => a.level - b.level);
    if (c.show_ok === false) {
      const th = c.threshold_mid;
      return out.filter((b) => b.level <= th);
    }
    return out;
  }

  _update() {
    if (!this._built || !this._config || !this._hass) return;
    const c = this._config;
    const els = this._els;

    const all = this._batteries();
    const list = all.slice(0, c.max_items);
    const low = all.filter((b) => b.level <= c.threshold_low).length;

    els.head.classList.toggle("hidden", !c.title);
    els.title.textContent = c.title || "";
    els.count.textContent = low > 0 ? `${low} faible${low > 1 ? "s" : ""}` : "";

    els.list.textContent = "";
    if (!list.length) {
      const d = document.createElement("div");
      d.className = "empty";
      d.textContent = "Aucune batterie trouvée";
      els.list.appendChild(d);
      return;
    }

    for (const b of list) {
      const color =
        b.level <= c.threshold_low
          ? LOW_COLOR
          : b.level <= c.threshold_mid
            ? MID_COLOR
            : OK_COLOR;
      const row = document.createElement("div");
      row.className = "row";
      row.style.setProperty("--b-color", color);
      row.style.setProperty("--b-pct", `${b.level}%`);
      const charging =
        this._hass.states[b.entity] &&
        this._hass.states[b.entity].attributes.is_charging === true;
      row.innerHTML = `
        <ha-icon icon="${b.icon || batteryIcon(b.level, charging)}"></ha-icon>
        <div class="b-name"></div>
        <div class="track"><div class="fill"></div></div>
        <div class="b-pct-txt">${b.level}%</div>`;
      row.querySelector(".b-name").textContent = b.name;
      row.addEventListener("click", () => {
        this.dispatchEvent(
          new CustomEvent("hass-more-info", {
            detail: { entityId: b.entity },
            bubbles: true,
            composed: true,
          })
        );
      });
      els.list.appendChild(row);
    }
  }
}

if (!customElements.get("serenity-battery-card")) {
  customElements.define("serenity-battery-card", SerenityBatteryCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "serenity-battery-card",
  name: "Serenity Batteries",
  description:
    "Battery overview sorted lowest-first with level bars, thresholds and auto-discovery.",
  preview: true,
  documentationURL: "https://github.com/your-username/serenity-cards",
});

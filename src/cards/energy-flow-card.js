/**
 * Serenity Energy Flow Card — custom:serenity-energy-flow-card
 *
 * Live answer to "where is my power going?": net grid import/export at
 * the top, then a stacked proportion bar and a ranked list of every
 * measured device. When importing, the unmeasured remainder shows as
 * "Autres".
 *
 *   grid_entity: sensor.p1_meter_puissance   # W, negative = export
 *   devices:
 *     - { entity: sensor.x_power, name: Frigo, icon: mdi:fridge-outline, accent: "#8B6FD0" }
 *   title: Répartition en direct
 */

import { statesDiffer } from "../header-utils.js";

const OTHER_COLOR = "#9aa3af";
const DEFAULT_ACCENTS = ["#3FA597", "#E0813F", "#5B9BF5", "#8B6FD0", "#E2B33C", "#D267A0", "#3F9E6B"];

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

function fmtW(w) {
  if (Math.abs(w) >= 1000) return `${(w / 1000).toFixed(2)} kW`;
  return `${Math.round(w)} W`;
}

export class SerenityEnergyFlowCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
  }

  setConfig(config) {
    if (!config || !Array.isArray(config.devices) || !config.devices.length) {
      throw new Error("You must define devices: [{entity, name}]");
    }
    this._config = { ...config };
    if (this._built) this._update();
  }

  set hass(hass) {
    const prev = this._hass;
    this._hass = hass;
    if (!this.isConnected) return;
    this._ensureBuilt();
    if (prev && !statesDiffer(prev, hass, this._watchedIds())) return;
    this._update();
  }

  _watchedIds() {
    const c = this._config || {};
    return [c.grid_entity, ...(c.devices || []).map((d) => d.entity)];
  }

  connectedCallback() {
    this._ensureBuilt();
    if (this._hass) this._update();
  }

  getCardSize() {
    return 4;
  }

  static getStubConfig() {
    return { title: "Répartition en direct", devices: [] };
  }

  _ensureBuilt() {
    if (this._built) return;
    const root = this.shadowRoot;

    const style = document.createElement("style");
    style.textContent = this._css();
    root.appendChild(style);

    const card = document.createElement("ha-card");
    card.innerHTML = `
      <div class="head">
        <div class="title"></div>
        <div class="grid-pill hidden"><ha-icon></ha-icon><span class="g-txt"></span></div>
      </div>
      <div class="stack"></div>
      <div class="rows"></div>`;
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
      title: root.querySelector(".title"),
      gridPill: root.querySelector(".grid-pill"),
      gridIcon: root.querySelector(".grid-pill ha-icon"),
      gridTxt: root.querySelector(".g-txt"),
      stack: root.querySelector(".stack"),
      rows: root.querySelector(".rows"),
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
      .head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 11px; }
      .title { font-size: 14.5px; font-weight: 700; letter-spacing: -0.2px; color: var(--_value); }
      .grid-pill {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 5px 11px; border-radius: 999px;
        background: var(--gp-soft, var(--_plate));
        font-size: 12.5px; font-weight: 700; color: var(--gp-color, var(--_value));
        white-space: nowrap;
      }
      .grid-pill.hidden { display: none; }
      .grid-pill ha-icon { --mdc-icon-size: 15px; color: var(--gp-color); }
      .stack {
        display: flex; height: 12px; border-radius: 999px; overflow: hidden;
        background: var(--_plate); margin-bottom: 12px;
      }
      .seg { height: 100%; transition: width 0.4s ease; }
      .rows { display: flex; flex-direction: column; gap: 3px; }
      .row {
        display: flex; align-items: center; gap: 10px; min-width: 0;
        padding: 6px 6px; border-radius: 12px; cursor: pointer;
      }
      .row ha-icon { --mdc-icon-size: 18px; color: var(--r-color); flex: 0 0 auto; }
      .r-name { flex: 0 0 auto; width: 32%; min-width: 0; font-size: 13px; font-weight: 600;
        color: var(--_value); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .r-track { flex: 1 1 auto; height: 7px; border-radius: 999px; background: var(--_plate);
        overflow: hidden; position: relative; }
      .r-fill { position: absolute; left: 0; top: 0; bottom: 0; width: var(--r-pct, 0%);
        border-radius: 999px; background: var(--r-color); transition: width 0.4s ease; }
      .r-val { flex: 0 0 auto; min-width: 64px; text-align: right;
        font-size: 12.5px; font-weight: 700; color: var(--_value);
        font-variant-numeric: tabular-nums; }
      .r-val .pct { font-size: 11px; font-weight: 600; color: var(--_muted); margin-left: 4px; }
      .row.idle .r-val, .row.idle .r-name { color: var(--_muted); font-weight: 500; }
      .row.idle ha-icon { color: var(--_muted); }
    `;
  }

  _update() {
    if (!this._built || !this._config || !this._hass) return;
    const c = this._config;
    const els = this._els;
    const hs = this._hass.states;

    els.title.textContent = c.title || "Répartition en direct";

    // Net grid pill: import (amber, down arrow) or export (green, up arrow).
    let gridW = null;
    if (c.grid_entity && hs[c.grid_entity]) {
      const v = parseFloat(hs[c.grid_entity].state);
      if (!isNaN(v)) gridW = c.invert === true ? -v : v;
    }
    els.gridPill.classList.toggle("hidden", gridW == null);
    if (gridW != null) {
      const exporting = gridW < -5;
      const idle = Math.abs(gridW) <= 5;
      const color = idle ? "#9aa3af" : exporting ? "#3F9E6B" : "#E0A95B";
      els.gridIcon.setAttribute(
        "icon",
        exporting ? "mdi:transmission-tower-import" : "mdi:transmission-tower-export"
      );
      els.gridTxt.textContent = idle
        ? "Réseau · 0 W"
        : `${exporting ? "Export" : "Import"} · ${fmtW(Math.abs(gridW))}`;
      els.gridPill.style.setProperty("--gp-color", color);
      els.gridPill.style.setProperty("--gp-soft", hexToRgba(color, 0.14));
    }

    // Measured devices.
    const items = [];
    (c.devices || []).forEach((d, i) => {
      const st = hs[d.entity];
      const v = st ? parseFloat(st.state) : NaN;
      items.push({
        entity: d.entity,
        name: d.name || (st && st.attributes.friendly_name) || d.entity,
        icon: d.icon || "mdi:power-plug-outline",
        color: d.accent || DEFAULT_ACCENTS[i % DEFAULT_ACCENTS.length],
        w: isNaN(v) ? null : Math.max(0, v),
      });
    });

    const measured = items.reduce((s, it) => s + (it.w || 0), 0);

    // Unmeasured remainder — only knowable while importing (no PV sensor).
    let other = null;
    if (gridW != null && gridW > 10 && gridW - measured > 10) {
      other = gridW - measured;
    }
    const total = measured + (other || 0);

    // Stacked bar.
    els.stack.textContent = "";
    if (total > 0) {
      for (const it of items) {
        if (!it.w || it.w < 0.5) continue;
        const seg = document.createElement("div");
        seg.className = "seg";
        seg.style.width = `${((it.w / total) * 100).toFixed(1)}%`;
        seg.style.background = it.color;
        els.stack.appendChild(seg);
      }
      if (other) {
        const seg = document.createElement("div");
        seg.className = "seg";
        seg.style.width = `${((other / total) * 100).toFixed(1)}%`;
        seg.style.background = hexToRgba(OTHER_COLOR, 0.55);
        els.stack.appendChild(seg);
      }
    }

    // Ranked rows (active first, then idle/unknown).
    const rows = items
      .slice()
      .sort((a, b) => (b.w || 0) - (a.w || 0));
    if (other) {
      let idx = rows.findIndex((r) => !r.w || r.w < 0.5);
      if (idx === -1) idx = rows.length;
      rows.splice(idx, 0, {
        name: "Autres",
        icon: "mdi:home-lightning-bolt-outline",
        color: OTHER_COLOR,
        w: other,
        entity: null,
      });
    }

    els.rows.textContent = "";
    for (const it of rows) {
      const active = it.w != null && it.w >= 0.5;
      const pct = active && total > 0 ? (it.w / total) * 100 : 0;
      const row = document.createElement("div");
      row.className = "row" + (active ? "" : " idle");
      row.style.setProperty("--r-color", it.color);
      row.style.setProperty("--r-pct", `${pct.toFixed(1)}%`);
      row.innerHTML = `
        <ha-icon icon="${it.icon}"></ha-icon>
        <div class="r-name"></div>
        <div class="r-track"><div class="r-fill"></div></div>
        <div class="r-val"></div>`;
      row.querySelector(".r-name").textContent = it.name;
      row.querySelector(".r-val").innerHTML = active
        ? `${fmtW(it.w)}<span class="pct">${Math.round(pct)}%</span>`
        : it.w === 0
          ? "0 W"
          : "—";
      if (it.entity) {
        row.addEventListener("click", () => {
          this.dispatchEvent(
            new CustomEvent("hass-more-info", {
              detail: { entityId: it.entity },
              bubbles: true,
              composed: true,
            })
          );
        });
      }
      els.rows.appendChild(row);
    }
  }
}

if (!customElements.get("serenity-energy-flow-card")) {
  customElements.define("serenity-energy-flow-card", SerenityEnergyFlowCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "serenity-energy-flow-card",
  name: "Serenity Energy Flow",
  description:
    "Live power distribution: net grid pill, stacked bar and ranked device list.",
  preview: false,
  documentationURL: "https://github.com/your-username/serenity-cards",
});

/**
 * Serenity Charger Card — custom:serenity-charger-card
 *
 * EV charging station (Peblar/rebrands, or any charger split into
 * entities): state pill, live power, session/total energy, and two
 * bottom-sheet controls — charge-current limit and smart-charging mode.
 *
 *   name: Borne
 *   state_entity: sensor.x_state              # enum (charging, suspended…)
 *   power_entity: sensor.x_puissance          # W
 *   session_entity: sensor.x_energie_session  # kWh
 *   total_entity: sensor.x_energie_totale     # kWh
 *   current_entity: sensor.x_courant          # A (shown while charging)
 *   limit_entity: number.x_limite             # A — tap chip -> sheet
 *   limit_presets: [6, 10, 16, 20, 25, 32]
 *   mode_entity: select.x_charge_intelligente # tap chip -> sheet
 *   switch_entity: switch.x_charge            # power button
 *   error_entity: binary_sensor.x_errors      # red banner when on
 */

import { statesDiffer } from "../header-utils.js";
import { SHEET_CSS, createSheet } from "../sheet.js";

const STATE_META = {
  charging: { label: "En charge", color: "#3F9E6B", icon: "mdi:battery-charging" },
  ev_connected: { label: "Véhicule branché", color: "#5B9BF5", icon: "mdi:car-electric-outline" },
  suspended: { label: "En pause", color: "#E0A95B", icon: "mdi:pause-circle-outline" },
  no_ev_connected: { label: "Aucun véhicule", color: "#9aa3af", icon: "mdi:ev-plug-type2" },
  error: { label: "Erreur", color: "#E06B5B", icon: "mdi:alert-circle-outline" },
  fault: { label: "Défaut", color: "#E06B5B", icon: "mdi:alert-circle-outline" },
  invalid: { label: "Erreur", color: "#E06B5B", icon: "mdi:alert-circle-outline" },
};

const titleCase = (s) =>
  String(s || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());

function hexToRgba(hex, a) {
  const h = String(hex).replace("#", "");
  const n =
    h.length === 3
      ? h
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : h;
  return `rgba(${parseInt(n.substr(0, 2), 16)}, ${parseInt(n.substr(2, 2), 16)}, ${parseInt(n.substr(4, 2), 16)}, ${a})`;
}

export class SerenityChargerCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
  }

  setConfig(config) {
    if (!config || (!config.state_entity && !config.power_entity)) {
      throw new Error("You must define state_entity or power_entity");
    }
    this._config = { limit_presets: [6, 10, 16, 20, 25, 32], ...config };
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
    return [
      c.state_entity,
      c.power_entity,
      c.session_entity,
      c.total_entity,
      c.current_entity,
      c.limit_entity,
      c.mode_entity,
      c.switch_entity,
      c.error_entity,
    ];
  }

  connectedCallback() {
    this._ensureBuilt();
    if (this._hass) this._update();
  }

  getCardSize() {
    return 3;
  }

  static getStubConfig() {
    return { name: "Borne de recharge" };
  }

  _ensureBuilt() {
    if (this._built) return;
    const root = this.shadowRoot;

    const style = document.createElement("style");
    style.textContent = this._css();
    root.appendChild(style);

    const card = document.createElement("ha-card");
    card.innerHTML = `
      <div class="err hidden"><ha-icon icon="mdi:alert-circle-outline"></ha-icon><span>La borne signale une erreur</span></div>
      <div class="top">
        <div class="hleft">
          <div class="icon-box"><ha-icon icon="mdi:ev-station"></ha-icon></div>
          <div class="htxt">
            <div class="name"></div>
            <div class="status"><span class="dot"></span><span class="status-text"></span></div>
          </div>
        </div>
        <button class="pbtn" title="Charge"><ha-icon icon="mdi:power"></ha-icon></button>
      </div>
      <div class="stats">
        <div class="stat power"><span class="s-val"><span class="p-num">—</span><span class="s-unit p-unit">W</span></span><span class="s-lab">Puissance</span></div>
        <div class="stat session hidden"><span class="s-val"><span class="se-num">—</span><span class="s-unit">kWh</span></span><span class="s-lab">Session</span></div>
        <div class="stat total hidden"><span class="s-val"><span class="to-num">—</span><span class="s-unit">kWh</span></span><span class="s-lab">Total</span></div>
      </div>
      <div class="chips">
        <button class="chip limit hidden"><ha-icon icon="mdi:speedometer"></ha-icon><span class="li-txt"></span></button>
        <button class="chip mode hidden"><ha-icon icon="mdi:lightning-bolt-outline"></ha-icon><span class="mo-txt"></span></button>
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
      err: $(".err"),
      iconBox: $(".icon-box"),
      icon: $(".icon-box ha-icon"),
      name: $(".name"),
      dot: $(".dot"),
      statusText: $(".status-text"),
      pbtn: $(".pbtn"),
      pNum: $(".p-num"),
      pUnit: $(".p-unit"),
      session: $(".stat.session"),
      seNum: $(".se-num"),
      total: $(".stat.total"),
      toNum: $(".to-num"),
      limit: $(".chip.limit"),
      liTxt: $(".li-txt"),
      mode: $(".chip.mode"),
      moTxt: $(".mo-txt"),
    };

    this._els.pbtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._toggleCharge();
    });
    this._els.limit.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._sheetLimit();
    });
    this._els.mode.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._sheetMode();
    });
    card.addEventListener("click", () => this._moreInfo());

    this._sheet = createSheet(root);
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
        font-family: var(--_font);
      }
      ha-card { padding: 13px 14px; overflow: hidden; cursor: pointer; }
      .err {
        display: flex; align-items: center; gap: 8px;
        margin-bottom: 10px; padding: 9px 12px; border-radius: 13px;
        background: rgba(224, 107, 91, 0.14); color: #E06B5B;
        font-size: 13px; font-weight: 600;
      }
      .err ha-icon { --mdc-icon-size: 17px; }
      .err.hidden { display: none; }
      .top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .hleft { display: flex; align-items: center; gap: 11px; min-width: 0; }
      .icon-box {
        flex: 0 0 auto; width: 42px; height: 42px; border-radius: 13px;
        background: var(--_soft, var(--_plate));
        display: flex; align-items: center; justify-content: center;
        transition: background 0.25s ease;
      }
      .icon-box ha-icon { --mdc-icon-size: 23px; color: var(--_accent); transition: color 0.25s ease; }
      .htxt { min-width: 0; }
      .name { font-size: 15px; font-weight: 700; letter-spacing: -0.2px; color: var(--_value);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .status { display: flex; align-items: center; gap: 6px; margin-top: 3px;
        font-size: 12.5px; font-weight: 500; color: var(--_muted); }
      .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--_accent); flex: 0 0 auto; }
      .pbtn {
        flex: 0 0 auto; width: 40px; height: 34px; border: none; border-radius: 11px;
        background: var(--_plate); color: var(--_muted); cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: background 0.2s ease, color 0.2s ease;
      }
      .pbtn ha-icon { --mdc-icon-size: 20px; }
      .pbtn.on { background: var(--_soft, var(--_plate)); color: var(--_accent); }
      .pbtn.hidden { display: none; }
      .stats { display: flex; gap: 8px; margin-top: 13px; }
      .stat {
        flex: 1 1 0; display: flex; flex-direction: column; align-items: center; gap: 2px;
        padding: 10px 6px 9px; border-radius: 14px; background: var(--_plate);
      }
      .stat.hidden { display: none; }
      .s-val { display: flex; align-items: flex-start; line-height: 1; }
      .p-num, .se-num, .to-num { font-size: 19px; font-weight: 800; letter-spacing: -0.5px; color: var(--_value); }
      .stat.power .p-num { color: var(--_accent); }
      .s-unit { font-size: 11px; font-weight: 700; color: var(--_muted); margin-left: 2px; margin-top: 1px; }
      .s-lab { font-size: 11px; font-weight: 600; color: var(--_muted); }
      .chips { display: flex; gap: 8px; margin-top: 10px; }
      .chips:empty { display: none; }
      .chip {
        flex: 1 1 0; display: flex; align-items: center; justify-content: center; gap: 6px;
        border: none; cursor: pointer; font-family: inherit;
        padding: 9px 10px; border-radius: 13px; background: var(--_plate);
        font-size: 12.5px; font-weight: 600; color: var(--_value);
        transition: background 0.15s ease;
        -webkit-tap-highlight-color: transparent;
      }
      .chip:active { background: rgba(120, 130, 138, 0.18); }
      .chip ha-icon { --mdc-icon-size: 16px; color: var(--_muted); }
      .chip.hidden { display: none; }
      ${SHEET_CSS}
      .m-row {
        display: flex; align-items: center; gap: 12px; width: 100%;
        border: none; background: none; cursor: pointer; text-align: left;
        padding: 13px 14px; border-radius: 14px; font-family: inherit;
        font-size: 15px; font-weight: 600; color: var(--_value);
        transition: background 0.12s ease;
        -webkit-tap-highlight-color: transparent;
      }
      .m-row:hover, .m-row:active { background: var(--_plate); }
      .m-row .m-label { flex: 1 1 auto; min-width: 0; }
      .m-row.current { color: var(--_accent); }
      .m-row .m-check { --mdc-icon-size: 17px; color: var(--_accent); }
    `;
  }

  _st(id) {
    return id && this._hass ? this._hass.states[id] : null;
  }

  _update() {
    if (!this._built || !this._config || !this._hass) return;
    const c = this._config;
    const els = this._els;

    const stateSt = this._st(c.state_entity);
    const rawState = stateSt ? stateSt.state : null;
    const meta =
      (rawState && STATE_META[rawState]) || {
        label: rawState ? titleCase(rawState) : "—",
        color: "#9aa3af",
        icon: "mdi:ev-station",
      };

    els.name.textContent =
      c.name || (stateSt && stateSt.attributes.friendly_name) || "Borne de recharge";
    this.style.setProperty("--_accent", meta.color);
    this.style.setProperty("--_soft", hexToRgba(meta.color, 0.14));
    els.icon.setAttribute("icon", c.icon || "mdi:ev-station");
    els.dot.style.background = meta.color;

    // Status line: state, plus live amps while charging.
    let status = meta.label;
    const curSt = this._st(c.current_entity);
    const amps = curSt ? parseFloat(curSt.state) : NaN;
    if (rawState === "charging" && !isNaN(amps) && amps > 0) {
      status += ` · ${amps.toFixed(1)} A`;
    }
    els.statusText.textContent = status;

    // Error banner.
    const errSt = this._st(c.error_entity);
    els.err.classList.toggle("hidden", !(errSt && errSt.state === "on"));

    // Charge switch button.
    const swSt = this._st(c.switch_entity);
    els.pbtn.classList.toggle("hidden", !swSt);
    if (swSt) els.pbtn.classList.toggle("on", swSt.state === "on");

    // Stats.
    const powSt = this._st(c.power_entity);
    const w = powSt ? parseFloat(powSt.state) : NaN;
    if (isNaN(w)) {
      els.pNum.textContent = "—";
      els.pUnit.textContent = "W";
    } else if (Math.abs(w) >= 1000) {
      els.pNum.textContent = (w / 1000).toFixed(2);
      els.pUnit.textContent = "kW";
    } else {
      els.pNum.textContent = String(Math.round(w));
      els.pUnit.textContent = "W";
    }
    const seSt = this._st(c.session_entity);
    const se = seSt ? parseFloat(seSt.state) : NaN;
    els.session.classList.toggle("hidden", !seSt);
    if (!isNaN(se)) els.seNum.textContent = se >= 100 ? Math.round(se) : se.toFixed(1);
    const toSt = this._st(c.total_entity);
    const to = toSt ? parseFloat(toSt.state) : NaN;
    els.total.classList.toggle("hidden", !toSt);
    if (!isNaN(to)) els.toNum.textContent = Math.round(to);

    // Chips.
    const liSt = this._st(c.limit_entity);
    els.limit.classList.toggle("hidden", !liSt);
    if (liSt) els.liTxt.textContent = `Limite · ${parseFloat(liSt.state)} A`;
    const moSt = this._st(c.mode_entity);
    els.mode.classList.toggle("hidden", !moSt);
    if (moSt) els.moTxt.textContent = `Mode · ${titleCase(moSt.state)}`;
  }

  /* ----------------------------- actions ----------------------------- */

  _toggleCharge() {
    const c = this._config;
    const swSt = this._st(c.switch_entity);
    if (!swSt) return;
    this._hass.callService("switch", "toggle", { entity_id: c.switch_entity });
  }

  _openRows(title, items, current, onPick) {
    const sheet = this._sheet;
    sheet.title.textContent = title;
    sheet.body.textContent = "";
    for (const it of items) {
      const row = document.createElement("button");
      row.className = "m-row" + (it.value === current ? " current" : "");
      const lab = document.createElement("span");
      lab.className = "m-label";
      lab.textContent = it.label;
      row.appendChild(lab);
      if (it.value === current) {
        const check = document.createElement("ha-icon");
        check.className = "m-check";
        check.setAttribute("icon", "mdi:check");
        row.appendChild(check);
      }
      row.addEventListener("click", (ev) => {
        ev.stopPropagation();
        sheet.close();
        if (it.value !== current) onPick(it.value);
      });
      sheet.body.appendChild(row);
    }
    sheet.open();
  }

  _sheetLimit() {
    const c = this._config;
    const liSt = this._st(c.limit_entity);
    if (!liSt) return;
    const min = parseFloat(liSt.attributes.min);
    const max = parseFloat(liSt.attributes.max);
    const cur = parseFloat(liSt.state);
    const presets = (c.limit_presets || [])
      .filter((p) => (isNaN(min) || p >= min) && (isNaN(max) || p <= max));
    this._openRows(
      "Limite de recharge",
      presets.map((p) => ({ value: p, label: `${p} A` })),
      cur,
      (v) =>
        this._hass.callService("number", "set_value", {
          entity_id: c.limit_entity,
          value: v,
        })
    );
  }

  _sheetMode() {
    const c = this._config;
    const moSt = this._st(c.mode_entity);
    if (!moSt) return;
    const options = moSt.attributes.options || [];
    this._openRows(
      "Charge intelligente",
      options.map((o) => ({ value: o, label: titleCase(o) })),
      moSt.state,
      (v) =>
        this._hass.callService("select", "select_option", {
          entity_id: c.mode_entity,
          option: v,
        })
    );
  }

  _moreInfo() {
    const ent =
      this._config.power_entity ||
      this._config.state_entity ||
      this._config.session_entity;
    if (!ent) return;
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId: ent },
        bubbles: true,
        composed: true,
      })
    );
  }
}

if (!customElements.get("serenity-charger-card")) {
  customElements.define("serenity-charger-card", SerenityChargerCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "serenity-charger-card",
  name: "Serenity Charger",
  description:
    "EV charging station: state, live power, session energy, current limit and smart-charging mode.",
  preview: false,
  documentationURL: "https://github.com/your-username/serenity-cards",
});

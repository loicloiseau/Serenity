/**
 * Serenity Thermostat Card — custom:serenity-thermostat-card
 *
 * A friendly thermostat with a circular set-point gauge, +/- steppers,
 * a power toggle and current temperature / humidity tiles. Tuned to match
 * the Serenity theme; the accent follows the current hvac action.
 */

const R = 80; // gauge radius (viewBox units)
const C = 2 * Math.PI * R; // circumference
const ARC = 0.75; // visible portion of the ring (270°)

// French action labels (matches the Serenity mock). Override via config.labels.
const ACTION_FR = {
  heating: "Chauffe",
  cooling: "Refroidit",
  drying: "Déshumidifie",
  fan: "Ventilation",
  preheating: "Préchauffe",
  defrosting: "Dégivrage",
  idle: "En veille",
  off: "Éteint",
};

const ACTION_COLOR = {
  heating: "#E0813F",
  preheating: "#E0813F",
  cooling: "#5B9BF5",
  drying: "#5BB6C9",
  defrosting: "#5BB6C9",
  fan: "#8AA0B8",
  idle: "#9aa3af",
  off: "#9aa3af",
};

const titleCase = (s) =>
  String(s || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

function hexToRgba(hex, a) {
  const h = String(hex).replace("#", "");
  const n =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const r = parseInt(n.substr(0, 2), 16);
  const g = parseInt(n.substr(2, 2), 16);
  const b = parseInt(n.substr(4, 2), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export class SerenityThermostatCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
    this._lastMode = null;
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("You must define a climate entity");
    }
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
    return 5;
  }

  static getStubConfig(hass) {
    let entity = "";
    if (hass && hass.states) {
      entity =
        Object.keys(hass.states).find((e) => e.startsWith("climate.")) || "";
    }
    return { entity, secondary: "Maison · principal" };
  }

  /* ----------------------------- DOM build ----------------------------- */

  _ensureBuilt() {
    if (this._built) return;
    const root = this.shadowRoot;

    const style = document.createElement("style");
    style.textContent = this._css();
    root.appendChild(style);

    const card = document.createElement("ha-card");
    card.innerHTML = `
      <div class="head">
        <div class="hleft">
          <div class="icon-box"><ha-icon></ha-icon></div>
          <div class="htext">
            <div class="name"></div>
            <div class="sub"></div>
          </div>
        </div>
        <button class="iconbtn power" title="Power"><ha-icon icon="mdi:power"></ha-icon></button>
      </div>

      <div class="dial">
        <svg class="gauge" viewBox="0 0 200 200" aria-hidden="true">
          <circle class="track" cx="100" cy="100" r="${R}"></circle>
          <circle class="prog" cx="100" cy="100" r="${R}"></circle>
        </svg>
        <div class="center">
          <div class="consigne">CONSIGNE</div>
          <div class="value"><span class="num">—</span><span class="deg">°</span></div>
          <div class="pill"><span class="pdot"></span><span class="ptext"></span></div>
        </div>
      </div>

      <div class="steppers">
        <button class="step minus" title="Baisser"><ha-icon icon="mdi:minus"></ha-icon></button>
        <button class="step plus" title="Monter"><ha-icon icon="mdi:plus"></ha-icon></button>
      </div>

      <div class="tiles">
        <div class="tile">
          <div class="tlabel">Actuelle</div>
          <div class="tval"><span class="cur-num">—</span><span class="tunit cur-unit"></span></div>
        </div>
        <div class="tile">
          <div class="tlabel">Humidité</div>
          <div class="tval"><span class="hum-num">—</span><span class="tunit">%</span></div>
        </div>
      </div>`;
    root.appendChild(card);

    const $ = (s) => root.querySelector(s);
    this._els = {
      card,
      head: $(".head"),
      iconBox: $(".icon-box"),
      icon: $(".icon-box ha-icon"),
      name: $(".name"),
      sub: $(".sub"),
      power: $(".iconbtn.power"),
      track: $(".track"),
      prog: $(".prog"),
      num: $(".num"),
      pill: $(".pill"),
      pillDot: $(".pdot"),
      pillText: $(".ptext"),
      minus: $(".step.minus"),
      plus: $(".step.plus"),
      curNum: $(".cur-num"),
      curUnit: $(".cur-unit"),
      humTile: $(".tile:last-child"),
      humNum: $(".hum-num"),
    };

    // Static track dash: 270° arc.
    this._els.track.style.strokeDasharray = `${(ARC * C).toFixed(2)} ${C.toFixed(2)}`;
    this._els.prog.style.strokeDasharray = `0 ${C.toFixed(2)}`;

    const stop = (fn) => (ev) => {
      ev.stopPropagation();
      fn();
    };
    this._els.head.addEventListener("click", () => this._moreInfo());
    this._els.power.addEventListener(
      "click",
      stop(() => this._togglePower()),
    );
    this._els.minus.addEventListener(
      "click",
      stop(() => this._step(-1)),
    );
    this._els.plus.addEventListener(
      "click",
      stop(() => this._step(1)),
    );

    this._built = true;
  }

  _css() {
    return `
      :host {
        --_accent: var(--serenity-thermostat-color, #E0813F);
        --_soft: var(--serenity-thermostat-soft, rgba(224, 129, 63, 0.14));
        --_track: var(--serenity-thermostat-track, #E8EBE9);
        --_value: var(--serenity-value-color, var(--primary-text-color, #16201b));
        --_muted: var(--serenity-muted-color, var(--secondary-text-color, #9aa3af));
        --_tile: var(--serenity-tile-bg, #f3f5f4);
        --_font: var(--serenity-header-font, "Inter", "Roboto", system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif);
        display: block;
        font-family: var(--_font);
      }
      ha-card { padding: 12px 14px; border-radius: var(--ha-card-border-radius, 18px); }

      /* Header */
      .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; cursor: pointer; }
      .hleft { display: flex; align-items: center; gap: 10px; min-width: 0; }
      .icon-box {
        flex: 0 0 auto; width: 34px; height: 34px; border-radius: 11px;
        background: var(--_soft); display: flex; align-items: center; justify-content: center;
      }
      .icon-box ha-icon { --mdc-icon-size: 18px; color: var(--_accent); }
      .htext { min-width: 0; }
      .name { font-size: 15px; font-weight: 700; line-height: 1.2; color: var(--_value); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sub { font-size: 12.5px; font-weight: 500; color: var(--_muted); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sub.hidden { display: none; }
      .iconbtn {
        flex: 0 0 auto; width: 34px; height: 34px; border: none; padding: 0; cursor: pointer;
        border-radius: 11px; background: var(--_soft); color: var(--_accent);
        display: flex; align-items: center; justify-content: center;
        transition: background 0.2s ease, color 0.2s ease, transform 0.05s ease;
      }
      .iconbtn ha-icon { --mdc-icon-size: 18px; }
      .iconbtn:active { transform: scale(0.94); }
      .iconbtn.off { background: var(--_tile); color: var(--_muted); }

      /* Dial */
      .dial { position: relative; display: flex; align-items: center; justify-content: center; margin: 0; }
      .gauge { width: 100%; max-width: 148px; height: auto; display: block; transform: rotate(135deg); }
      .track { fill: none; stroke: var(--_track); stroke-width: 12; stroke-linecap: round; }
      .prog { fill: none; stroke: var(--_accent); stroke-width: 12; stroke-linecap: round; transition: stroke-dasharray 0.45s ease, stroke 0.3s ease; }
      .center {
        position: absolute; display: flex; flex-direction: column; align-items: center;
        gap: 4px; transform: translateY(-3px); pointer-events: none;
      }
      .consigne { font-size: 9.5px; font-weight: 700; letter-spacing: 0.13em; color: var(--_muted); }
      .value { display: flex; align-items: flex-start; color: var(--_value); line-height: 1; }
      .num { font-size: 33px; font-weight: 800; letter-spacing: -1px; }
      .deg { font-size: 15px; font-weight: 700; color: var(--_muted); margin-top: 3px; }
      .pill {
        display: inline-flex; align-items: center; gap: 5px;
        background: var(--_soft); padding: 3px 10px; border-radius: 999px;
      }
      .pill.hidden { display: none; }
      .pdot { width: 5px; height: 5px; border-radius: 50%; background: var(--_accent); }
      .ptext { font-size: 11.5px; font-weight: 600; color: var(--_accent); }

      /* Steppers */
      .steppers { display: flex; align-items: center; justify-content: center; gap: 12px; margin: 0 0 10px; }
      .step {
        width: 42px; height: 42px; border: none; padding: 0; cursor: pointer;
        border-radius: 13px; display: flex; align-items: center; justify-content: center;
        transition: background 0.2s ease, transform 0.05s ease;
      }
      .step ha-icon { --mdc-icon-size: 20px; }
      .step.minus { background: var(--_tile); color: var(--_value); }
      .step.plus { background: var(--_soft); color: var(--_accent); }
      .step:active { transform: scale(0.93); }

      /* Tiles */
      .tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .tile { background: var(--_tile); border-radius: 12px; padding: 8px 12px; }
      .tlabel { font-size: 12px; font-weight: 500; color: var(--_muted); }
      .tval { margin-top: 2px; color: var(--_value); display: flex; align-items: baseline; }
      .tval .cur-num, .tval .hum-num { font-size: 17px; font-weight: 800; letter-spacing: -0.4px; }
      .tunit { font-size: 13px; font-weight: 600; color: var(--_muted); margin-left: 2px; }
      .tile.hidden { display: none; }
      .tiles.single { grid-template-columns: 1fr; }

      .step[disabled], .iconbtn[disabled] { opacity: 0.4; cursor: default; }
    `;
  }

  /* --------------------------- live updates --------------------------- */

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

    els.icon.setAttribute("icon", c.icon || "mdi:thermostat");
    els.name.textContent =
      c.name || (st && st.attributes.friendly_name) || c.entity;
    els.sub.textContent = c.secondary || "";
    els.sub.classList.toggle("hidden", !c.secondary);

    if (!st || st.state === "unavailable") {
      this._setAccent("#9aa3af");
      els.num.textContent = "—";
      els.pill.classList.add("hidden");
      els.curNum.textContent = "—";
      els.curUnit.textContent = "";
      els.humNum.textContent = "—";
      [els.minus, els.plus, els.power].forEach((b) => (b.disabled = true));
      this._setProgress(0);
      return;
    }

    const a = st.attributes;
    const mode = st.state; // hvac mode
    const action = a.hvac_action;
    const isOn = mode !== "off";
    if (isOn) this._lastMode = mode;

    // Accent follows action (or mode), unless overridden in config.
    let accent = c.accent;
    if (!accent) {
      if (action && ACTION_COLOR[action]) accent = ACTION_COLOR[action];
      else accent = isOn ? "#E0813F" : "#9aa3af";
    }
    this._setAccent(accent);

    // State pill
    const labels = c.labels || {};
    const key = action || (isOn ? "heating" : "off");
    const pillText = labels[key] || ACTION_FR[key] || titleCase(key);
    const showPill = c.show_state !== false && !!pillText;
    els.pill.classList.toggle("hidden", !showPill);
    els.pillText.textContent = pillText;

    // Set-point + gauge
    const attr = c.setpoint_attribute || "temperature";
    const target = parseFloat(a[attr]);
    const min = c.min != null ? c.min : a.min_temp != null ? a.min_temp : 7;
    const max = c.max != null ? c.max : a.max_temp != null ? a.max_temp : 35;
    if (!isNaN(target)) {
      els.num.textContent = this._fmt(target);
      const frac = Math.max(0, Math.min(1, (target - min) / (max - min || 1)));
      this._setProgress(frac);
      els.minus.disabled = false;
      els.plus.disabled = false;
    } else {
      els.num.textContent = "—";
      this._setProgress(0);
      els.minus.disabled = true;
      els.plus.disabled = true;
    }

    els.power.disabled = false;
    els.power.classList.toggle("off", !isOn);

    // Current temperature tile
    const unit =
      c.unit ||
      (this._hass.config &&
        this._hass.config.unit_system &&
        this._hass.config.unit_system.temperature) ||
      "°C";
    const cur = a.current_temperature;
    els.curNum.textContent = cur != null ? this._fmt(cur) : "—";
    els.curUnit.textContent = cur != null ? unit : "";

    // Humidity tile (explicit entity > climate attribute)
    const hum = this._humidity(a);
    const hasHum = hum != null && c.show_humidity !== false;
    els.humTile.classList.toggle("hidden", !hasHum);
    els.card
      .querySelector(".tiles")
      .classList.toggle("single", !hasHum);
    if (hasHum) els.humNum.textContent = this._fmt(hum);
  }

  _humidity(a) {
    const ent = this._config.humidity_entity;
    if (ent && this._hass && this._hass.states[ent]) {
      const v = parseFloat(this._hass.states[ent].state);
      return isNaN(v) ? null : v;
    }
    if (a && a.current_humidity != null) return a.current_humidity;
    return null;
  }

  _setProgress(frac) {
    const len = ARC * C * frac;
    this._els.prog.style.strokeDasharray = `${len.toFixed(2)} ${C.toFixed(2)}`;
  }

  _setAccent(color) {
    this.style.setProperty("--_accent", color);
    if (!this._config.accent_soft && /^#/.test(color)) {
      this.style.setProperty("--_soft", hexToRgba(color, 0.14));
    } else if (this._config.accent_soft) {
      this.style.setProperty("--_soft", this._config.accent_soft);
    }
  }

  _fmt(v) {
    if (v == null || isNaN(v)) return "—";
    return Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10);
  }

  /* ----------------------------- actions ----------------------------- */

  _service(service, data) {
    this._hass.callService("climate", service, {
      entity_id: this._config.entity,
      ...data,
    });
  }

  _step(dir) {
    const st = this._entity();
    if (!st) return;
    const a = st.attributes;
    const attr = this._config.setpoint_attribute || "temperature";
    const cur = parseFloat(a[attr]);
    if (isNaN(cur)) return;
    const step = a.target_temp_step || this._config.step || 0.5;
    const min = this._config.min != null ? this._config.min : a.min_temp != null ? a.min_temp : 7;
    const max = this._config.max != null ? this._config.max : a.max_temp != null ? a.max_temp : 35;
    let next = Math.min(max, Math.max(min, cur + dir * step));
    next = Math.round(next / step) * step;
    next = Math.round(next * 100) / 100;
    this._service("set_temperature", { [attr]: next });
  }

  _togglePower() {
    const st = this._entity();
    if (!st) return;
    if (st.state === "off") {
      const modes = (st.attributes.hvac_modes || []).filter((m) => m !== "off");
      const target =
        this._lastMode && modes.includes(this._lastMode)
          ? this._lastMode
          : modes[0];
      if (target) this._service("set_hvac_mode", { hvac_mode: target });
      else this._service("turn_on", {});
    } else {
      this._service("set_hvac_mode", { hvac_mode: "off" });
    }
  }

  _moreInfo() {
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId: this._config.entity },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

if (!customElements.get("serenity-thermostat-card")) {
  customElements.define("serenity-thermostat-card", SerenityThermostatCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "serenity-thermostat-card",
  name: "Serenity Thermostat",
  description:
    "Thermostat with a circular set-point gauge, steppers, power toggle and current temp / humidity tiles.",
  preview: true,
  documentationURL: "https://github.com/your-username/serenity-cards",
});

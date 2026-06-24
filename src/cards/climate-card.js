/**
 * Serenity Climate Card — custom:serenity-climate-card
 *
 * A compact controller for climate entities (heat pumps, AC, thermostats):
 * power + mode toggle, target-temperature steppers, and fan / swing chips.
 * Accent colour follows the current action (cool = blue, heat = warm, etc.).
 */

const MODE_META = {
  off: { icon: "mdi:power", label: "Off" },
  cool: { icon: "mdi:snowflake", label: "Cooling", color: "#5B9BF5" },
  heat: { icon: "mdi:fire", label: "Heating", color: "#E0795B" },
  heat_cool: {
    icon: "mdi:sun-snowflake-variant",
    label: "Auto",
    color: "#7C8BAE",
  },
  auto: { icon: "mdi:thermostat-auto", label: "Auto", color: "#7C8BAE" },
  dry: { icon: "mdi:water-percent", label: "Drying", color: "#5BB6C9" },
  fan_only: { icon: "mdi:fan", label: "Fan", color: "#8AA0B8" },
};

const ACTION_META = {
  cooling: { label: "Cooling", color: "#5B9BF5" },
  heating: { label: "Heating", color: "#E0795B" },
  drying: { label: "Drying", color: "#5BB6C9" },
  fan: { label: "Fan", color: "#8AA0B8" },
  preheating: { label: "Preheating", color: "#E0795B" },
  defrosting: { label: "Defrosting", color: "#5BB6C9" },
  idle: { label: "Idle", color: "#9aa3af" },
  off: { label: "Off", color: "#9aa3af" },
};

const FAN_SVG = `<svg viewBox="0 0 18 18" fill="currentColor"><rect x="2" y="11" width="3" height="5" rx="1"/><rect x="7.5" y="7" width="3" height="9" rx="1"/><rect x="13" y="3" width="3" height="13" rx="1"/></svg>`;
const SWING_SVG = `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3 L9 15 M5.5 6.5 L9 3 L12.5 6.5 M5.5 11.5 L9 15 L12.5 11.5"/></svg>`;

const titleCase = (s) =>
  String(s || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

export class SerenityClimateCard extends HTMLElement {
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
    return 3;
  }

  static getStubConfig(hass) {
    let entity = "";
    if (hass && hass.states) {
      entity =
        Object.keys(hass.states).find((e) => e.startsWith("climate.")) || "";
    }
    return { entity };
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
      <div class="top">
        <div class="head">
          <div class="name"></div>
          <div class="status"><span class="dot"></span><span class="status-text"></span></div>
        </div>
        <div class="actions">
          <button class="btn mode" title="Mode"><ha-icon></ha-icon></button>
          <button class="btn power" title="Power"><ha-icon icon="mdi:power"></ha-icon></button>
        </div>
      </div>
      <div class="thermo">
        <button class="step minus" title="Lower"><ha-icon icon="mdi:minus"></ha-icon></button>
        <div class="target"><span class="t-num"></span><span class="t-unit"></span></div>
        <button class="step plus" title="Raise"><ha-icon icon="mdi:plus"></ha-icon></button>
      </div>
      <div class="divider"></div>
      <div class="bottom">
        <button class="chip fan"><span class="chip-ico"></span><span class="chip-label"></span></button>
        <button class="chip swing"><span class="chip-ico"></span><span class="chip-label"></span></button>
      </div>`;
    root.appendChild(card);

    const $ = (s) => root.querySelector(s);
    this._els = {
      card,
      head: $(".head"),
      name: $(".name"),
      dot: $(".dot"),
      statusText: $(".status-text"),
      modeBtn: $(".btn.mode"),
      modeIcon: $(".btn.mode ha-icon"),
      powerBtn: $(".btn.power"),
      minus: $(".step.minus"),
      plus: $(".step.plus"),
      tNum: $(".t-num"),
      tUnit: $(".t-unit"),
      divider: $(".divider"),
      bottom: $(".bottom"),
      fan: $(".chip.fan"),
      fanIco: $(".chip.fan .chip-ico"),
      fanLabel: $(".chip.fan .chip-label"),
      swing: $(".chip.swing"),
      swingIco: $(".chip.swing .chip-ico"),
      swingLabel: $(".chip.swing .chip-label"),
    };

    const stop = (fn) => (ev) => {
      ev.stopPropagation();
      fn();
    };
    this._els.head.addEventListener("click", () => this._moreInfo());
    this._els.modeBtn.addEventListener(
      "click",
      stop(() => this._cycleMode()),
    );
    this._els.powerBtn.addEventListener(
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
    this._els.fan.addEventListener(
      "click",
      stop(() => this._cycleFan()),
    );
    this._els.swing.addEventListener(
      "click",
      stop(() => this._cycleSwing()),
    );

    this._els.fanIco.innerHTML = FAN_SVG;
    this._els.swingIco.innerHTML = SWING_SVG;

    this._built = true;
  }

  _css() {
    return `
      :host {
        --_accent: var(--serenity-climate-color, #5B9BF5);
        --_value: var(--serenity-value-color, var(--primary-text-color, #1f2937));
        --_muted: var(--serenity-muted-color, var(--secondary-text-color, #9aa3af));
        --_ctrl: var(--serenity-control-bg, #f1f3f5);
        display: block;
      }
      ha-card { padding: 12px 18px 12px; }
      .top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
      .head { cursor: pointer; }
      .name { font-size: 16px; font-weight: 700; line-height: 1.2; color: var(--_value); }
      .status { display: flex; align-items: center; gap: 6px; margin-top: 5px; font-size: 13px; font-weight: 500; color: var(--_muted); }
      .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--_accent); flex: 0 0 auto; }
      .actions { display: flex; gap: 8px; flex: 0 0 auto; }
      .btn {
        width: 40px; height: 34px; border: none; border-radius: 11px;
        background: var(--_ctrl); color: var(--_muted);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: background 0.2s, color 0.2s;
      }
      .btn ha-icon { --mdc-icon-size: 20px; }
      .btn.on { background: color-mix(in srgb, var(--_accent) 15%, transparent); color: var(--_accent); }
      .thermo { display: flex; align-items: center; justify-content: center; gap: 22px; margin: 10px 0 10px; }
      .step {
        width: 40px; height: 40px; border: none; border-radius: 50%;
        background: var(--_ctrl); color: var(--_value);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: transform 0.1s, background 0.2s;
      }
      .step ha-icon { --mdc-icon-size: 22px; }
      .step:hover { background: color-mix(in srgb, var(--_value) 8%, var(--_ctrl)); }
      .step:active { transform: scale(0.92); }
      .target { display: flex; align-items: flex-start; min-width: 96px; justify-content: center; }
      .t-num { font-size: 38px; font-weight: 800; letter-spacing: -1px; line-height: 1; color: var(--_value); }
      .t-unit { font-size: 16px; font-weight: 700; color: var(--_muted); margin-left: 3px; margin-top: 3px; }
      .divider { height: 1px; background: var(--divider-color, #e6e8eb); }
      .bottom { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; }
      .chip { display: flex; align-items: center; gap: 8px; background: none; border: none; padding: 0; cursor: pointer; }
      .chip-ico { width: 18px; height: 18px; color: var(--_accent); display: inline-flex; }
      .chip-ico svg { width: 100%; height: 100%; }
      .chip-label { font-size: 14px; font-weight: 600; color: var(--_value); }
      .btn[disabled], .step[disabled], .chip[disabled] { opacity: 0.4; cursor: default; }
      .chip.hidden { display: none; }
      .bottom.hidden, .divider.hidden { display: none; }
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
    const els = this._els;
    const st = this._entity();

    els.name.textContent =
      this._config.name ||
      (st && st.attributes.friendly_name) ||
      this._config.entity;

    if (!st || st.state === "unavailable") {
      this._setAccent("#9aa3af");
      els.statusText.textContent = "Unavailable";
      els.tNum.textContent = "\u2014";
      els.tUnit.textContent = "";
      [
        els.modeBtn,
        els.powerBtn,
        els.minus,
        els.plus,
        els.fan,
        els.swing,
      ].forEach((b) => (b.disabled = true));
      els.modeBtn.classList.remove("on");
      els.powerBtn.classList.remove("on");
      return;
    }

    const a = st.attributes;
    const mode = st.state; // hvac mode
    const action = a.hvac_action;
    const isOn = mode !== "off";
    if (isOn) this._lastMode = mode;

    // Accent: explicit config > action colour > mode colour > muted
    let accent = this._config.accent;
    if (!accent) {
      if (action && ACTION_META[action]) accent = ACTION_META[action].color;
      else if (MODE_META[mode] && MODE_META[mode].color)
        accent = MODE_META[mode].color;
      else accent = isOn ? "#5B9BF5" : "#9aa3af";
    }
    this._setAccent(accent);
    els.dot.style.background = accent;

    // Status text: action label (or mode label) + current temperature
    const statusLabel =
      action && ACTION_META[action]
        ? ACTION_META[action].label
        : (MODE_META[mode] && MODE_META[mode].label) || titleCase(mode);
    const cur = a.current_temperature;
    els.statusText.textContent =
      cur != null
        ? `${statusLabel} \u00B7 ${this._fmt(cur)}\u00B0`
        : statusLabel;

    // Mode button icon (reflects current or last active mode)
    const displayMode = isOn ? mode : this._lastMode || "cool";
    els.modeIcon.setAttribute(
      "icon",
      (MODE_META[displayMode] || MODE_META.cool).icon,
    );
    const modes = (a.hvac_modes || []).filter((m) => m !== "off");
    els.modeBtn.disabled = modes.length < 2;
    els.modeBtn.classList.toggle("on", isOn);

    // Power button
    els.powerBtn.disabled = false;
    els.powerBtn.classList.toggle("on", isOn);

    // Target temperature
    const attr = this._config.setpoint_attribute || "temperature";
    const target = a[attr];
    const unit =
      this._config.unit ||
      (this._hass.config &&
        this._hass.config.unit_system &&
        this._hass.config.unit_system.temperature) ||
      "\u00B0C";
    if (target != null && !isNaN(parseFloat(target))) {
      els.tNum.textContent = this._fmt(parseFloat(target));
      els.tUnit.textContent = unit;
      els.minus.disabled = false;
      els.plus.disabled = false;
    } else {
      els.tNum.textContent = cur != null ? this._fmt(cur) : "\u2014";
      els.tUnit.textContent = cur != null ? unit : "";
      els.minus.disabled = true;
      els.plus.disabled = true;
    }

    // Fan + swing chips
    const hasFan = Array.isArray(a.fan_modes) && a.fan_modes.length > 0;
    const hasSwing = Array.isArray(a.swing_modes) && a.swing_modes.length > 0;
    els.fan.classList.toggle("hidden", !hasFan);
    els.swing.classList.toggle("hidden", !hasSwing);
    if (hasFan) els.fanLabel.textContent = titleCase(a.fan_mode);
    if (hasSwing) els.swingLabel.textContent = titleCase(a.swing_mode);
    const showBottom = hasFan || hasSwing;
    els.bottom.classList.toggle("hidden", !showBottom);
    els.divider.classList.toggle("hidden", !showBottom);
  }

  _setAccent(color) {
    this.style.setProperty("--_accent", color);
  }

  _fmt(v) {
    if (v == null || isNaN(v)) return "\u2014";
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
    const min = a.min_temp != null ? a.min_temp : 7;
    const max = a.max_temp != null ? a.max_temp : 35;
    let next = Math.min(max, Math.max(min, cur + dir * step));
    next = Math.round(next / step) * step;
    next = Math.round(next * 100) / 100;
    this._service("set_temperature", { [attr]: next });
  }

  _cycleMode() {
    const st = this._entity();
    if (!st) return;
    const modes = (st.attributes.hvac_modes || []).filter((m) => m !== "off");
    if (modes.length < 2) return;
    const i = modes.indexOf(st.state);
    const next = modes[(i + 1) % modes.length];
    this._service("set_hvac_mode", { hvac_mode: next });
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

  _cycleFan() {
    const st = this._entity();
    const list = st && st.attributes.fan_modes;
    if (!list || !list.length) return;
    const i = list.indexOf(st.attributes.fan_mode);
    this._service("set_fan_mode", { fan_mode: list[(i + 1) % list.length] });
  }

  _cycleSwing() {
    const st = this._entity();
    const list = st && st.attributes.swing_modes;
    if (!list || !list.length) return;
    const i = list.indexOf(st.attributes.swing_mode);
    this._service("set_swing_mode", {
      swing_mode: list[(i + 1) % list.length],
    });
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

if (!customElements.get("serenity-climate-card")) {
  customElements.define("serenity-climate-card", SerenityClimateCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "serenity-climate-card",
  name: "Serenity Climate",
  description:
    "Minimal heat pump / thermostat control with mode, target temp, fan and swing.",
  preview: true,
  documentationURL: "https://github.com/your-username/serenity-cards",
});

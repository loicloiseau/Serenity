/**
 * Serenity Alarm Card — custom:serenity-alarm-card
 *
 * Alarm panel status row (icon plate, French state label + sublabel with
 * "depuis HH:MM") plus live chips for doors/windows, motion sensors and
 * the most recent activity. Tap opens more-info.
 */

import { relativeTime } from "../header-utils.js";

const STATES = {
  disarmed: { icon: "mdi:shield-off-outline", label: "Désarmé", sub: "Système inactif", color: "#9aa3af" },
  armed_home: { icon: "mdi:shield-home", label: "Armé · Maison", sub: "Tu es à la maison", color: "#3F9E6B" },
  armed_away: { icon: "mdi:shield-lock", label: "Armé · Absent", sub: "Protection totale", color: "#5B9BF5" },
  armed_night: { icon: "mdi:shield-moon", label: "Armé · Nuit", sub: "Mode nuit actif", color: "#8B6FD0" },
  armed_vacation: { icon: "mdi:shield-airplane", label: "Armé · Vacances", sub: "Mode vacances", color: "#8B6FD0" },
  pending: { icon: "mdi:shield-sync", label: "En attente", sub: "Délai avant activation", color: "#E0A95B" },
  arming: { icon: "mdi:shield-sync", label: "Armement…", sub: "Activation en cours…", color: "#E0A95B" },
  triggered: { icon: "mdi:shield-alert", label: "Déclenché !", sub: "Intrusion détectée !", color: "#E06B5B" },
  unavailable: { icon: "mdi:shield-outline", label: "Indisponible", sub: "Alarme non disponible", color: "#9aa3af" },
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

export class SerenityAlarmCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
    this._timer = null;
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("You must define an alarm_control_panel entity");
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
    this._timer = window.setInterval(() => this._update(), 60000);
  }

  disconnectedCallback() {
    if (this._timer) {
      window.clearInterval(this._timer);
      this._timer = null;
    }
  }

  getCardSize() {
    return 2;
  }

  static getStubConfig(hass) {
    let entity = "";
    if (hass && hass.states) {
      entity =
        Object.keys(hass.states).find((e) =>
          e.startsWith("alarm_control_panel.")
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
      <div class="head">
        <div class="icon-box"><ha-icon></ha-icon></div>
        <div class="txt">
          <div class="label"></div>
          <div class="sub"></div>
        </div>
      </div>
      <div class="chips">
        <span class="chip doors"><ha-icon icon="mdi:door"></ha-icon><span class="c-txt"></span></span>
        <span class="chip motion"><ha-icon icon="mdi:motion-sensor"></ha-icon><span class="c-txt"></span></span>
        <span class="chip last"><ha-icon icon="mdi:clock-outline"></ha-icon><span class="c-txt"></span></span>
      </div>
      <div class="actions"></div>`;
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
      iconBox: $(".icon-box"),
      icon: $(".icon-box ha-icon"),
      label: $(".label"),
      sub: $(".sub"),
      chips: $(".chips"),
      doors: $(".chip.doors"),
      doorsTxt: $(".chip.doors .c-txt"),
      doorsIco: $(".chip.doors ha-icon"),
      motion: $(".chip.motion"),
      motionTxt: $(".chip.motion .c-txt"),
      motionIco: $(".chip.motion ha-icon"),
      last: $(".chip.last"),
      lastTxt: $(".chip.last .c-txt"),
      actions: $(".actions"),
    };

    this._els.card.querySelector(".head").style.cursor = "pointer";
    this._els.card
      .querySelector(".head")
      .addEventListener("click", () => this._moreInfo());
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
      ha-card {
        padding: 14px 16px 14px; cursor: pointer; overflow: hidden;
        transition: background-color 0.25s ease;
      }
      .head { display: flex; align-items: center; gap: 13px; min-width: 0; }
      .icon-box {
        flex: 0 0 auto; width: 44px; height: 44px; border-radius: 14px;
        background: var(--_plate); display: flex; align-items: center; justify-content: center;
        transition: background 0.25s ease;
      }
      .icon-box ha-icon { --mdc-icon-size: 24px; color: var(--_muted); transition: color 0.25s ease; }
      .txt { min-width: 0; }
      .label { font-size: 16px; font-weight: 700; letter-spacing: -0.2px; color: var(--_value);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sub { margin-top: 2px; font-size: 13px; font-weight: 500; color: var(--_muted);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 13px; }
      .chip {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 6px 11px; border-radius: 999px; background: var(--_plate);
        font-size: 12px; font-weight: 600; color: var(--_value); line-height: 1;
      }
      .chip ha-icon { --mdc-icon-size: 14px; color: var(--_muted); }
      .chip.alert ha-icon { color: var(--_alert); }
      .chip.alert { background: var(--_alert-soft); }
      .chip.ok ha-icon { color: #3F9E6B; }
      .chip.hidden { display: none; }
      .chip.last { color: var(--_muted); }

      /* Arm/disarm quick actions */
      .actions { display: flex; gap: 8px; margin-top: 12px; }
      .actions.hidden { display: none; }
      .abtn {
        flex: 1 1 0; min-width: 0; border: none; cursor: pointer;
        display: flex; flex-direction: column; align-items: center; gap: 4px;
        padding: 9px 4px; border-radius: 13px; background: var(--_plate);
        font-family: inherit; font-size: 11.5px; font-weight: 600; color: var(--_muted);
        transition: background 0.18s ease, color 0.18s ease, transform 0.05s ease;
      }
      .abtn ha-icon { --mdc-icon-size: 18px; }
      .abtn:active { transform: scale(0.96); }
      .abtn.current { background: var(--abtn-soft); color: var(--abtn-color); }
      .abtn[disabled] { opacity: 0.5; cursor: default; }
    `;
  }

  _countOn(list) {
    let n = 0;
    for (const id of list || []) {
      const st = this._hass.states[id];
      if (st && st.state === "on") n++;
    }
    return n;
  }

  _update() {
    if (!this._built || !this._config || !this._hass) return;
    const c = this._config;
    const els = this._els;
    const st = this._hass.states[c.entity];

    const state = st ? st.state : "unavailable";
    const meta =
      STATES[state] ||
      { icon: "mdi:shield-outline", label: state, sub: "", color: "#9aa3af" };
    const labels = (c.labels && c.labels[state]) || {};

    els.icon.setAttribute("icon", labels.icon || meta.icon);
    els.icon.style.color = meta.color;
    els.iconBox.style.background = hexToRgba(meta.color, 0.15);
    els.label.textContent = labels.label || meta.label;

    let sub = labels.sub || meta.sub;
    if (st && st.last_changed) {
      const t = new Date(st.last_changed).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      sub += ` · depuis ${t}`;
    }
    els.sub.textContent = sub;

    // Card tint by severity.
    let bg = "";
    if (state === "triggered") bg = hexToRgba("#E06B5B", 0.14);
    else if (state === "pending" || state === "arming")
      bg = hexToRgba("#E0A95B", 0.14);
    else if (state.startsWith("armed")) bg = hexToRgba(meta.color, 0.06);
    els.card.style.backgroundColor = bg;

    // Chips
    const doors = c.doors || [];
    const motion = c.motion || [];

    els.doors.classList.toggle("hidden", doors.length === 0);
    if (doors.length) {
      const open = this._countOn(doors);
      els.doorsTxt.textContent =
        open > 0
          ? `${open} ouverte${open > 1 ? "s" : ""}`
          : `${doors.length} fermées`;
      els.doors.classList.toggle("alert", open > 0);
      els.doors.classList.toggle("ok", open === 0);
      this.style.setProperty("--_alert", "#E06B5B");
      this.style.setProperty("--_alert-soft", hexToRgba("#E06B5B", 0.12));
    }

    els.motion.classList.toggle("hidden", motion.length === 0);
    if (motion.length) {
      const act = this._countOn(motion);
      els.motionTxt.textContent =
        act > 0 ? `${act} mouvement${act > 1 ? "s" : ""}` : "Au calme";
      els.motion.classList.toggle("alert", act > 0);
      if (act > 0) {
        this.style.setProperty("--_alert", "#E0A95B");
        this.style.setProperty("--_alert-soft", hexToRgba("#E0A95B", 0.14));
      }
    }

    let mostRecent = 0;
    for (const id of doors.concat(motion)) {
      const s = this._hass.states[id];
      if (s && s.last_changed) {
        const t = new Date(s.last_changed).getTime();
        if (t > mostRecent) mostRecent = t;
      }
    }
    els.last.classList.toggle("hidden", mostRecent === 0);
    if (mostRecent) {
      els.lastTxt.textContent = relativeTime(new Date(mostRecent).toISOString());
    }

    this._renderActions(state);
  }

  /* ------------------------- arm/disarm actions ------------------------- */

  static ACTIONS = {
    disarm: {
      label: "Désarmer",
      icon: "mdi:shield-off-outline",
      service: "alarm_disarm",
      states: ["disarmed"],
      color: "#9aa3af",
    },
    arm_home: {
      label: "Maison",
      icon: "mdi:shield-home",
      service: "alarm_arm_home",
      states: ["armed_home"],
      color: "#3F9E6B",
    },
    arm_away: {
      label: "Absent",
      icon: "mdi:shield-lock",
      service: "alarm_arm_away",
      states: ["armed_away"],
      color: "#5B9BF5",
    },
    arm_night: {
      label: "Nuit",
      icon: "mdi:shield-moon",
      service: "alarm_arm_night",
      states: ["armed_night"],
      color: "#8B6FD0",
    },
    arm_vacation: {
      label: "Vacances",
      icon: "mdi:shield-airplane",
      service: "alarm_arm_vacation",
      states: ["armed_vacation"],
      color: "#8B6FD0",
    },
  };

  _renderActions(state) {
    const c = this._config;
    const els = this._els;
    const show = c.show_actions !== false;
    els.actions.classList.toggle("hidden", !show);
    if (!show) return;

    const wanted = Array.isArray(c.actions)
      ? c.actions
      : ["disarm", "arm_home", "arm_away"];
    const busy = state === "pending" || state === "arming";

    els.actions.textContent = "";
    for (const key of wanted) {
      const meta = SerenityAlarmCard.ACTIONS[key];
      if (!meta) continue;
      const btn = document.createElement("button");
      btn.className = "abtn" + (meta.states.includes(state) ? " current" : "");
      btn.disabled = busy || state === "unavailable";
      btn.style.setProperty("--abtn-color", meta.color);
      btn.style.setProperty("--abtn-soft", hexToRgba(meta.color, 0.15));
      btn.innerHTML = `<ha-icon icon="${meta.icon}"></ha-icon><span>${meta.label}</span>`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (meta.states.includes(state)) return;
        const data = { entity_id: this._config.entity };
        if (this._config.code != null) data.code = String(this._config.code);
        this._hass.callService("alarm_control_panel", meta.service, data);
      });
      els.actions.appendChild(btn);
    }
  }

  _moreInfo() {
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId: this._config.entity },
        bubbles: true,
        composed: true,
      })
    );
  }
}

if (!customElements.get("serenity-alarm-card")) {
  customElements.define("serenity-alarm-card", SerenityAlarmCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "serenity-alarm-card",
  name: "Serenity Alarm",
  description:
    "Alarm panel status with door/window, motion and last-activity chips.",
  preview: true,
  documentationURL: "https://github.com/your-username/serenity-cards",
});

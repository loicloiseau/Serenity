/**
 * Serenity Timer Card — custom:serenity-timer-card
 *
 * A kitchen/garden timer for timer.* entities: live remaining time with
 * a progress fill, preset chips (5/10/30 min by default) to start,
 * pause/resume and cancel. Fits two-up unless full_width.
 */

import { statesDiffer } from "../header-utils.js";

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

/** "0:05:00" → seconds */
function parseDuration(d) {
  if (!d) return 0;
  const parts = String(d).split(":").map(Number);
  if (parts.some(isNaN)) return 0;
  while (parts.length < 3) parts.unshift(0);
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

function fmtRemaining(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export class SerenityTimerCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
    this._tick = null;
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("You must define a timer entity");
    }
    this._config = { presets: [5, 10, 30], ...config };
    if (this._built) {
      this._buildPresets();
      this._update();
    }
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
    return [c.entity];
  }

  connectedCallback() {
    this._ensureBuilt();
    if (this._hass) this._update();
    this._tick = window.setInterval(() => this._update(), 1000);
  }

  disconnectedCallback() {
    if (this._tick) {
      window.clearInterval(this._tick);
      this._tick = null;
    }
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    if (this._config && this._config.full_width === true) {
      return { columns: 12, rows: "auto", min_columns: 6 };
    }
    return { columns: 6, rows: "auto", min_columns: 3 };
  }

  static getStubConfig(hass) {
    let entity = "";
    if (hass && hass.states) {
      entity =
        Object.keys(hass.states).find((e) => e.startsWith("timer.")) || "";
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
      <div class="fill"></div>
      <div class="row">
        <div class="icon-box"><ha-icon></ha-icon></div>
        <div class="mid">
          <div class="name"></div>
          <div class="state"></div>
        </div>
        <div class="remaining hidden"></div>
        <div class="btns">
          <button class="tbtn pause hidden" title="Pause / reprendre"><ha-icon icon="mdi:pause"></ha-icon></button>
          <button class="tbtn cancel hidden" title="Annuler"><ha-icon icon="mdi:close"></ha-icon></button>
        </div>
      </div>
      <div class="presets"></div>`;
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
      fill: $(".fill"),
      icon: $(".icon-box ha-icon"),
      iconBox: $(".icon-box"),
      name: $(".name"),
      state: $(".state"),
      remaining: $(".remaining"),
      pause: $(".tbtn.pause"),
      pauseIcon: $(".tbtn.pause ha-icon"),
      cancel: $(".tbtn.cancel"),
      presets: $(".presets"),
    };

    this._els.pause.addEventListener("click", (e) => {
      e.stopPropagation();
      const st = this._entity();
      if (!st) return;
      this._svc(st.state === "active" ? "pause" : "start");
    });
    this._els.cancel.addEventListener("click", (e) => {
      e.stopPropagation();
      this._svc("cancel");
    });

    this._built = true;
    this._buildPresets();
  }

  _css() {
    return `
      :host {
        --_accent: #E0A95B;
        --_value: var(--serenity-value-color, var(--primary-text-color, #16201b));
        --_muted: var(--serenity-muted-color, var(--secondary-text-color, #9aa3af));
        --_plate: var(--serenity-tile-plate, rgba(120, 130, 138, 0.10));
        --_font: var(--serenity-header-font, "Inter", "Roboto", system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif);
        display: block;
        height: 100%;
        font-family: var(--_font);
      }
      ha-card {
        position: relative; height: 100%; box-sizing: border-box;
        padding: 11px 14px; overflow: hidden;
      }
      .fill {
        position: absolute; inset: 0; width: var(--_pct, 0%);
        background: var(--_soft); border-radius: inherit;
        transition: width 0.9s linear; pointer-events: none;
      }
      .row { position: relative; display: flex; align-items: center; gap: 11px; min-width: 0; }
      .icon-box {
        flex: 0 0 auto; width: 40px; height: 40px; border-radius: 13px;
        background: var(--_plate); display: flex; align-items: center; justify-content: center;
        transition: background 0.25s ease;
      }
      .icon-box ha-icon { --mdc-icon-size: 21px; color: var(--_muted); transition: color 0.25s ease; }
      ha-card.running .icon-box { background: var(--_soft2); }
      ha-card.running .icon-box ha-icon { color: var(--_accent); }
      .mid { flex: 1 1 auto; min-width: 0; }
      .name { font-size: 15px; font-weight: 700; letter-spacing: -0.2px; color: var(--_value);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .state { margin-top: 2px; font-size: 12.5px; font-weight: 500; color: var(--_muted); }
      ha-card.running .state { color: var(--_accent); font-weight: 600; }
      .remaining { flex: 0 0 auto; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;
        color: var(--_value); font-variant-numeric: tabular-nums; }
      .remaining.hidden { display: none; }
      .btns { flex: 0 0 auto; display: flex; gap: 4px; }
      .tbtn {
        border: none; cursor: pointer; padding: 0;
        width: 30px; height: 30px; border-radius: 10px;
        background: var(--_plate); color: var(--_value);
        display: flex; align-items: center; justify-content: center;
        transition: transform 0.05s ease;
      }
      .tbtn ha-icon { --mdc-icon-size: 16px; }
      .tbtn:active { transform: scale(0.92); }
      .tbtn.hidden { display: none; }
      .presets { position: relative; display: flex; gap: 7px; margin-top: 10px; }
      .presets.hidden { display: none; }
      .pchip {
        flex: 1 1 0; border: none; cursor: pointer; font-family: inherit;
        padding: 7px 0; border-radius: 11px; background: var(--_plate);
        font-size: 12px; font-weight: 700; color: var(--_value);
        transition: background 0.15s ease, transform 0.05s ease;
      }
      .pchip:active { transform: scale(0.95); }
      ha-card.unavail .name { color: var(--_muted); }
    `;
  }

  _entity() {
    return this._hass && this._config
      ? this._hass.states[this._config.entity]
      : null;
  }

  _svc(service, data) {
    this._hass.callService("timer", service, {
      entity_id: this._config.entity,
      ...data,
    });
  }

  _buildPresets() {
    if (!this._built) return;
    const box = this._els.presets;
    box.textContent = "";
    for (const min of this._config.presets || []) {
      const b = document.createElement("button");
      b.className = "pchip";
      b.textContent = min >= 60 ? `${Math.round(min / 60)} h` : `${min} min`;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const sec = Math.round(min * 60);
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        this._svc("start", {
          duration: `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
        });
      });
      box.appendChild(b);
    }
  }

  _update() {
    if (!this._built || !this._config || !this._hass) return;
    const c = this._config;
    const els = this._els;
    const st = this._entity();

    els.name.textContent =
      c.name || (st && st.attributes.friendly_name) || c.entity;
    els.icon.setAttribute(
      "icon",
      c.icon || (st && st.attributes.icon) || "mdi:timer-outline"
    );

    const accent = c.accent || "#E0A95B";
    this.style.setProperty("--_accent", accent);
    this.style.setProperty("--_soft", hexToRgba(accent, 0.10));
    this.style.setProperty("--_soft2", hexToRgba(accent, 0.16));

    if (!st || st.state === "unavailable") {
      els.card.classList.add("unavail");
      els.card.classList.remove("running");
      els.state.textContent = "Indisponible";
      els.remaining.classList.add("hidden");
      els.pause.classList.add("hidden");
      els.cancel.classList.add("hidden");
      this.style.setProperty("--_pct", "0%");
      return;
    }
    els.card.classList.remove("unavail");

    const a = st.attributes;
    const total = parseDuration(a.duration);
    const active = st.state === "active";
    const paused = st.state === "paused";

    let remain = 0;
    if (active && a.finishes_at) {
      remain = (Date.parse(a.finishes_at) - Date.now()) / 1000;
    } else if (paused && a.remaining) {
      remain = parseDuration(a.remaining);
    }

    els.card.classList.toggle("running", active);
    els.remaining.classList.toggle("hidden", !(active || paused));
    els.pause.classList.toggle("hidden", !(active || paused));
    els.cancel.classList.toggle("hidden", !(active || paused));
    els.presets.classList.toggle("hidden", active || paused);

    if (active || paused) {
      els.remaining.textContent = fmtRemaining(remain);
      els.pauseIcon.setAttribute("icon", active ? "mdi:pause" : "mdi:play");
      els.state.textContent = paused ? "En pause" : "En cours";
      const pct = total > 0 ? Math.max(0, Math.min(100, (1 - remain / total) * 100)) : 0;
      this.style.setProperty("--_pct", `${pct}%`);
    } else {
      els.state.textContent = "Prête";
      this.style.setProperty("--_pct", "0%");
    }
  }
}

if (!customElements.get("serenity-timer-card")) {
  customElements.define("serenity-timer-card", SerenityTimerCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "serenity-timer-card",
  name: "Serenity Timer",
  description:
    "Timer with live countdown, progress fill, preset chips and pause/cancel.",
  preview: true,
  documentationURL: "https://github.com/your-username/serenity-cards",
});

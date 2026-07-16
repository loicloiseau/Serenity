/**
 * Serenity Light Card — custom:serenity-light-card
 *
 * A light row in the Serenity style: icon plate, name and brightness.
 * Tap toggles, dragging horizontally dims (the card itself is the
 * slider, with a soft accent fill). Long-press opens a Serenity popup
 * with a fine brightness slider, white-temperature and colour presets
 * (popup: false restores the native more-info). Fits two-up by default.
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

const DRAG_THRESHOLD = 8; // px before a press becomes a drag
const HOLD_MS = 550;

// White-temperature presets (Kelvin) with an approximate chip colour.
const TEMPS = [
  { k: 2700, c: "#FFB46B" },
  { k: 3200, c: "#FFC98F" },
  { k: 4000, c: "#FFE3BD" },
  { k: 5000, c: "#F3F0E7" },
  { k: 6200, c: "#DDE9F7" },
];

// Colour presets (rgb).
const COLORS = [
  [224, 107, 91],
  [226, 169, 60],
  [63, 158, 107],
  [91, 155, 245],
  [139, 111, 208],
  [210, 103, 160],
  [255, 255, 255],
];

const COLOR_MODES = new Set(["hs", "rgb", "rgbw", "rgbww", "xy"]);

export class SerenityLightCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
    this._drag = null;
    this._optimisticPct = null;
    this._optimisticUntil = 0;
    this._popupDrag = false;
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("You must define a light entity");
    }
    this._config = { ...config };
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
    return [c.entity];
  }

  connectedCallback() {
    this._ensureBuilt();
    if (this._hass) this._update();
  }

  disconnectedCallback() {
    this._closePopup();
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
        Object.keys(hass.states).find((e) => e.startsWith("light.")) || "";
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
      fill: $(".fill"),
      iconBox: $(".icon-box"),
      icon: $(".icon-box ha-icon"),
      name: $(".name"),
      state: $(".state"),
    };

    card.addEventListener("pointerdown", (e) => this._onDown(e));
    card.addEventListener("pointermove", (e) => this._onMove(e));
    card.addEventListener("pointerup", (e) => this._onUp(e));
    card.addEventListener("pointercancel", () => this._cancel());

    this._built = true;
  }

  _css() {
    return `
      :host {
        --_accent: #E2A93C;
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
        padding: 11px 14px; cursor: pointer; overflow: hidden;
        touch-action: pan-y; user-select: none; -webkit-user-select: none;
      }
      /* Brightness fill, layered over the card background (shadow intact) */
      .fill {
        position: absolute; inset: 0; width: var(--_pct, 0%);
        background: var(--_soft); border-radius: inherit;
        transition: width 0.15s ease, background 0.25s ease;
        pointer-events: none;
      }
      ha-card.dragging .fill { transition: none; }
      .row { position: relative; display: flex; align-items: center; gap: 12px; min-width: 0; height: 100%; }
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
      ha-card.unavail .name { color: var(--_muted); }

      /* --------------- popup panel (bottom sheet style) --------------- */
      .popup { position: fixed; inset: 0; z-index: 999; display: flex;
        align-items: flex-end; justify-content: center;
        padding: 0 12px calc(16px + env(safe-area-inset-bottom, 0px));
        box-sizing: border-box; }
      .popup.hidden { display: none; }
      .backdrop { position: absolute; inset: 0; background: rgba(14, 19, 16, 0.38);
        backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px);
        animation: bd-in 0.18s ease; }
      @keyframes bd-in { from { opacity: 0; } to { opacity: 1; } }
      .panel {
        position: relative; width: 100%; max-width: 420px; max-height: 68vh;
        overflow-y: auto; box-sizing: border-box;
        background: var(--ha-card-background, var(--card-background-color, #fff));
        border-radius: 22px; padding: 18px 18px 16px;
        box-shadow: 0 18px 50px rgba(10, 16, 12, 0.30);
        animation: pop-in 0.2s ease;
        font-family: var(--_font);
      }
      @keyframes pop-in { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: none; } }
      @media (prefers-reduced-motion: reduce) {
        .backdrop, .panel { animation: none; }
      }
      .p-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
      .p-name { flex: 1 1 auto; min-width: 0; font-size: 16px; font-weight: 700;
        letter-spacing: -0.2px; color: var(--_value);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .p-btn {
        flex: 0 0 auto; width: 36px; height: 36px; border: none; padding: 0; cursor: pointer;
        border-radius: 12px; background: var(--_plate); color: var(--_muted);
        display: flex; align-items: center; justify-content: center;
        transition: background 0.15s ease, color 0.15s ease;
      }
      .p-btn ha-icon { --mdc-icon-size: 19px; }
      .p-btn.p-power.on { background: var(--_soft2); color: var(--_accent); }
      .p-slider {
        position: relative; height: 52px; border-radius: 16px;
        background: var(--_plate); overflow: hidden; cursor: pointer;
        touch-action: none; user-select: none; -webkit-user-select: none;
      }
      .p-slider .p-fill {
        position: absolute; inset: 0; width: var(--_ppct, 0%);
        background: var(--_soft3); transition: width 0.1s ease;
      }
      .p-slider.dragging .p-fill { transition: none; }
      .p-slider .p-pct {
        position: absolute; inset: 0; display: flex; align-items: center;
        padding-left: 16px; font-size: 15px; font-weight: 700; color: var(--_value);
        pointer-events: none;
      }
      .p-sec {
        margin: 14px 0 7px; font-size: 10.5px; font-weight: 700;
        letter-spacing: 0.1em; text-transform: uppercase; color: var(--_muted);
      }
      .p-row { display: flex; gap: 9px; }
      .p-row.hidden, .p-sec.hidden { display: none; }
      .chip {
        flex: 1 1 0; height: 34px; border: none; cursor: pointer;
        border-radius: 12px; padding: 0;
        transition: transform 0.08s ease, box-shadow 0.15s ease;
        box-shadow: inset 0 0 0 1px rgba(20, 26, 22, 0.08);
      }
      .chip:active { transform: scale(0.92); }
    `;
  }

  _entity() {
    return this._hass && this._config
      ? this._hass.states[this._config.entity]
      : null;
  }

  _modes(st) {
    return (st && st.attributes.supported_color_modes) || [];
  }

  _dimmable(st) {
    return this._modes(st).some((m) => m !== "onoff");
  }

  _pct(st) {
    if (Date.now() < this._optimisticUntil && this._optimisticPct != null) {
      return this._optimisticPct;
    }
    if (!st || st.state !== "on") return 0;
    const b = st.attributes.brightness;
    if (b == null) return 100;
    return Math.round((b / 255) * 100);
  }

  _update() {
    if (!this._built || !this._config) return;
    const c = this._config;
    const els = this._els;
    const st = this._entity();

    els.name.textContent =
      c.name || (st && st.attributes.friendly_name) || c.entity;
    els.icon.setAttribute(
      "icon",
      c.icon || (st && st.attributes.icon) || "mdi:lightbulb"
    );

    if (!st || st.state === "unavailable") {
      els.card.classList.add("unavail");
      els.card.classList.remove("on");
      els.state.textContent = "Indisponible";
      this.style.setProperty("--_pct", "0%");
      return;
    }
    els.card.classList.remove("unavail");

    const on = st.state === "on";
    const dim = this._dimmable(st);
    const pct = this._pct(st);

    // A gentle accent: config > warm default. Intentionally soft fills.
    const accent = c.accent || "#E2A93C";
    this.style.setProperty("--_accent", accent);
    this.style.setProperty("--_soft", hexToRgba(accent, 0.10));
    this.style.setProperty("--_soft2", hexToRgba(accent, 0.16));
    this.style.setProperty("--_soft3", hexToRgba(accent, 0.28));

    els.card.classList.toggle("on", on);
    this.style.setProperty("--_pct", on && dim ? `${pct}%` : on ? "100%" : "0%");
    els.state.textContent = on
      ? dim
        ? `${pct} %`
        : "Allumée"
      : "Éteinte";

    this._syncPopup(st, on, pct);
  }

  /* --------------------------- interactions --------------------------- */

  _onDown(e) {
    const st = this._entity();
    if (!st || st.state === "unavailable") return;
    this._els.card.setPointerCapture(e.pointerId);
    this._drag = {
      id: e.pointerId,
      x0: e.clientX,
      startPct: this._pct(st),
      moved: false,
      width: this._els.card.getBoundingClientRect().width,
    };
    this._holdTimer = window.setTimeout(() => {
      if (this._drag && !this._drag.moved) {
        this._drag = null;
        if (this._config.popup === false) this._moreInfo();
        else this._openPopup();
      }
    }, HOLD_MS);
  }

  _onMove(e) {
    const d = this._drag;
    if (!d || e.pointerId !== d.id) return;
    const st = this._entity();
    if (!this._dimmable(st)) return;
    const dx = e.clientX - d.x0;
    if (!d.moved && Math.abs(dx) < DRAG_THRESHOLD) return;
    if (!d.moved) {
      d.moved = true;
      this._els.card.classList.add("dragging");
      window.clearTimeout(this._holdTimer);
      // Tell ancestor containers (tabs card) this gesture is a brightness
      // drag, not a swipe between decks.
      window.__serenityCardDrag = true;
    }
    let pct = d.startPct + (dx / d.width) * 100;
    pct = Math.max(0, Math.min(100, Math.round(pct)));
    d.pct = pct;
    this._optimisticPct = pct;
    this._optimisticUntil = Date.now() + 2000;
    this.style.setProperty("--_pct", `${pct}%`);
    this._els.state.textContent = `${pct} %`;
    this._els.card.classList.toggle("on", pct > 0);
  }

  _onUp(e) {
    const d = this._drag;
    window.clearTimeout(this._holdTimer);
    if (!d || e.pointerId !== d.id) return;
    this._drag = null;
    this._els.card.classList.remove("dragging");
    if (d.moved)
      window.setTimeout(() => (window.__serenityCardDrag = false), 0);
    if (!this._hass) return;

    if (d.moved && d.pct != null) {
      this._setBrightness(d.pct);
    } else {
      this._hass.callService("light", "toggle", {
        entity_id: this._config.entity,
      });
    }
  }

  _cancel() {
    window.clearTimeout(this._holdTimer);
    this._drag = null;
    this._els.card.classList.remove("dragging");
    window.__serenityCardDrag = false;
    this._update();
  }

  _setBrightness(pct) {
    if (pct === 0) {
      this._hass.callService("light", "turn_off", {
        entity_id: this._config.entity,
      });
    } else {
      this._hass.callService("light", "turn_on", {
        entity_id: this._config.entity,
        brightness_pct: pct,
      });
    }
  }

  /* ----------------------------- popup ----------------------------- */

  _openPopup() {
    const st = this._entity();
    if (!st) return;
    const root = this.shadowRoot;

    if (!this._popup) {
      const pop = document.createElement("div");
      pop.className = "popup hidden";
      pop.innerHTML = `
        <div class="backdrop"></div>
        <div class="panel">
          <div class="p-head">
            <div class="p-name"></div>
            <button class="p-btn p-power" title="Allumer / éteindre"><ha-icon icon="mdi:power"></ha-icon></button>
            <button class="p-btn p-close" title="Fermer"><ha-icon icon="mdi:close"></ha-icon></button>
          </div>
          <div class="p-slider"><div class="p-fill"></div><span class="p-pct"></span></div>
          <div class="p-sec temps-sec">Blancs</div>
          <div class="p-row temps"></div>
          <div class="p-sec colors-sec">Couleurs</div>
          <div class="p-row colors"></div>
        </div>`;
      root.appendChild(pop);
      this._popup = {
        el: pop,
        name: pop.querySelector(".p-name"),
        power: pop.querySelector(".p-power"),
        slider: pop.querySelector(".p-slider"),
        pct: pop.querySelector(".p-pct"),
        tempsSec: pop.querySelector(".temps-sec"),
        temps: pop.querySelector(".temps"),
        colorsSec: pop.querySelector(".colors-sec"),
        colors: pop.querySelector(".colors"),
      };

      pop.querySelector(".backdrop").addEventListener("click", () =>
        this._closePopup()
      );
      pop.querySelector(".p-close").addEventListener("click", () =>
        this._closePopup()
      );
      this._popup.power.addEventListener("click", () => {
        this._hass.callService("light", "toggle", {
          entity_id: this._config.entity,
        });
      });

      // Popup brightness slider: absolute position → percentage.
      const slider = this._popup.slider;
      const fromEvent = (e, commit) => {
        const rect = slider.getBoundingClientRect();
        let pct = ((e.clientX - rect.left) / rect.width) * 100;
        pct = Math.max(0, Math.min(100, Math.round(pct)));
        this._optimisticPct = pct;
        this._optimisticUntil = Date.now() + 2000;
        this.style.setProperty("--_ppct", `${pct}%`);
        this._popup.pct.textContent = `${pct} %`;
        if (commit) this._setBrightness(pct);
      };
      slider.addEventListener("pointerdown", (e) => {
        this._popupDrag = true;
        slider.setPointerCapture(e.pointerId);
        slider.classList.add("dragging");
        fromEvent(e, false);
      });
      slider.addEventListener("pointermove", (e) => {
        if (this._popupDrag) fromEvent(e, false);
      });
      slider.addEventListener("pointerup", (e) => {
        if (!this._popupDrag) return;
        this._popupDrag = false;
        slider.classList.remove("dragging");
        fromEvent(e, true);
      });
      slider.addEventListener("pointercancel", () => {
        this._popupDrag = false;
        slider.classList.remove("dragging");
      });

      // Preset chips
      for (const t of TEMPS) {
        const b = document.createElement("button");
        b.className = "chip";
        b.style.background = t.c;
        b.title = `${t.k} K`;
        b.addEventListener("click", () => {
          this._hass.callService("light", "turn_on", {
            entity_id: this._config.entity,
            color_temp_kelvin: t.k,
          });
        });
        this._popup.temps.appendChild(b);
      }
      for (const rgb of COLORS) {
        const b = document.createElement("button");
        b.className = "chip";
        b.style.background = `rgb(${rgb.join(",")})`;
        b.addEventListener("click", () => {
          this._hass.callService("light", "turn_on", {
            entity_id: this._config.entity,
            rgb_color: rgb,
          });
        });
        this._popup.colors.appendChild(b);
      }
    }

    // Capability-driven sections
    const modes = this._modes(st);
    const hasTemp = modes.includes("color_temp");
    const hasColor = modes.some((m) => COLOR_MODES.has(m));
    this._popup.tempsSec.classList.toggle("hidden", !hasTemp);
    this._popup.temps.classList.toggle("hidden", !hasTemp);
    this._popup.colorsSec.classList.toggle("hidden", !hasColor);
    this._popup.colors.classList.toggle("hidden", !hasColor);

    this._popup.name.textContent =
      this._config.name || st.attributes.friendly_name || this._config.entity;

    this._popup.el.classList.remove("hidden");
    this._syncPopup(st, st.state === "on", this._pct(st));
  }

  _syncPopup(st, on, pct) {
    if (!this._popup || this._popup.el.classList.contains("hidden")) return;
    if (this._popupDrag) return;
    this._popup.power.classList.toggle("on", on);
    this.style.setProperty("--_ppct", on ? `${pct}%` : "0%");
    this._popup.pct.textContent = on ? `${pct} %` : "Éteinte";
  }

  _closePopup() {
    if (this._popup) this._popup.el.classList.add("hidden");
    this._popupDrag = false;
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

if (!customElements.get("serenity-light-card")) {
  customElements.define("serenity-light-card", SerenityLightCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "serenity-light-card",
  name: "Serenity Light",
  description:
    "Light row with soft fill: tap toggles, drag dims, hold opens a Serenity popup with presets.",
  preview: true,
  documentationURL: "https://github.com/your-username/serenity-cards",
});

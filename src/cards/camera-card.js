/**
 * Serenity Camera Card — custom:serenity-camera-card
 *
 * A camera view in the Serenity style: rounded cover image (still
 * refresh every 10 s by default, or live stream with live: true), a
 * frosted name chip and an optional red motion badge driven by a
 * binary_sensor. Tap opens more-info (full live view).
 */

import { statesDiffer } from "../header-utils.js";

const REFRESH_MS = 10000;

export class SerenityCameraCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
    this._timer = null;
    this._counter = 0;
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("You must define a camera entity");
    }
    this._config = { ...config };
    if (this._built) this._update(true);
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
    return [c.entity, c.motion_entity];
  }

  connectedCallback() {
    this._ensureBuilt();
    if (this._hass) this._update(true);
    if (!this._config || this._config.live !== true) {
      this._timer = window.setInterval(() => {
        this._counter++;
        this._refreshImage();
      }, (this._config && this._config.refresh_seconds ? this._config.refresh_seconds * 1000 : REFRESH_MS));
    }
  }

  disconnectedCallback() {
    if (this._timer) {
      window.clearInterval(this._timer);
      this._timer = null;
    }
  }

  getCardSize() {
    return 4;
  }

  static getStubConfig(hass) {
    let entity = "";
    if (hass && hass.states) {
      entity =
        Object.keys(hass.states).find((e) => e.startsWith("camera.")) || "";
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
      <div class="frame">
        <img class="shot" alt="" />
        <div class="stream-slot"></div>
        <div class="fallback"><ha-icon icon="mdi:cctv-off"></ha-icon><span>Caméra indisponible</span></div>
        <div class="name-chip"><ha-icon icon="mdi:cctv"></ha-icon><span class="n-txt"></span></div>
        <div class="motion-chip hidden"><span class="mdot"></span><span>Mouvement</span></div>
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
      frame: $(".frame"),
      shot: $(".shot"),
      streamSlot: $(".stream-slot"),
      fallback: $(".fallback"),
      nameTxt: $(".n-txt"),
      nameChip: $(".name-chip"),
      motion: $(".motion-chip"),
    };

    this._els.shot.addEventListener("error", () => {
      this._els.frame.classList.add("broken");
    });
    this._els.shot.addEventListener("load", () => {
      this._els.frame.classList.remove("broken");
    });
    card.addEventListener("click", () => this._moreInfo());

    this._built = true;
  }

  _css() {
    return `
      :host {
        --_value: var(--serenity-value-color, var(--primary-text-color, #16201b));
        --_muted: var(--serenity-muted-color, var(--secondary-text-color, #9aa3af));
        --_alert: #E06B5B;
        --_font: var(--serenity-header-font, "Inter", "Roboto", system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif);
        display: block;
        font-family: var(--_font);
      }
      ha-card { padding: 0; overflow: hidden; cursor: pointer; }
      .frame { position: relative; aspect-ratio: 16 / 9; background: rgba(120, 130, 138, 0.12); }
      .shot, .stream-slot, .stream-slot > * {
        position: absolute; inset: 0; width: 100%; height: 100%;
        object-fit: cover; display: block;
      }
      .frame.broken .shot { display: none; }
      .fallback {
        position: absolute; inset: 0; display: none;
        flex-direction: column; align-items: center; justify-content: center; gap: 8px;
        color: var(--_muted); font-size: 13px; font-weight: 600;
      }
      .fallback ha-icon { --mdc-icon-size: 30px; }
      .frame.broken .fallback { display: flex; }
      .name-chip {
        position: absolute; left: 10px; bottom: 10px;
        display: inline-flex; align-items: center; gap: 6px;
        padding: 6px 12px; border-radius: 999px;
        background: rgba(18, 24, 20, 0.55);
        backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
        color: #fff; font-size: 12.5px; font-weight: 600;
      }
      .name-chip ha-icon { --mdc-icon-size: 14px; color: rgba(255, 255, 255, 0.85); }
      .motion-chip {
        position: absolute; right: 10px; top: 10px;
        display: inline-flex; align-items: center; gap: 6px;
        padding: 5px 11px; border-radius: 999px;
        background: var(--_alert); color: #fff;
        font-size: 12px; font-weight: 700;
        animation: pulse 1.6s ease infinite;
      }
      .motion-chip .mdot { width: 6px; height: 6px; border-radius: 50%; background: #fff; }
      .motion-chip.hidden { display: none; }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.72; } }
    `;
  }

  _entity() {
    return this._hass && this._config
      ? this._hass.states[this._config.entity]
      : null;
  }

  _refreshImage() {
    if (!this._built || !this._hass || (this._config && this._config.live)) return;
    const st = this._entity();
    const base = st && st.attributes.entity_picture;
    if (!base) return;
    const sep = base.includes("?") ? "&" : "?";
    this._els.shot.src = `${base}${sep}c=${this._counter}`;
  }

  _update(force) {
    if (!this._built || !this._config || !this._hass) return;
    const c = this._config;
    const els = this._els;
    const st = this._entity();

    els.nameTxt.textContent =
      c.name || (st && st.attributes.friendly_name) || c.entity;

    if (!st || st.state === "unavailable") {
      els.frame.classList.add("broken");
      els.motion.classList.add("hidden");
      return;
    }

    // Live stream via the frontend's own element; falls back to stills.
    if (c.live === true) {
      let stream = els.streamSlot.firstElementChild;
      if (!stream) {
        stream = document.createElement("ha-camera-stream");
        stream.muted = true;
        stream.autoPlay = true;
        els.streamSlot.appendChild(stream);
      }
      stream.hass = this._hass;
      stream.stateObj = st;
      els.shot.style.display = "none";
    } else if (force || !els.shot.src) {
      this._refreshImage();
    }

    // Motion badge
    const m = c.motion_entity && this._hass.states[c.motion_entity];
    els.motion.classList.toggle("hidden", !(m && m.state === "on"));
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

if (!customElements.get("serenity-camera-card")) {
  customElements.define("serenity-camera-card", SerenityCameraCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "serenity-camera-card",
  name: "Serenity Camera",
  description:
    "Rounded camera view with frosted name chip and live motion badge.",
  preview: true,
  documentationURL: "https://github.com/your-username/serenity-cards",
});

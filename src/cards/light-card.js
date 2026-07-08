/**
 * Serenity Light Card — custom:serenity-light-card
 *
 * A light row in the Serenity style: icon plate, name and brightness.
 * Tap toggles, dragging horizontally dims (the card itself is the
 * slider, with a soft accent fill), long-press opens more-info.
 * The on-tint is deliberately gentle. Fits two-up by default.
 */

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

export class SerenityLightCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
    this._drag = null;
    this._optimisticPct = null;
    this._optimisticUntil = 0;
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("You must define a light entity");
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
    return 1;
  }

  getGridOptions() {
    if (this._config && this._config.full_width === true) {
      return { columns: 12, rows: 1, min_columns: 6 };
    }
    return { columns: 6, rows: 1, min_columns: 3 };
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
    `;
  }

  _entity() {
    return this._hass && this._config
      ? this._hass.states[this._config.entity]
      : null;
  }

  _dimmable(st) {
    const modes =
      (st && st.attributes.supported_color_modes) || [];
    return modes.some((m) => m !== "onoff");
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

    els.card.classList.toggle("on", on);
    this.style.setProperty("--_pct", on && dim ? `${pct}%` : on ? "100%" : "0%");
    els.state.textContent = on
      ? dim
        ? `${pct} %`
        : "Allumée"
      : "Éteinte";
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
        this._moreInfo();
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
    if (!this._hass) return;

    if (d.moved && d.pct != null) {
      if (d.pct === 0) {
        this._hass.callService("light", "turn_off", {
          entity_id: this._config.entity,
        });
      } else {
        this._hass.callService("light", "turn_on", {
          entity_id: this._config.entity,
          brightness_pct: d.pct,
        });
      }
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
    this._update();
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
    "Light row with soft accent fill: tap toggles, drag dims, hold opens more-info.",
  preview: true,
  documentationURL: "https://github.com/your-username/serenity-cards",
});

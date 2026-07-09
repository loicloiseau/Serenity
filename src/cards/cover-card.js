/**
 * Serenity Cover Card — custom:serenity-cover-card
 *
 * Shutters / blinds / garage in the Serenity style: icon plate, name and
 * position, up / stop / down buttons. If the cover supports positioning,
 * dragging horizontally sets the opening with a soft fill (like the
 * light card). Fits two-up by default.
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

const F_OPEN = 1;
const F_CLOSE = 2;
const F_SET_POSITION = 4;
const F_STOP = 8;

const DC_ICON = {
  shutter: "mdi:window-shutter",
  blind: "mdi:blinds-horizontal",
  curtain: "mdi:curtains",
  garage: "mdi:garage",
  gate: "mdi:gate",
  awning: "mdi:awning-outline",
  shade: "mdi:roller-shade",
  window: "mdi:window-closed",
  door: "mdi:door",
};

const DRAG_THRESHOLD = 8;
const HOLD_MS = 550;

export class SerenityCoverCard extends HTMLElement {
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
      throw new Error("You must define a cover entity");
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
      return { columns: 12, rows: "auto", min_columns: 6 };
    }
    return { columns: 6, rows: "auto", min_columns: 3 };
  }

  static getStubConfig(hass) {
    let entity = "";
    if (hass && hass.states) {
      entity =
        Object.keys(hass.states).find((e) => e.startsWith("cover.")) || "";
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
        <div class="btns">
          <button class="cbtn up" title="Ouvrir"><ha-icon icon="mdi:chevron-up"></ha-icon></button>
          <button class="cbtn stop" title="Stop"><ha-icon icon="mdi:stop"></ha-icon></button>
          <button class="cbtn down" title="Fermer"><ha-icon icon="mdi:chevron-down"></ha-icon></button>
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
      up: $(".cbtn.up"),
      stop: $(".cbtn.stop"),
      down: $(".cbtn.down"),
    };

    const svc = (service) => (e) => {
      e.stopPropagation();
      this._hass.callService("cover", service, {
        entity_id: this._config.entity,
      });
    };
    this._els.up.addEventListener("click", svc("open_cover"));
    this._els.stop.addEventListener("click", svc("stop_cover"));
    this._els.down.addEventListener("click", svc("close_cover"));
    // Buttons must not start a drag on the card.
    for (const b of [this._els.up, this._els.stop, this._els.down]) {
      b.addEventListener("pointerdown", (e) => e.stopPropagation());
    }

    card.addEventListener("pointerdown", (e) => this._onDown(e));
    card.addEventListener("pointermove", (e) => this._onMove(e));
    card.addEventListener("pointerup", (e) => this._onUp(e));
    card.addEventListener("pointercancel", () => this._cancel());

    this._built = true;
  }

  _css() {
    return `
      :host {
        --_accent: #7C8BAE;
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
      .fill {
        position: absolute; inset: 0; width: var(--_pct, 0%);
        background: var(--_soft); border-radius: inherit;
        transition: width 0.2s ease; pointer-events: none;
      }
      ha-card.dragging .fill { transition: none; }
      .row { position: relative; display: flex; align-items: center; gap: 11px; min-width: 0; height: 100%; }
      .icon-box {
        flex: 0 0 auto; width: 40px; height: 40px; border-radius: 13px;
        background: var(--_plate); display: flex; align-items: center; justify-content: center;
        transition: background 0.25s ease;
      }
      .icon-box ha-icon { --mdc-icon-size: 21px; color: var(--_muted); transition: color 0.25s ease; }
      ha-card.open .icon-box { background: var(--_soft2); }
      ha-card.open .icon-box ha-icon { color: var(--_accent); }
      .mid { flex: 1 1 auto; min-width: 0; }
      .name { font-size: 15px; font-weight: 700; line-height: 1.2; letter-spacing: -0.2px;
        color: var(--_value); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .state { margin-top: 2px; font-size: 12.5px; font-weight: 500; color: var(--_muted);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      ha-card.open .state { color: var(--_accent); font-weight: 600; }
      .btns { flex: 0 0 auto; display: flex; gap: 4px; }
      .cbtn {
        border: none; cursor: pointer; padding: 0;
        width: 30px; height: 30px; border-radius: 10px;
        background: var(--_plate); color: var(--_value);
        display: flex; align-items: center; justify-content: center;
        transition: background 0.15s ease, transform 0.05s ease;
      }
      .cbtn ha-icon { --mdc-icon-size: 17px; }
      .cbtn.stop ha-icon { --mdc-icon-size: 14px; }
      .cbtn:active { transform: scale(0.92); }
      .cbtn.hidden { display: none; }
      .cbtn[disabled] { opacity: 0.4; cursor: default; }
      ha-card.unavail .name { color: var(--_muted); }
    `;
  }

  _entity() {
    return this._hass && this._config
      ? this._hass.states[this._config.entity]
      : null;
  }

  _features(st) {
    return (st && st.attributes.supported_features) || 0;
  }

  _pct(st) {
    if (Date.now() < this._optimisticUntil && this._optimisticPct != null) {
      return this._optimisticPct;
    }
    if (!st) return 0;
    const p = st.attributes.current_position;
    if (p != null) return Math.round(p);
    return st.state === "closed" ? 0 : 100;
  }

  _update() {
    if (!this._built || !this._config) return;
    const c = this._config;
    const els = this._els;
    const st = this._entity();

    els.name.textContent =
      c.name || (st && st.attributes.friendly_name) || c.entity;
    const dc = (st && st.attributes.device_class) || "";
    els.icon.setAttribute(
      "icon",
      c.icon || (st && st.attributes.icon) || DC_ICON[dc] || "mdi:window-shutter"
    );

    if (!st || st.state === "unavailable") {
      els.card.classList.add("unavail");
      els.card.classList.remove("open");
      els.state.textContent = "Indisponible";
      this.style.setProperty("--_pct", "0%");
      [els.up, els.stop, els.down].forEach((b) => (b.disabled = true));
      return;
    }
    els.card.classList.remove("unavail");

    const f = this._features(st);
    els.up.classList.toggle("hidden", !(f & F_OPEN));
    els.down.classList.toggle("hidden", !(f & F_CLOSE));
    els.stop.classList.toggle("hidden", !(f & F_STOP));
    [els.up, els.stop, els.down].forEach((b) => (b.disabled = false));

    const pct = this._pct(st);
    const accent = c.accent || "#7C8BAE";
    this.style.setProperty("--_accent", accent);
    this.style.setProperty("--_soft", hexToRgba(accent, 0.1));
    this.style.setProperty("--_soft2", hexToRgba(accent, 0.16));
    this.style.setProperty("--_pct", `${pct}%`);
    els.card.classList.toggle("open", pct > 0);

    if (st.state === "opening") els.state.textContent = "Ouverture…";
    else if (st.state === "closing") els.state.textContent = "Fermeture…";
    else if (pct <= 0) els.state.textContent = "Fermé";
    else if (pct >= 100) els.state.textContent = "Ouvert";
    else els.state.textContent = `Ouvert à ${pct} %`;
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
    if (!(this._features(st) & F_SET_POSITION)) return;
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
    this._optimisticUntil = Date.now() + 3000;
    this.style.setProperty("--_pct", `${pct}%`);
    this._els.state.textContent = `Ouvert à ${pct} %`;
    this._els.card.classList.toggle("open", pct > 0);
  }

  _onUp(e) {
    const d = this._drag;
    window.clearTimeout(this._holdTimer);
    if (!d || e.pointerId !== d.id) return;
    this._drag = null;
    this._els.card.classList.remove("dragging");
    if (!this._hass) return;

    if (d.moved && d.pct != null) {
      this._hass.callService("cover", "set_cover_position", {
        entity_id: this._config.entity,
        position: d.pct,
      });
    } else {
      this._moreInfo();
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

if (!customElements.get("serenity-cover-card")) {
  customElements.define("serenity-cover-card", SerenityCoverCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "serenity-cover-card",
  name: "Serenity Cover",
  description:
    "Cover row with up/stop/down buttons and drag-to-position fill.",
  preview: true,
  documentationURL: "https://github.com/your-username/serenity-cards",
});

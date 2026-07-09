/**
 * Serenity Group Card — custom:serenity-group-card
 *
 * A group control row: icon plate, title and a live "{n} sur {total}
 * allumée{s}" subtitle. The row tints with its accent while anything in
 * the group is on; tapping turns the whole group off (configurable).
 */

import { countEntities, isActiveState } from "../header-utils.js";

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

const fmt = (t, n, total) =>
  String(t)
    .replace(/\{n\}/g, n)
    .replace(/\{total\}/g, total)
    .replace(/\{s\}/g, n > 1 ? "s" : "");

export class SerenityGroupCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
  }

  setConfig(config) {
    if (!config || !Array.isArray(config.entities) || !config.entities.length) {
      throw new Error("You must define a list of entities");
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

  static getStubConfig(hass) {
    let entities = [];
    if (hass && hass.states) {
      entities = Object.keys(hass.states)
        .filter((e) => e.startsWith("light."))
        .slice(0, 3);
    }
    return { title: "Toutes les lumières", entities };
  }

  _ensureBuilt() {
    if (this._built) return;
    const root = this.shadowRoot;

    const style = document.createElement("style");
    style.textContent = this._css();
    root.appendChild(style);

    const card = document.createElement("ha-card");
    card.innerHTML = `
      <div class="row">
        <div class="icon-box"><ha-icon></ha-icon></div>
        <div class="txt">
          <div class="title"></div>
          <div class="sub"></div>
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
      iconBox: $(".icon-box"),
      icon: $(".icon-box ha-icon"),
      title: $(".title"),
      sub: $(".sub"),
    };

    card.addEventListener("click", () => this._tap());
    this._built = true;
  }

  _css() {
    return `
      :host {
        --_accent: #3E9E6B;
        --_value: var(--serenity-value-color, var(--primary-text-color, #16201b));
        --_muted: var(--serenity-muted-color, var(--secondary-text-color, #9aa3af));
        --_plate: var(--serenity-tile-plate, rgba(120, 130, 138, 0.10));
        --_font: var(--serenity-header-font, "Inter", "Roboto", system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif);
        display: block;
        font-family: var(--_font);
      }
      ha-card {
        padding: 11px 14px; cursor: pointer; overflow: hidden;
        transition: background-image 0.25s ease;
      }
      /* Tint layered over the card background so shadow/elevation stay intact */
      ha-card.on { background-image: linear-gradient(0deg, var(--_soft), var(--_soft)); }
      .row { display: flex; align-items: center; gap: 12px; min-width: 0; }
      .icon-box {
        flex: 0 0 auto; width: 38px; height: 38px; border-radius: 12px;
        background: var(--_plate); display: flex; align-items: center; justify-content: center;
        transition: background 0.25s ease;
      }
      .icon-box ha-icon { --mdc-icon-size: 20px; color: var(--_muted); transition: color 0.25s ease; }
      ha-card.on .icon-box { background: var(--_soft2); }
      ha-card.on .icon-box ha-icon { color: var(--_accent); }
      .txt { min-width: 0; }
      .title { font-size: 14.5px; font-weight: 700; letter-spacing: -0.2px; color: var(--_value);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sub { margin-top: 2px; font-size: 12px; font-weight: 500; color: var(--_muted);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    `;
  }

  _counts() {
    const c = this._config;
    const spec = { entities: c.entities };
    if (c.state != null) spec.state = c.state;
    const n = countEntities(this._hass, spec);
    return { n, total: c.entities.length };
  }

  _update() {
    if (!this._built || !this._config || !this._hass) return;
    const c = this._config;
    const els = this._els;

    els.title.textContent = c.title || "Groupe";
    els.icon.setAttribute("icon", c.icon || "mdi:lightbulb-group");

    const { n, total } = this._counts();
    const on = n > 0;
    els.sub.textContent = on
      ? fmt(
          c.subtitle || "{n} sur {total} allumée{s} — Appuyer pour éteindre",
          n,
          total
        )
      : fmt(c.subtitle_zero || "Tout éteint", n, total);

    const accent = c.accent || "#3E9E6B";
    this.style.setProperty("--_accent", accent);
    this.style.setProperty("--_soft", hexToRgba(accent, 0.07));
    this.style.setProperty("--_soft2", hexToRgba(accent, 0.16));
    els.card.classList.toggle("on", on);
  }

  _tap() {
    const c = this._config;
    const action = c.tap_action || "turn_off";
    if (action === "none" || !this._hass) return;
    if (action === "toggle") {
      const { n } = this._counts();
      this._hass.callService(
        "homeassistant",
        n > 0 ? "turn_off" : "turn_on",
        { entity_id: c.entities }
      );
    } else {
      this._hass.callService("homeassistant", "turn_off", {
        entity_id: c.entities,
      });
    }
  }
}

if (!customElements.get("serenity-group-card")) {
  customElements.define("serenity-group-card", SerenityGroupCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "serenity-group-card",
  name: "Serenity Group",
  description:
    "Group row with live on-count; tap turns the whole group off (or toggles).",
  preview: true,
  documentationURL: "https://github.com/your-username/serenity-cards",
});

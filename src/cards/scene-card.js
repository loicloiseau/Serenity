/**
 * Serenity Scene Card — custom:serenity-scene-card
 *
 * A horizontal row of scene chips: icon plate + name, tap to activate.
 * The most recently activated scene is highlighted with its accent.
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

const DEFAULT_ACCENTS = ["#3F9E6B", "#E0813F", "#5B9BF5", "#8B6FD0", "#E2B33C", "#D267A0"];

export class SerenitySceneCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
  }

  setConfig(config) {
    if (!config || !Array.isArray(config.scenes) || !config.scenes.length) {
      throw new Error("You must define a list of scenes");
    }
    this._config = { ...config };
    if (this._built) {
      this._buildChips();
      this._update();
    }
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
    return 2;
  }

  static getStubConfig(hass) {
    let scenes = [];
    if (hass && hass.states) {
      scenes = Object.keys(hass.states)
        .filter((e) => e.startsWith("scene."))
        .slice(0, 4)
        .map((entity) => ({ entity }));
    }
    return { title: "Scènes", scenes };
  }

  _ensureBuilt() {
    if (this._built) return;
    const root = this.shadowRoot;

    const style = document.createElement("style");
    style.textContent = this._css();
    root.appendChild(style);

    const card = document.createElement("ha-card");
    card.innerHTML = `
      <div class="head hidden">
        <div class="title"></div>
      </div>
      <div class="scenes"></div>`;
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

    this._els = {
      card,
      head: root.querySelector(".head"),
      title: root.querySelector(".title"),
      scenes: root.querySelector(".scenes"),
    };

    this._built = true;
    this._buildChips();
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
      ha-card { padding: 13px 14px; overflow: hidden; }
      .head { margin-bottom: 11px; }
      .head.hidden { display: none; }
      .title { font-size: 14.5px; font-weight: 700; letter-spacing: -0.2px; color: var(--_value); }
      .scenes {
        display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none;
        -webkit-overflow-scrolling: touch; margin: 0 -2px; padding: 2px;
      }
      .scenes::-webkit-scrollbar { display: none; }
      .scene {
        flex: 1 0 auto; min-width: 86px; max-width: 140px;
        display: flex; flex-direction: column; align-items: center; gap: 8px;
        padding: 12px 10px; border: none; border-radius: 15px; cursor: pointer;
        background: var(--_plate);
        transition: background 0.2s ease, transform 0.08s ease;
        font-family: inherit;
      }
      .scene:active { transform: scale(0.95); }
      .scene .plate {
        width: 38px; height: 38px; border-radius: 12px;
        background: var(--sc-soft2, rgba(120, 130, 138, 0.12));
        display: flex; align-items: center; justify-content: center;
        transition: background 0.2s ease;
      }
      .scene ha-icon { --mdc-icon-size: 20px; color: var(--sc-accent, var(--_muted)); }
      .scene .s-name {
        font-size: 12.5px; font-weight: 600; color: var(--_value);
        max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .scene.active { background: var(--sc-soft, var(--_plate)); }
      .scene.active .s-name { color: var(--sc-accent); }
    `;
  }

  _buildChips() {
    if (!this._built || !this._config) return;
    const c = this._config;
    const els = this._els;

    els.head.classList.toggle("hidden", !c.title);
    els.title.textContent = c.title || "";

    els.scenes.textContent = "";
    this._chips = [];
    c.scenes.forEach((sc, i) => {
      const accent = sc.accent || DEFAULT_ACCENTS[i % DEFAULT_ACCENTS.length];
      const btn = document.createElement("button");
      btn.className = "scene";
      btn.style.setProperty("--sc-accent", accent);
      btn.style.setProperty("--sc-soft", hexToRgba(accent, 0.12));
      btn.style.setProperty("--sc-soft2", hexToRgba(accent, 0.16));
      btn.innerHTML = `
        <span class="plate"><ha-icon></ha-icon></span>
        <span class="s-name"></span>`;
      btn.querySelector("ha-icon").setAttribute(
        "icon",
        sc.icon || "mdi:palette-outline"
      );
      btn.addEventListener("click", () => this._activate(sc.entity));
      els.scenes.appendChild(btn);
      this._chips.push({ btn, spec: sc });
    });
  }

  _update() {
    if (!this._built || !this._config || !this._hass || !this._chips) return;

    // Highlight the most recently activated scene (scene state = timestamp).
    let latest = null;
    let latestTs = 0;
    for (const { spec } of this._chips) {
      const st = this._hass.states[spec.entity];
      if (!st) continue;
      const ts = Date.parse(st.state);
      if (!isNaN(ts) && ts > latestTs) {
        latestTs = ts;
        latest = spec.entity;
      }
    }

    for (const { btn, spec } of this._chips) {
      const st = this._hass.states[spec.entity];
      btn.querySelector(".s-name").textContent =
        spec.name ||
        (st && st.attributes.friendly_name) ||
        spec.entity.split(".")[1];
      btn.classList.toggle(
        "active",
        this._config.highlight_last !== false && spec.entity === latest
      );
    }
  }

  _activate(entity) {
    if (!this._hass) return;
    this._hass.callService("scene", "turn_on", { entity_id: entity });
  }
}

if (!customElements.get("serenity-scene-card")) {
  customElements.define("serenity-scene-card", SerenitySceneCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "serenity-scene-card",
  name: "Serenity Scenes",
  description:
    "Row of scene chips; tap to activate, the last-activated scene is highlighted.",
  preview: true,
  documentationURL: "https://github.com/your-username/serenity-cards",
});

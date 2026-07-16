/**
 * Serenity Tabs Card — custom:serenity-tabs-card
 *
 * A container that shows one deck of cards at a time, switched with
 * Serenity-style chips (and an optional horizontal swipe). Unlike
 * gesture-driven swipers it never captures vertical touches, so the
 * page keeps scrolling naturally.
 *
 *   tabs:
 *     - title: Rez-de-chaussée
 *       icon: mdi:home-variant     # optional
 *       accent: "#E0813F"          # optional
 *       cards: [ ...any cards... ]
 *   default: 1        # start tab (index), default 0
 *   swipe: true       # horizontal swipe switches tabs (default true)
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

export class SerenityTabsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
    this._sel = 0;
    this._panes = []; // [{wrap, cards: [el]}]
    this._buildSeq = 0;
  }

  setConfig(config) {
    if (!config || !Array.isArray(config.tabs) || !config.tabs.length) {
      throw new Error("You must define tabs: [{title, cards: [...]}]");
    }
    this._config = { ...config };
    this._sel = Math.min(
      Math.max(0, config.default != null ? config.default : 0),
      config.tabs.length - 1
    );
    if (this._built) {
      this._buildChips();
      this._buildPanes();
    }
  }

  set hass(hass) {
    this._hass = hass;
    for (const pane of this._panes) {
      for (const el of pane.cards) {
        try {
          el.hass = hass;
        } catch (e) {
          /* child card error — leave it visible */
        }
      }
    }
  }

  connectedCallback() {
    this._ensureBuilt();
  }

  getCardSize() {
    return 6;
  }

  getGridOptions() {
    return { columns: 12, rows: "auto" };
  }

  static getStubConfig() {
    return {
      tabs: [
        { title: "Onglet 1", cards: [] },
        { title: "Onglet 2", cards: [] },
      ],
    };
  }

  _ensureBuilt() {
    if (this._built) return;
    const root = this.shadowRoot;

    const style = document.createElement("style");
    style.textContent = this._css();
    root.appendChild(style);

    const chips = document.createElement("div");
    chips.className = "chips";
    root.appendChild(chips);

    const panes = document.createElement("div");
    panes.className = "panes";
    root.appendChild(panes);

    this._els = { chips, panes };
    this._bindSwipe(panes);
    this._built = true;
    if (this._config) {
      this._buildChips();
      this._buildPanes();
    }
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
      /* One card-shaped segmented control (same background/radius as cards) */
      .chips {
        display: flex; gap: 4px; margin: 0 0 10px; padding: 5px;
        background: var(--ha-card-background, var(--card-background-color, #fff));
        border-radius: var(--ha-card-border-radius, 18px);
        box-shadow: var(--ha-card-box-shadow, 0 1px 3px rgba(16, 22, 18, 0.08));
        box-sizing: border-box;
        overflow-x: auto; scrollbar-width: none;
      }
      .chips::-webkit-scrollbar { display: none; }
      .chip {
        flex: 1 1 0; min-width: 0;
        display: flex; align-items: center; justify-content: center; gap: 7px;
        border: none; cursor: pointer; font-family: inherit;
        padding: 9px 12px;
        border-radius: calc(var(--ha-card-border-radius, 18px) - 5px);
        background: none; color: var(--_muted);
        font-size: 13px; font-weight: 600; white-space: nowrap;
        transition: background 0.18s ease, color 0.18s ease, transform 0.06s ease;
        -webkit-tap-highlight-color: transparent;
      }
      .chip:active { transform: scale(0.97); }
      .chip ha-icon { --mdc-icon-size: 17px; flex: 0 0 auto; }
      .chip.active { background: var(--c-soft); color: var(--c-accent); }
      /* Vertical touches scroll the page; only horizontal drags reach the swipe handler. */
      .panes { touch-action: pan-y; position: relative; }
      .pane { display: flex; flex-direction: column; gap: 8px; }
      .pane.hidden { display: none; }
      .pane.enter-left { animation: pane-left 0.22s ease; }
      .pane.enter-right { animation: pane-right 0.22s ease; }
      @keyframes pane-left { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: none; } }
      @keyframes pane-right { from { opacity: 0; transform: translateX(-14px); } to { opacity: 1; transform: none; } }
      @media (prefers-reduced-motion: reduce) {
        .pane.enter-left, .pane.enter-right { animation: none; }
      }
      .err {
        padding: 10px 12px; border-radius: 12px; background: var(--_plate);
        font-size: 12.5px; color: var(--_muted);
      }
    `;
  }

  _buildChips() {
    const chips = this._els.chips;
    chips.textContent = "";
    this._chipEls = [];
    this._config.tabs.forEach((tab, i) => {
      const accent = tab.accent || DEFAULT_ACCENTS[i % DEFAULT_ACCENTS.length];
      const b = document.createElement("button");
      b.className = "chip" + (i === this._sel ? " active" : "");
      b.style.setProperty("--c-accent", accent);
      b.style.setProperty("--c-soft", hexToRgba(accent, 0.15));
      if (tab.icon) {
        const ico = document.createElement("ha-icon");
        ico.setAttribute("icon", tab.icon);
        b.appendChild(ico);
      }
      b.appendChild(document.createTextNode(tab.title || `Onglet ${i + 1}`));
      b.addEventListener("click", () => this._select(i));
      chips.appendChild(b);
      this._chipEls.push(b);
    });
  }

  async _buildPanes() {
    const seq = ++this._buildSeq;
    const panes = this._els.panes;
    panes.textContent = "";
    this._panes = [];

    let helpers = null;
    try {
      helpers = await window.loadCardHelpers();
    } catch (e) {
      /* helpers unavailable */
    }
    if (seq !== this._buildSeq) return; // superseded by a newer setConfig

    this._config.tabs.forEach((tab, i) => {
      const wrap = document.createElement("div");
      wrap.className = "pane" + (i === this._sel ? "" : " hidden");
      const cards = [];
      for (const cfg of tab.cards || []) {
        let el;
        try {
          el = helpers
            ? helpers.createCardElement(cfg)
            : document.createElement("div");
          if (!helpers) {
            el.className = "err";
            el.textContent = "Cartes indisponibles";
          }
          if (this._hass) el.hass = this._hass;
        } catch (e) {
          el = document.createElement("div");
          el.className = "err";
          el.textContent = `Carte invalide : ${cfg && cfg.type}`;
        }
        wrap.appendChild(el);
        cards.push(el);
      }
      panes.appendChild(wrap);
      this._panes.push({ wrap, cards });
    });
  }

  _select(i) {
    if (i === this._sel || !this._panes[i]) return;
    const dir = i > this._sel ? "enter-left" : "enter-right";
    this._sel = i;
    this._chipEls.forEach((b, j) => b.classList.toggle("active", j === i));
    this._panes.forEach((p, j) => {
      p.wrap.classList.remove("enter-left", "enter-right");
      p.wrap.classList.toggle("hidden", j !== i);
      if (j === i) {
        // retrigger the entrance animation
        void p.wrap.offsetWidth;
        p.wrap.classList.add(dir);
      }
    });
  }

  /** Horizontal swipe on the pane area switches tabs (vertical stays native). */
  _bindSwipe(zone) {
    let x0 = null;
    let y0 = null;
    zone.addEventListener(
      "pointerdown",
      (ev) => {
        if (ev.pointerType === "mouse") return;
        x0 = ev.clientX;
        y0 = ev.clientY;
      },
      { passive: true }
    );
    zone.addEventListener(
      "pointerup",
      (ev) => {
        if (
          x0 == null ||
          this._config.swipe === false ||
          window.__serenityCardDrag === true
        ) {
          x0 = null;
          return;
        }
        const dx = ev.clientX - x0;
        const dy = ev.clientY - y0;
        x0 = null;
        if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
        const n = this._config.tabs.length;
        const next = this._sel + (dx < 0 ? 1 : -1);
        if (next >= 0 && next < n) this._select(next);
      },
      { passive: true }
    );
    zone.addEventListener("pointercancel", () => (x0 = null), {
      passive: true,
    });
  }
}

if (!customElements.get("serenity-tabs-card")) {
  customElements.define("serenity-tabs-card", SerenityTabsCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "serenity-tabs-card",
  name: "Serenity Tabs",
  description:
    "Chip-switched decks of cards (scroll-safe alternative to swipe containers).",
  preview: false,
  documentationURL: "https://github.com/your-username/serenity-cards",
});

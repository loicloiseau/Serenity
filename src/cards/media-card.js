/**
 * Serenity Media Card — custom:serenity-media-card
 *
 * A media controller in the Serenity style: artwork (or icon plate),
 * title/artist, prev / play-pause / next, a draggable volume bar and
 * player-selector chips when several players are configured.
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

const STATE_FR = {
  playing: "Lecture",
  paused: "En pause",
  idle: "À l'arrêt",
  off: "Éteint",
  standby: "En veille",
  buffering: "Chargement…",
  unavailable: "Indisponible",
  unknown: "À l'arrêt",
};

export class SerenityMediaCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
    this._selected = null; // entity_id of the active player
    this._volDrag = false;
    this._optimisticVol = null;
    this._optimisticUntil = 0;
  }

  setConfig(config) {
    const players =
      config && Array.isArray(config.players) && config.players.length
        ? config.players
        : config && config.entity
          ? [{ entity: config.entity }]
          : null;
    if (!players) {
      throw new Error("You must define players: [{entity: media_player.x}]");
    }
    this._config = { ...config, players };
    if (
      !this._selected ||
      !players.some((p) => p.entity === this._selected)
    ) {
      this._selected = players[0].entity;
    }
    if (this._built) {
      this._buildChips();
      this._update();
    }
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (!this.isConnected) return;
    this._ensureBuilt();
    // On first hass, prefer the player that is currently playing.
    if (first) {
      const playing = this._config.players.find((p) => {
        const st = hass.states[p.entity];
        return st && st.state === "playing";
      });
      if (playing) this._selected = playing.entity;
    }
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
    let entity = "";
    if (hass && hass.states) {
      entity =
        Object.keys(hass.states).find((e) => e.startsWith("media_player.")) ||
        "";
    }
    return { players: [{ entity }] };
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
        <div class="art"><ha-icon icon="mdi:music"></ha-icon></div>
        <div class="meta">
          <div class="m-title"></div>
          <div class="m-sub"></div>
        </div>
        <div class="controls">
          <button class="ctl prev" title="Précédent"><ha-icon icon="mdi:skip-previous"></ha-icon></button>
          <button class="ctl play" title="Lecture / pause"><ha-icon icon="mdi:play"></ha-icon></button>
          <button class="ctl next" title="Suivant"><ha-icon icon="mdi:skip-next"></ha-icon></button>
        </div>
      </div>
      <div class="volrow">
        <ha-icon class="vol-ico" icon="mdi:volume-high"></ha-icon>
        <div class="vol"><div class="vol-fill"></div></div>
        <span class="vol-pct"></span>
      </div>
      <div class="players"></div>`;
    root.appendChild(card);

    const $ = (s) => root.querySelector(s);
    this._els = {
      card,
      art: $(".art"),
      title: $(".m-title"),
      sub: $(".m-sub"),
      prev: $(".ctl.prev"),
      play: $(".ctl.play"),
      playIcon: $(".ctl.play ha-icon"),
      next: $(".ctl.next"),
      volRow: $(".volrow"),
      volIco: $(".vol-ico"),
      vol: $(".vol"),
      volFill: $(".vol-fill"),
      volPct: $(".vol-pct"),
      players: $(".players"),
    };

    const stop = (fn) => (e) => {
      e.stopPropagation();
      fn();
    };
    this._els.prev.addEventListener("click", stop(() => this._svc("media_previous_track")));
    this._els.play.addEventListener("click", stop(() => this._svc("media_play_pause")));
    this._els.next.addEventListener("click", stop(() => this._svc("media_next_track")));
    this._els.art.addEventListener("click", stop(() => this._moreInfo()));
    this._els.title.addEventListener("click", () => this._moreInfo());

    const vol = this._els.vol;
    vol.addEventListener("pointerdown", (e) => {
      this._volDrag = true;
      vol.setPointerCapture(e.pointerId);
      this._volFromEvent(e, false);
    });
    vol.addEventListener("pointermove", (e) => {
      if (this._volDrag) this._volFromEvent(e, false);
    });
    vol.addEventListener("pointerup", (e) => {
      if (!this._volDrag) return;
      this._volDrag = false;
      this._volFromEvent(e, true);
    });
    vol.addEventListener("pointercancel", () => {
      this._volDrag = false;
    });

    this._built = true;
    this._buildChips();
  }

  _css() {
    return `
      :host {
        --_accent: var(--serenity-media-color, #3F9E6B);
        --_value: var(--serenity-value-color, var(--primary-text-color, #16201b));
        --_muted: var(--serenity-muted-color, var(--secondary-text-color, #9aa3af));
        --_plate: var(--serenity-tile-plate, rgba(120, 130, 138, 0.10));
        --_font: var(--serenity-header-font, "Inter", "Roboto", system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif);
        display: block;
        font-family: var(--_font);
      }
      ha-card { padding: 13px 14px; overflow: hidden; }
      .top { display: flex; align-items: center; gap: 12px; min-width: 0; }
      .art {
        flex: 0 0 auto; width: 46px; height: 46px; border-radius: 13px;
        background: var(--_plate); background-size: cover; background-position: center;
        display: flex; align-items: center; justify-content: center; cursor: pointer;
      }
      .art ha-icon { --mdc-icon-size: 22px; color: var(--_muted); }
      .art.has-img ha-icon { display: none; }
      .meta { flex: 1 1 auto; min-width: 0; cursor: pointer; }
      .m-title { font-size: 14.5px; font-weight: 700; letter-spacing: -0.2px; color: var(--_value);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .m-sub { margin-top: 2px; font-size: 12px; font-weight: 500; color: var(--_muted);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .m-sub.playing { color: var(--_accent); font-weight: 600; }
      .controls { flex: 0 0 auto; display: flex; align-items: center; gap: 6px; }
      .ctl {
        border: none; cursor: pointer; padding: 0;
        width: 34px; height: 34px; border-radius: 11px;
        background: none; color: var(--_muted);
        display: flex; align-items: center; justify-content: center;
        transition: background 0.15s ease, color 0.15s ease, transform 0.05s ease;
      }
      .ctl ha-icon { --mdc-icon-size: 20px; }
      .ctl:active { transform: scale(0.93); }
      .ctl.play { width: 40px; height: 40px; border-radius: 13px; background: var(--_soft, rgba(63,158,107,0.14)); color: var(--_accent); }
      .ctl.play ha-icon { --mdc-icon-size: 22px; }
      .ctl[disabled] { opacity: 0.35; cursor: default; }

      .volrow { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
      .volrow.hidden { display: none; }
      .vol-ico { --mdc-icon-size: 16px; color: var(--_muted); flex: 0 0 auto; }
      .vol {
        flex: 1 1 auto; height: 22px; display: flex; align-items: center;
        cursor: pointer; touch-action: none; position: relative;
      }
      .vol::before {
        content: ""; position: absolute; left: 0; right: 0; top: 50%;
        height: 6px; transform: translateY(-50%);
        background: var(--_plate); border-radius: 999px;
      }
      .vol-fill {
        position: absolute; left: 0; top: 50%; height: 6px; transform: translateY(-50%);
        width: var(--_vol, 0%); background: var(--_accent); border-radius: 999px;
        transition: width 0.1s ease;
      }
      .vol-pct { flex: 0 0 auto; font-size: 11.5px; font-weight: 600; color: var(--_muted); min-width: 32px; text-align: right; }

      .players { display: flex; gap: 6px; margin-top: 12px; overflow-x: auto; scrollbar-width: none; }
      .players::-webkit-scrollbar { display: none; }
      .players.hidden { display: none; }
      .pchip {
        flex: 0 0 auto; border: none; cursor: pointer; font-family: inherit;
        padding: 6px 12px; border-radius: 999px; background: var(--_plate);
        font-size: 12px; font-weight: 600; color: var(--_muted);
        display: inline-flex; align-items: center; gap: 6px;
        transition: background 0.15s ease, color 0.15s ease;
      }
      .pchip .pdot { width: 6px; height: 6px; border-radius: 50%; background: transparent; }
      .pchip.playing .pdot { background: var(--_accent); }
      .pchip.active { background: var(--_soft, rgba(63,158,107,0.14)); color: var(--_accent); }
    `;
  }

  /* ----------------------------- players ----------------------------- */

  _buildChips() {
    if (!this._built || !this._config) return;
    const els = this._els;
    const players = this._config.players;
    els.players.classList.toggle("hidden", players.length < 2);
    els.players.textContent = "";
    this._chips = [];
    for (const p of players) {
      const chip = document.createElement("button");
      chip.className = "pchip";
      chip.innerHTML = `<span class="pdot"></span><span class="p-name"></span>`;
      chip.addEventListener("click", () => {
        this._selected = p.entity;
        this._update();
      });
      els.players.appendChild(chip);
      this._chips.push({ chip, spec: p });
    }
  }

  _entity() {
    return this._hass ? this._hass.states[this._selected] : null;
  }

  _vol(st) {
    if (Date.now() < this._optimisticUntil && this._optimisticVol != null) {
      return this._optimisticVol;
    }
    const v = st && st.attributes.volume_level;
    return v == null ? null : Math.round(v * 100);
  }

  /* ----------------------------- render ----------------------------- */

  _update() {
    if (!this._built || !this._config || !this._hass) return;
    const c = this._config;
    const els = this._els;
    const st = this._entity();
    const spec =
      c.players.find((p) => p.entity === this._selected) || c.players[0];

    const pName = (p) => {
      const s = this._hass.states[p.entity];
      return (
        p.label ||
        p.name ||
        (s && s.attributes.friendly_name) ||
        p.entity.split(".")[1]
      );
    };

    // Accent
    const accent = c.accent || "#3F9E6B";
    this.style.setProperty("--_accent", accent);
    this.style.setProperty("--_soft", hexToRgba(accent, 0.14));

    // Chips
    if (this._chips) {
      for (const { chip, spec: p } of this._chips) {
        chip.querySelector(".p-name").textContent = pName(p);
        chip.classList.toggle("active", p.entity === this._selected);
        const s = this._hass.states[p.entity];
        chip.classList.toggle("playing", !!s && s.state === "playing");
      }
    }

    if (!st || st.state === "unavailable") {
      els.title.textContent = pName(spec);
      els.sub.textContent = "Indisponible";
      els.sub.classList.remove("playing");
      els.art.classList.remove("has-img");
      els.art.style.backgroundImage = "";
      [els.prev, els.play, els.next].forEach((b) => (b.disabled = true));
      els.volRow.classList.add("hidden");
      return;
    }

    const a = st.attributes;
    const playing = st.state === "playing";
    const active = playing || st.state === "paused" || st.state === "buffering";

    // Artwork
    const pic = a.entity_picture || null;
    els.art.classList.toggle("has-img", !!pic);
    els.art.style.backgroundImage = pic ? `url("${pic}")` : "";

    // Title / subtitle
    if (a.media_title) {
      els.title.textContent = a.media_title;
      const bits = [];
      if (a.media_artist || a.media_series_title)
        bits.push(a.media_artist || a.media_series_title);
      bits.push(pName(spec));
      els.sub.textContent = bits.join(" · ");
    } else {
      els.title.textContent = pName(spec);
      els.sub.textContent = STATE_FR[st.state] || st.state;
    }
    els.sub.classList.toggle("playing", playing);

    // Controls
    els.play.disabled = false;
    els.playIcon.setAttribute("icon", playing ? "mdi:pause" : "mdi:play");
    els.prev.disabled = !active;
    els.next.disabled = !active;

    // Volume
    const vol = this._vol(st);
    els.volRow.classList.toggle("hidden", vol == null);
    if (vol != null) {
      this.style.setProperty("--_vol", `${vol}%`);
      els.volPct.textContent = `${vol}%`;
      els.volIco.setAttribute(
        "icon",
        a.is_volume_muted || vol === 0
          ? "mdi:volume-off"
          : vol < 40
            ? "mdi:volume-medium"
            : "mdi:volume-high"
      );
    }
  }

  /* ----------------------------- actions ----------------------------- */

  _svc(service, data) {
    if (!this._hass) return;
    this._hass.callService("media_player", service, {
      entity_id: this._selected,
      ...data,
    });
  }

  _volFromEvent(e, commit) {
    const rect = this._els.vol.getBoundingClientRect();
    let pct = ((e.clientX - rect.left) / rect.width) * 100;
    pct = Math.max(0, Math.min(100, Math.round(pct)));
    this._optimisticVol = pct;
    this._optimisticUntil = Date.now() + 2000;
    this.style.setProperty("--_vol", `${pct}%`);
    this._els.volPct.textContent = `${pct}%`;
    if (commit) this._svc("volume_set", { volume_level: pct / 100 });
  }

  _moreInfo() {
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId: this._selected },
        bubbles: true,
        composed: true,
      })
    );
  }
}

if (!customElements.get("serenity-media-card")) {
  customElements.define("serenity-media-card", SerenityMediaCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "serenity-media-card",
  name: "Serenity Media",
  description:
    "Media controller with artwork, transport controls, draggable volume and player chips.",
  preview: true,
  documentationURL: "https://github.com/your-username/serenity-cards",
});

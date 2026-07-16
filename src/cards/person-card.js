/**
 * Serenity Person Card — custom:serenity-person-card
 *
 * A compact presence row: initials (or photo) avatar with a live status dot,
 * name + location, and a home/away label with "depuis …" elapsed time.
 * Designed to sit two-up (implements getGridOptions → half width).
 */

import { statesDiffer } from "../header-utils.js";

// Soft avatar palettes used when the person is home (picked by name hash).
const PALETTE = [
  { bg: "#E3F2E9", fg: "#3F9E6B" }, // green
  { bg: "#FBEADF", fg: "#E0813F" }, // orange
  { bg: "#E5EDF9", fg: "#5B8DEF" }, // blue
  { bg: "#EFE9F8", fg: "#8B6FD0" }, // purple
  { bg: "#FBE6EE", fg: "#D267A0" }, // pink
  { bg: "#E6F3F1", fg: "#3FA597" }, // teal
];
const AWAY_AV = { bg: "#ECEEEF", fg: "#9aa3af" };

const NON_ZONE = new Set(["home", "not_home", "unknown", "unavailable", ""]);

const titleCase = (s) =>
  String(s || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initialsOf(name, override) {
  if (override) return String(override).slice(0, 3).toUpperCase();
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** French elapsed-time: "depuis 18 min", "depuis 2 h", "depuis 3 j". */
function sinceText(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  let m = Math.floor((Date.now() - then) / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `depuis ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `depuis ${h} h`;
  const d = Math.floor(h / 24);
  return `depuis ${d} j`;
}

export class SerenityPersonCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
    this._timer = null;
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("You must define a person or device_tracker entity");
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
    return [c.entity, c.battery_entity, c.distance_entity];
  }

  connectedCallback() {
    this._ensureBuilt();
    if (this._hass) this._update();
    // Keep the "depuis …" label fresh without a hass push.
    this._timer = window.setInterval(() => this._update(), 60000);
  }

  disconnectedCallback() {
    if (this._timer) {
      window.clearInterval(this._timer);
      this._timer = null;
    }
  }

  getCardSize() {
    return 1;
  }

  // Modern sections view: default to half width so two fit per row.
  getGridOptions() {
    return { columns: 6, rows: "auto", min_columns: 3 };
  }

  static getStubConfig(hass) {
    let entity = "";
    if (hass && hass.states) {
      entity =
        Object.keys(hass.states).find((e) => e.startsWith("person.")) ||
        Object.keys(hass.states).find((e) => e.startsWith("device_tracker.")) ||
        "";
    }
    return { entity };
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
      <div class="person">
        <div class="avatar">
          <div class="circle"><span class="initials"></span></div>
          <span class="pdot"></span>
        </div>
        <div class="mid">
          <div class="toprow">
            <div class="name"></div>
            <div class="since"></div>
          </div>
          <div class="locrow">
            <div class="loc"><ha-icon class="loc-ico"></ha-icon><span class="ltext"></span></div>
            <div class="batt hidden"><ha-icon></ha-icon><span class="b-txt"></span></div>
            <div class="status"></div>
          </div>
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
      person: $(".person"),
      avatar: $(".avatar"),
      circle: $(".circle"),
      initials: $(".initials"),
      dot: $(".pdot"),
      name: $(".name"),
      locIco: $(".loc-ico"),
      locText: $(".ltext"),
      loc: $(".loc"),
      status: $(".status"),
      since: $(".since"),
      batt: $(".batt"),
      battIco: $(".batt ha-icon"),
      battTxt: $(".b-txt"),
    };

    this._els.person.addEventListener("click", () => this._moreInfo());
    this._built = true;
  }

  _css() {
    return `
      :host {
        --_value: var(--serenity-value-color, var(--primary-text-color, #16201b));
        --_muted: var(--serenity-muted-color, var(--secondary-text-color, #9aa3af));
        --_home: var(--serenity-person-home, #3F9E6B);
        --_dot-home: var(--serenity-person-dot, #35C76C);
        --_dot-away: var(--serenity-person-dot-away, #b4babd);
        --_font: var(--serenity-header-font, "Inter", "Roboto", system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif);
        display: block;
        font-family: var(--_font);
      }
      ha-card { padding: 11px 14px; }
      .person { display: flex; align-items: center; gap: 12px; cursor: pointer; min-width: 0; }
      .avatar { position: relative; flex: 0 0 auto; width: 46px; height: 46px; }
      .circle {
        width: 100%; height: 100%; border-radius: 50%;
        background: var(--av-bg, #ECEEEF); color: var(--av-fg, #9aa3af);
        display: flex; align-items: center; justify-content: center;
        font-size: 15px; font-weight: 700; letter-spacing: 0.3px;
      }
      .circle img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
      .pdot {
        position: absolute; right: 0; bottom: 1px; width: 13px; height: 13px;
        border-radius: 50%; background: var(--_dot-away);
        border: 2.5px solid var(--ha-card-background, var(--card-background-color, #fff));
      }
      .mid { flex: 1 1 auto; min-width: 0; }
      .toprow { display: flex; align-items: baseline; gap: 8px; }
      .name { flex: 1 1 auto; min-width: 0; font-size: 16px; font-weight: 700; line-height: 1.2;
        color: var(--_value); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .since { flex: 0 0 auto; font-size: 12.5px; font-weight: 500; color: var(--_muted); white-space: nowrap; }
      .since.hidden { display: none; }
      .locrow { display: flex; align-items: center; gap: 8px; margin-top: 3px; min-width: 0; }
      .loc { display: flex; align-items: center; gap: 5px; min-width: 0; flex: 1 1 auto;
        font-size: 13.5px; font-weight: 500; color: var(--_muted); }
      .loc-ico { --mdc-icon-size: 15px; flex: 0 0 auto; color: var(--_muted); }
      .ltext { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .batt { flex: 0 0 auto; display: flex; align-items: center; gap: 2px;
        font-size: 12px; font-weight: 600; color: var(--_muted); white-space: nowrap; }
      .batt ha-icon { --mdc-icon-size: 13px; }
      .batt.mid { color: #E0A95B; }
      .batt.low { color: #E06B5B; }
      .batt.hidden { display: none; }
      .status { flex: 0 0 auto; font-size: 12.5px; font-weight: 600; color: var(--_muted); white-space: nowrap; }
      .status.home { color: var(--_home); }
      .status.hidden { display: none; }
      .unavail .name { color: var(--_muted); }
    `;
  }

  /* --------------------------- live updates --------------------------- */

  _entity() {
    return this._hass && this._config
      ? this._hass.states[this._config.entity]
      : null;
  }

  _update() {
    if (!this._built || !this._config) return;
    const c = this._config;
    const els = this._els;
    const st = this._entity();

    const name = c.name || (st && st.attributes.friendly_name) || c.entity;
    els.name.textContent = name;

    if (!st || st.state === "unavailable") {
      els.person.classList.add("unavail");
      this._setAvatar(AWAY_AV, initialsOf(name, c.initials), null);
      els.dot.style.background = "var(--_dot-away)";
      els.status.classList.add("hidden");
      els.status.classList.remove("home");
      els.loc.style.display = "none";
      els.since.textContent = c.unavailable_label || "Indisponible";
      els.since.classList.remove("hidden");
      return;
    }
    els.person.classList.remove("unavail");

    const state = st.state;
    const homeStates = c.home_states || ["home"];
    const isHome = homeStates.includes(state);

    // Avatar: photo if available, else initials on a per-person colour.
    const palette = isHome
      ? c.color
        ? { bg: c.color_bg || "#ECEEEF", fg: c.color }
        : PALETTE[hashStr(name) % PALETTE.length]
      : AWAY_AV;
    const pic =
      c.show_picture !== false && st.attributes.entity_picture
        ? st.attributes.entity_picture
        : null;
    this._setAvatar(palette, initialsOf(name, c.initials), pic);

    // Status dot
    els.dot.style.background = isHome
      ? "var(--_dot-home)"
      : "var(--_dot-away)";
    // Right-hand status label is opt-in (default off): presence is conveyed
    // by the dot colour and the location line.
    const showStatus = c.show_status === true;
    els.status.classList.toggle("hidden", !showStatus);
    els.status.textContent = isHome
      ? c.home_label || "À la maison"
      : c.away_label || "Sorti";
    els.status.classList.toggle("home", isHome);

    // Location line = the GPS zone the person is in.
    // The person's state IS the zone (home / not_home / <zone name>); we look
    // up the matching zone.* entity to use its real name + icon.
    let loc = c.location; // optional static override only
    let icon = c.location_icon;
    if (!loc) {
      const s = String(state).toLowerCase();
      if (s === "not_home") {
        loc = c.away_label_location || "Absent";
        icon = icon || "mdi:map-marker-off-outline";
      } else if (s === "unknown") {
        loc = "Inconnu";
        icon = icon || "mdi:map-marker-question-outline";
      } else {
        const zi = this._zoneInfo(state); // home or named GPS zone
        loc = zi ? zi.name : titleCase(state);
        icon = icon || (zi && zi.icon) || "mdi:map-marker-outline";
      }
    }
    icon = icon || "mdi:map-marker-outline";
    // Distance to home while away (any numeric sensor, e.g. proximity)
    if (!isHome && c.distance_entity) {
      const ds = this._hass.states[c.distance_entity];
      const dv = ds ? parseFloat(ds.state) : NaN;
      if (!isNaN(dv)) {
        const du = (ds.attributes.unit_of_measurement || "km").trim();
        loc = `${loc} · ${Math.round(dv * 10) / 10} ${du}`;
      }
    }
    els.loc.style.display = loc ? "flex" : "none";
    els.locText.textContent = loc || "";
    els.locIco.setAttribute("icon", icon);

    // Phone battery pill
    if (c.battery_entity) {
      const bs = this._hass.states[c.battery_entity];
      const bv = bs ? parseFloat(bs.state) : NaN;
      const show = !isNaN(bv);
      els.batt.classList.toggle("hidden", !show);
      if (show) {
        const lvl = Math.round(bv);
        els.battTxt.textContent = `${lvl}%`;
        els.battIco.setAttribute(
          "icon",
          lvl >= 95
            ? "mdi:battery"
            : `mdi:battery-${Math.max(10, Math.round(lvl / 10) * 10)}`
        );
        els.batt.classList.toggle("low", lvl <= 20);
        els.batt.classList.toggle("mid", lvl > 20 && lvl <= 40);
      }
    } else {
      els.batt.classList.add("hidden");
    }

    // Elapsed time
    const since = c.show_since === false ? "" : sinceText(st.last_changed);
    els.since.textContent = since;
    els.since.classList.toggle("hidden", !since);
  }

  /** Resolve a person state ("home" or a zone name) to the GPS zone's name + icon. */
  _zoneInfo(state) {
    const hs = this._hass.states;
    const s = String(state).toLowerCase();
    if (s === "home" && hs["zone.home"]) {
      const z = hs["zone.home"];
      return {
        name: z.attributes.friendly_name || "Maison",
        icon: z.attributes.icon || "mdi:home",
      };
    }
    for (const k in hs) {
      if (k.indexOf("zone.") !== 0) continue;
      const fn = hs[k].attributes.friendly_name;
      if (fn && fn.toLowerCase() === s) {
        return { name: fn, icon: hs[k].attributes.icon || "mdi:map-marker" };
      }
    }
    return s === "home" ? { name: "Maison", icon: "mdi:home" } : null;
  }

  _setAvatar(palette, initials, pic) {
    const els = this._els;
    if (pic) {
      els.circle.innerHTML = `<img src="${pic}" alt="">`;
    } else {
      if (!els.circle.querySelector(".initials")) {
        els.circle.innerHTML = `<span class="initials"></span>`;
      }
      els.circle.querySelector(".initials").textContent = initials;
    }
    this.style.setProperty("--av-bg", palette.bg);
    this.style.setProperty("--av-fg", palette.fg);
  }

  _moreInfo() {
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId: this._config.entity },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

if (!customElements.get("serenity-person-card")) {
  customElements.define("serenity-person-card", SerenityPersonCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "serenity-person-card",
  name: "Serenity Person",
  description:
    "Compact presence row with avatar, status dot, location and elapsed time. Fits two-up.",
  preview: true,
  documentationURL: "https://github.com/your-username/serenity-cards",
});

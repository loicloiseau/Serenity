/**
 * Serenity Alerts Card — custom:serenity-alerts-card
 *
 * A notification centre in the Serenity style. Aggregates household
 * alerts (open doors/windows, low ink/battery, custom rules) into rows.
 *
 * Collapsed, it shows the most recent alert with an iOS-like layer stack
 * hinting at the hidden ones; tap to expand the full list. Each alert can
 * be dismissed (X) — dismissals persist in localStorage and the alert
 * reappears automatically if it triggers again later. "Tout effacer"
 * dismisses everything at once. All clear shows a calm green row.
 */

import { relativeTime } from "../header-utils.js";

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

const STORAGE_KEY = "serenity_alerts_dismissed_v1";
const STORAGE_CAP = 100;

export class SerenityAlertsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
    this._timer = null;
    this._expanded = false;
    this._dismissed = new Map(); // id -> until-ts | null
  }

  setConfig(config) {
    this._config = { ...(config || {}) };
    this._expanded = this._config.expanded === true;
    this._loadDismissed();
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
    this._timer = window.setInterval(() => this._update(), 60000);
  }

  disconnectedCallback() {
    if (this._timer) {
      window.clearInterval(this._timer);
      this._timer = null;
    }
  }

  getCardSize() {
    return this._expanded ? 3 : 1;
  }

  static getStubConfig() {
    return { empty_message: "Vous n'avez aucune alerte !" };
  }

  /* --------------------------- persistence --------------------------- */

  _storageKey() {
    return (this._config && this._config.storage_key) || STORAGE_KEY;
  }

  _loadDismissed() {
    try {
      const raw = window.localStorage.getItem(this._storageKey());
      const arr = raw ? JSON.parse(raw) : [];
      // Accept both the old ["id"] and the new [["id", until]] formats.
      this._dismissed = new Map(
        arr.map((e) => (Array.isArray(e) ? [e[0], e[1]] : [e, null]))
      );
    } catch (e) {
      this._dismissed = new Map();
    }
  }

  _saveDismissed() {
    try {
      window.localStorage.setItem(
        this._storageKey(),
        JSON.stringify([...this._dismissed.entries()].slice(-STORAGE_CAP))
      );
    } catch (e) {
      /* storage unavailable — dismissals stay session-only */
    }
  }

  /** Drop stored ids that no longer match an active alert, so an alert
   *  that clears and re-triggers later (new timestamp → new id) reappears. */
  _pruneDismissed(activeIds) {
    let changed = false;
    const now = Date.now();
    for (const [id, until] of this._dismissed) {
      if (!activeIds.has(id) || (until != null && until <= now)) {
        this._dismissed.delete(id);
        changed = true;
      }
    }
    if (changed) this._saveDismissed();
  }

  _isDismissed(id) {
    if (!this._dismissed.has(id)) return false;
    const until = this._dismissed.get(id);
    return until == null || until > Date.now();
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
      <div class="header hidden">
        <div class="h-title"></div>
        <button class="clear-all"></button>
        <button class="chev up" title="Réduire"><ha-icon icon="mdi:chevron-up"></ha-icon></button>
      </div>
      <div class="list"></div>
      <div class="stack hidden"><div class="layer l1"></div><div class="layer l2"></div></div>`;
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
      header: $(".header"),
      hTitle: $(".h-title"),
      clearAll: $(".clear-all"),
      chevUp: $(".chev.up"),
      list: $(".list"),
      stack: $(".stack"),
    };

    this._els.chevUp.addEventListener("click", (e) => {
      e.stopPropagation();
      this._toggle(false);
    });
    this._els.clearAll.addEventListener("click", (e) => {
      e.stopPropagation();
      this._clearAll();
    });
    this._els.stack.addEventListener("click", () => this._toggle(true));

    this._built = true;
  }

  _css() {
    return `
      :host {
        --_value: var(--serenity-value-color, var(--primary-text-color, #16201b));
        --_muted: var(--serenity-muted-color, var(--secondary-text-color, #9aa3af));
        --_plate: var(--serenity-tile-plate, rgba(120, 130, 138, 0.10));
        --_ok: var(--serenity-ok-color, #3F9E6B);
        --_font: var(--serenity-header-font, "Inter", "Roboto", system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif);
        display: block;
        font-family: var(--_font);
      }
      ha-card { padding: 8px 10px; overflow: hidden; }
      .hidden { display: none !important; }

      .header {
        display: flex; align-items: center; gap: 10px;
        padding: 6px 6px 8px;
      }
      .h-title { flex: 1 1 auto; font-size: 13px; font-weight: 700; letter-spacing: -0.1px; color: var(--_value); }
      .clear-all {
        border: none; background: var(--_plate); cursor: pointer;
        padding: 5px 11px; border-radius: 999px; font-family: inherit;
        font-size: 11.5px; font-weight: 600; color: var(--_muted);
        transition: background 0.15s ease, color 0.15s ease;
      }
      .clear-all:hover { color: var(--_value); }
      .chev {
        border: none; background: none; cursor: pointer; padding: 2px;
        display: flex; align-items: center; color: var(--_muted);
      }
      .chev ha-icon { --mdc-icon-size: 20px; }

      .list { display: flex; flex-direction: column; }
      .row {
        display: flex; align-items: center; gap: 12px; min-width: 0;
        padding: 8px 6px; border-radius: 12px; cursor: pointer;
        animation: fade-in 0.22s ease;
      }
      @keyframes fade-in { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: none; } }
      .row + .row { margin-top: 2px; }
      .icon-box {
        flex: 0 0 auto; width: 36px; height: 36px; border-radius: 11px;
        display: flex; align-items: center; justify-content: center;
        background: var(--row-soft, var(--_plate));
      }
      .icon-box ha-icon { --mdc-icon-size: 19px; color: var(--row-accent, var(--_muted)); }
      .msg { flex: 1 1 auto; min-width: 0; font-size: 14px; font-weight: 600; color: var(--_value);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .when { flex: 0 0 auto; font-size: 12px; font-weight: 500; color: var(--_muted); white-space: nowrap; }
      .more { flex: 0 0 auto; font-size: 12px; font-weight: 700; color: var(--_muted);
        background: var(--_plate); padding: 4px 9px; border-radius: 999px; white-space: nowrap; }
      .dismiss {
        flex: 0 0 auto; border: none; cursor: pointer; padding: 0;
        width: 26px; height: 26px; border-radius: 50%;
        background: var(--_plate); color: var(--_muted);
        display: flex; align-items: center; justify-content: center;
        transition: background 0.15s ease, color 0.15s ease;
      }
      .dismiss:hover { color: var(--_value); }
      .dismiss ha-icon { --mdc-icon-size: 15px; }
      .row.chev-row .chev { margin-left: -4px; }

      .row.ok { cursor: default; }
      .row.ok .msg { color: var(--_ok); }

      /* iOS-like layer stack hinting at hidden alerts (collapsed state) */
      .stack { padding: 0 6px 4px; cursor: pointer; }
      .layer {
        height: 5px; border-radius: 999px; background: var(--_plate);
        margin: 3px auto 0;
      }
      .layer.l1 { width: 92%; }
      .layer.l2 { width: 82%; opacity: 0.7; }
      .stack.one .l2 { display: none; }
    `;
  }

  /* ----------------------------- alerts ----------------------------- */

  /** Collect active alerts: {id, entity, message, icon, color, since}. */
  _alerts() {
    const c = this._config;
    const hs = this._hass.states;
    const out = [];
    const name = (st, id) =>
      (st && st.attributes.friendly_name) || id.split(".")[1];
    const push = (entity, st, message, icon, color, tap) =>
      out.push({
        id: `${entity}|${(st && st.last_changed) || "na"}`,
        entity,
        message,
        icon,
        color,
        since: st && st.last_changed,
        tap,
      });

    for (const id of c.door_entities || []) {
      const st = hs[id];
      if (st && st.state === "on")
        push(id, st, `${name(st, id)} ouverte`, "mdi:door-open", "#E06B5B");
    }
    for (const id of c.window_entities || []) {
      const st = hs[id];
      if (st && st.state === "on")
        push(id, st, `${name(st, id)} ouverte`, "mdi:window-open-variant", "#E06B5B");
    }
    const inkTh = c.ink_threshold != null ? c.ink_threshold : 15;
    for (const id of c.ink_entities || []) {
      const st = hs[id];
      const v = st ? parseFloat(st.state) : NaN;
      if (!isNaN(v) && v <= inkTh)
        push(id, st, `${name(st, id)} faible (${Math.round(v)}%)`, "mdi:printer-alert", "#E0A95B");
    }
    const battTh = c.battery_threshold != null ? c.battery_threshold : 15;
    for (const id of c.battery_entities || []) {
      const st = hs[id];
      const v = st ? parseFloat(st.state) : NaN;
      if (!isNaN(v) && v <= battTh)
        push(id, st, `${name(st, id)} : batterie faible (${Math.round(v)}%)`, "mdi:battery-alert-variant-outline", "#E0A95B");
    }
    for (const al of c.alerts || []) {
      const st = hs[al.entity];
      if (!st) continue;
      let hit = false;
      if (al.state != null) hit = String(st.state) === String(al.state);
      else if (al.state_not != null)
        hit = String(st.state) !== String(al.state_not);
      else if (al.below != null) hit = parseFloat(st.state) < al.below;
      else if (al.above != null) hit = parseFloat(st.state) > al.above;
      if (hit)
        push(
          al.entity,
          st,
          al.message || `${name(st, al.entity)} : ${st.state}`,
          al.icon || "mdi:alert-circle-outline",
          al.color || "#E0A95B",
          al.tap_action
        );
    }
    for (const id of c.unavailable_entities || []) {
      const st = hs[id];
      if (!st || st.state === "unavailable")
        push(
          id,
          st,
          `${st ? name(st, id) : id} indisponible`,
          "mdi:lan-disconnect",
          "#9aa3af"
        );
    }

    // Newest first
    out.sort((a, b) => {
      const ta = a.since ? Date.parse(a.since) : 0;
      const tb = b.since ? Date.parse(b.since) : 0;
      return tb - ta;
    });
    return out;
  }

  /* ----------------------------- render ----------------------------- */

  _row(al, { dismissible, extra } = {}) {
    const row = document.createElement("div");
    row.className = "row";
    row.style.setProperty("--row-accent", al.color);
    row.style.setProperty("--row-soft", hexToRgba(al.color, 0.13));
    row.innerHTML = `
      <div class="icon-box"><ha-icon></ha-icon></div>
      <div class="msg"></div>
      <div class="when"></div>`;
    row.querySelector("ha-icon").setAttribute("icon", al.icon);
    row.querySelector(".msg").textContent = al.message;
    row.querySelector(".when").textContent = al.since
      ? relativeTime(al.since)
      : "";
    if (extra) row.appendChild(extra);
    if (dismissible) {
      const x = document.createElement("button");
      x.className = "dismiss";
      x.title = "Masquer cette alerte";
      x.innerHTML = `<ha-icon icon="mdi:close"></ha-icon>`;
      x.addEventListener("click", (e) => {
        e.stopPropagation();
        this._dismiss(al.id);
      });
      row.appendChild(x);
    }
    row.addEventListener("click", () => {
      const ta = al.tap;
      if (ta && ta.action === "navigate" && ta.navigation_path) {
        window.history.pushState(null, "", ta.navigation_path);
        window.dispatchEvent(
          new CustomEvent("location-changed", { detail: { replace: false } })
        );
        return;
      }
      if (ta && ta.action === "url" && ta.url_path) {
        window.open(ta.url_path, "_blank");
        return;
      }
      this.dispatchEvent(
        new CustomEvent("hass-more-info", {
          detail: { entityId: (ta && ta.entity) || al.entity },
          bubbles: true,
          composed: true,
        })
      );
    });
    return row;
  }

  _update() {
    if (!this._built || !this._config || !this._hass) return;
    const c = this._config;
    const els = this._els;

    const all = this._alerts();
    this._pruneDismissed(new Set(all.map((a) => a.id)));
    const visible = all.filter((a) => !this._isDismissed(a.id));
    const max = c.max_alerts || 8;

    els.list.textContent = "";

    // ── All clear ──
    if (!visible.length) {
      this._expanded = false;
      els.header.classList.add("hidden");
      els.stack.classList.add("hidden");
      const row = document.createElement("div");
      row.className = "row ok";
      row.style.setProperty("--row-accent", "var(--_ok)");
      row.style.setProperty("--row-soft", hexToRgba("#3F9E6B", 0.14));
      row.innerHTML = `
        <div class="icon-box"><ha-icon icon="mdi:check"></ha-icon></div>
        <div class="msg"></div>`;
      row.querySelector(".msg").textContent =
        all.length > 0
          ? c.dismissed_message || "Alertes masquées — tout est sous contrôle"
          : c.empty_message || "Vous n'avez aucune alerte !";
      els.list.appendChild(row);
      return;
    }

    // ── Collapsed: top alert + layer stack ──
    if (!this._expanded) {
      els.header.classList.add("hidden");
      const hidden = visible.length - 1;
      const extra = document.createElement("div");
      if (hidden > 0) {
        extra.className = "more";
        extra.textContent = `+${hidden}`;
      }
      const chev = document.createElement("button");
      chev.className = "chev";
      chev.title = "Voir toutes les alertes";
      chev.innerHTML = `<ha-icon icon="mdi:chevron-down"></ha-icon>`;
      chev.addEventListener("click", (e) => {
        e.stopPropagation();
        this._toggle(true);
      });

      const top = this._row(visible[0], {
        dismissible: false,
        extra: hidden > 0 ? extra : null,
      });
      top.appendChild(chev);
      if (hidden === 0) {
        // Single alert: allow dismissing right from the collapsed row
        const x = document.createElement("button");
        x.className = "dismiss";
        x.title = "Masquer cette alerte";
        x.innerHTML = `<ha-icon icon="mdi:close"></ha-icon>`;
        x.addEventListener("click", (e) => {
          e.stopPropagation();
          this._dismiss(visible[0].id);
        });
        top.insertBefore(x, chev);
      }
      els.list.appendChild(top);

      els.stack.classList.toggle("hidden", hidden === 0);
      els.stack.classList.toggle("one", hidden === 1);
      return;
    }

    // ── Expanded: header + all rows, each dismissible ──
    els.stack.classList.add("hidden");
    els.header.classList.remove("hidden");
    els.hTitle.textContent = `${visible.length} alerte${visible.length > 1 ? "s" : ""}`;
    els.clearAll.textContent = c.clear_all_label || "Tout effacer";
    els.clearAll.classList.toggle("hidden", visible.length < 2);

    for (const al of visible.slice(0, max)) {
      els.list.appendChild(this._row(al, { dismissible: true }));
    }
  }

  /* ----------------------------- actions ----------------------------- */

  _toggle(open) {
    this._expanded = open;
    this._update();
  }

  _dismiss(id) {
    const h = this._config.snooze_hours;
    this._dismissed.set(id, h ? Date.now() + h * 3600 * 1000 : null);
    this._saveDismissed();
    this._update();
  }

  _clearAll() {
    const h = this._config.snooze_hours;
    const until = h ? Date.now() + h * 3600 * 1000 : null;
    for (const al of this._alerts()) this._dismissed.set(al.id, until);
    this._saveDismissed();
    this._expanded = false;
    this._update();
  }
}

if (!customElements.get("serenity-alerts-card")) {
  customElements.define("serenity-alerts-card", SerenityAlertsCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "serenity-alerts-card",
  name: "Serenity Alerts",
  description:
    "Notification centre: stacked alerts, expandable list, per-alert dismiss with persistence and clear-all.",
  preview: true,
  documentationURL: "https://github.com/your-username/serenity-cards",
});

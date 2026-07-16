import { DEFAULTS } from "./const.js";
import { cardStyles } from "./styles.js";
import { lerpColor, chevron, valueAt, bucketize } from "./utils.js";

/**
 * Shared logic for all Serenity sensor cards. A subclass only needs to set
 * `static cardType = "temperature" | "humidity"`.
 */
export class SerenitySensorCardBase extends HTMLElement {
  static cardType = "temperature";

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
    this._history = [];
    this._historyTs = 0;
    this._fetching = false;
    this._refreshTimer = null;
  }

  get _type() {
    return this.constructor.cardType;
  }
  get _def() {
    return DEFAULTS[this._type];
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    const d = this._def;
    this._config = {
      hours: 12, // history window for the bars
      bars: 24, // number of bars
      trend_hours: 3, // lookback used for the trend number
      decimals: 1, // rounding of the main value
      icon: d.icon,
      ...config,
    };
    this._history = [];
    this._historyTs = 0;
    if (this._built) {
      this._applyTypeVars();
      this._applyCompact();
      this._update();
      this._maybeFetchHistory(true);
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.isConnected) return;
    this._ensureBuilt();
    this._update();
    this._maybeFetchHistory();
  }

  connectedCallback() {
    this._ensureBuilt();
    if (this._hass) {
      this._update();
      this._maybeFetchHistory();
    }
    this._refreshTimer = window.setInterval(
      () => this._maybeFetchHistory(true),
      5 * 60 * 1000
    );
  }

  disconnectedCallback() {
    if (this._refreshTimer) {
      window.clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
  }

  _applyCompact() {
    const card = this.shadowRoot && this.shadowRoot.querySelector("ha-card");
    if (card) card.classList.toggle("compact", !!(this._config && this._config.compact));
  }

  getGridOptions() {
    if (this._config && this._config.compact === true) {
      return { columns: 6, rows: "auto", min_columns: 3 };
    }
    return { columns: 12, rows: "auto" };
  }

  getCardSize() {
    return 2;
  }

  static getStubConfig(hass) {
    const dc = this.cardType;
    let entity = "";
    if (hass && hass.states) {
      entity =
        Object.keys(hass.states).find(
          (e) =>
            e.startsWith("sensor.") &&
            hass.states[e].attributes.device_class === dc
        ) || "";
    }
    return { entity };
  }

  /* ----------------------------- DOM build ----------------------------- */

  _ensureBuilt() {
    if (this._built) return;
    const root = this.shadowRoot;

    const style = document.createElement("style");
    style.textContent = cardStyles(this._type);
    root.appendChild(style);

    const card = document.createElement("ha-card");
    card.innerHTML = `
      <div class="serenity">
        <div class="icon-box"><ha-icon></ha-icon></div>
        <div class="title-block">
          <div class="name"></div>
          <div class="status"><span class="dot"></span><span class="status-text"></span></div>
        </div>
        <div class="chart"></div>
        <div class="value-block">
          <div class="value"><span class="num"></span><span class="unit"></span></div>
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

    this._els = {
      card,
      icon: root.querySelector("ha-icon"),
      name: root.querySelector(".name"),
      dot: root.querySelector(".dot"),
      statusText: root.querySelector(".status-text"),
      chart: root.querySelector(".chart"),
      num: root.querySelector(".num"),
      unit: root.querySelector(".unit"),
      sub: root.querySelector(".sub"),
    };

    this.addEventListener("click", () => this._handleTap());

    this._built = true;
    this._applyCompact();
    this._applyTypeVars();
  }

  _applyTypeVars() {
    const c = this._config || {};
    const d = this._def;
    const set = (k, v) => this.style.setProperty(k, v);
    if (c.accent) set("--_accent", c.accent);
    if (c.soft) set("--_soft", c.soft);
    // when no per-card override, the stylesheet's theme-var fallbacks apply
    void d;
  }

  /* --------------------------- live updates --------------------------- */

  _update() {
    if (!this._built || !this._config) return;
    const els = this._els;
    const d = this._def;
    const cfg = this._config;

    els.icon.setAttribute("icon", cfg.icon || d.icon);

    const st = this._hass ? this._hass.states[cfg.entity] : null;

    const name =
      cfg.name ||
      (st && st.attributes.friendly_name) ||
      (cfg.entity ? cfg.entity.split(".").pop().replace(/_/g, " ") : "Sensor");
    els.name.textContent = name;

    if (
      !cfg.entity ||
      !st ||
      st.state === "unavailable" ||
      st.state === "unknown"
    ) {
      els.card.classList.add("unavailable");
      els.num.textContent = "\u2014";
      els.unit.textContent = "";
      els.statusText.textContent = cfg.entity ? "Unavailable" : "Set an entity";
      els.dot.style.background = "var(--_muted)";
      els.sub.innerHTML = "";
      return;
    }
    els.card.classList.remove("unavailable");

    const value = parseFloat(st.state);
    const unit =
      cfg.unit || st.attributes.unit_of_measurement || d.fallbackUnit;

    if (isNaN(value)) {
      els.num.textContent = st.state;
      els.unit.textContent = "";
    } else {
      els.num.textContent = value.toFixed(cfg.decimals);
      els.unit.textContent = unit;
    }

    const status = this._statusFor(value);
    els.statusText.textContent = status.label;
    els.dot.style.background = status.color;

    els.sub.innerHTML = this._buildSubHtml(value);
  }

  _statusFor(value) {
    const list = (
      this._config.thresholds && this._config.thresholds.length
        ? this._config.thresholds
        : this._def.thresholds
    )
      .slice()
      .sort((a, b) => a.value - b.value);
    let chosen = list[0];
    for (const t of list) if (value >= t.value) chosen = t;
    return { label: chosen.label, color: chosen.color || "var(--_accent)" };
  }

  _buildSubHtml(currentValue) {
    const cfg = this._config;
    const d = this._def;
    const parts = [];

    if (!isNaN(currentValue) && this._history.length) {
      const target = Date.now() - cfg.trend_hours * 3600 * 1000;
      const past = valueAt(this._history, target);
      if (past != null) {
        const delta = currentValue - past;
        const mag = Math.abs(delta).toFixed(cfg.decimals);
        const tUnit = cfg.trend_unit || d.trendUnit;
        const dir =
          parseFloat(mag) === 0 ? "flat" : delta > 0 ? "up" : "down";
        parts.push(`${chevron(dir)}<span>${mag}${tUnit}</span>`);
      }
    }

    if (cfg.secondary_entity && this._hass) {
      const sec = this._hass.states[cfg.secondary_entity];
      if (sec && !isNaN(parseFloat(sec.state))) {
        const sv = parseFloat(sec.state).toFixed(cfg.secondary_decimals ?? 1);
        const su =
          cfg.secondary_unit ?? sec.attributes.unit_of_measurement ?? "";
        const glue = /^[%\u00B0]/.test(su) || su === "" ? "" : " ";
        if (parts.length) parts.push(`<span class="sep">\u00B7</span>`);
        parts.push(`<span>${sv}${glue}${su}</span>`);
      }
    }

    return parts.join("");
  }

  _handleTap() {
    if (!this._config || !this._config.entity) return;
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId: this._config.entity },
        bubbles: true,
        composed: true,
      })
    );
  }

  /* ----------------------------- history ----------------------------- */

  async _maybeFetchHistory(force = false) {
    if (!this._hass || !this._config || !this._config.entity) return;
    if (this._fetching) return;
    const now = Date.now();
    if (!force && this._historyTs && now - this._historyTs < 120000) return;
    this._fetching = true;
    try {
      const cfg = this._config;
      const windowHours = Math.max(cfg.hours, cfg.trend_hours);
      const start = new Date(now - windowHours * 3600 * 1000).toISOString();
      const end = new Date(now).toISOString();
      const res = await this._hass.callWS({
        type: "history/history_during_period",
        start_time: start,
        end_time: end,
        entity_ids: [cfg.entity],
        minimal_response: true,
        no_attributes: true,
      });
      const series = (res && res[cfg.entity]) || [];
      this._history = series
        .map((p) => ({
          t:
            p.lu != null
              ? p.lu * 1000
              : p.last_updated
              ? Date.parse(p.last_updated)
              : p.last_changed
              ? Date.parse(p.last_changed)
              : now,
          v: parseFloat(p.s != null ? p.s : p.state),
        }))
        .filter((p) => !isNaN(p.v))
        .sort((a, b) => a.t - b.t);
      this._historyTs = now;
      this._renderChart();
      this._update();
    } catch (e) {
      this._renderChart();
    } finally {
      this._fetching = false;
    }
  }

  _renderChart() {
    if (!this._built) return;
    const chart = this._els.chart;
    const cfg = this._config;
    const d = this._def;
    const n = Math.max(4, cfg.bars);
    const startTs = Date.now() - cfg.hours * 3600 * 1000;
    const vals = bucketize(this._history, n, startTs);
    chart.innerHTML = "";

    if (!vals.length) {
      for (let i = 0; i < n; i++) {
        const bar = document.createElement("div");
        bar.className = "bar";
        bar.style.height = "16%";
        bar.style.opacity = "0.35";
        bar.style.background = cfg.bar_low || d.barLow;
        chart.appendChild(bar);
      }
      return;
    }

    const lo = cfg.min != null ? cfg.min : Math.min(...vals);
    const hi = cfg.max != null ? cfg.max : Math.max(...vals);
    const range = hi - lo || 1;
    const low = cfg.bar_low || d.barLow;
    const high = cfg.bar_high || d.barHigh;

    for (const v of vals) {
      const norm = Math.min(1, Math.max(0, (v - lo) / range));
      const bar = document.createElement("div");
      bar.className = "bar";
      bar.style.height = (18 + norm * 82).toFixed(1) + "%";
      bar.style.background = lerpColor(low, high, norm);
      chart.appendChild(bar);
    }
  }
}

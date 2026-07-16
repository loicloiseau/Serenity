/**
 * Serenity Graph Card — custom:serenity-graph-card
 *
 * A smooth history curve for numeric sensors. Single entity:
 *   { entity, name, icon, accent, hours, unit, decimals }
 * Multi-series with selector chips (one chart, tap a chip to switch):
 *   { entities: [{entity, name, accent, icon?}], hours, decimals }
 * History is fetched per series over the recorder WS API and cached.
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

const W = 300; // viewBox width
const H = 80; // viewBox height
const PAD = 6; // vertical padding inside the chart
const DEFAULT_ACCENTS = ["#3F9E6B", "#E0813F", "#5B9BF5", "#8B6FD0", "#3FA597", "#D267A0"];

/** Piecewise cubic through the points, horizontal-tangent style (smooth). */
function smoothPath(pts) {
  if (!pts.length) return "";
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const mx = (p0.x + p1.x) / 2;
    d += ` C ${mx.toFixed(1)} ${p0.y.toFixed(1)}, ${mx.toFixed(1)} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }
  return d;
}

let GRAD_SEQ = 0;

export class SerenityGraphCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
    this._cache = {}; // entity -> {data: [{t,v}], ts}
    this._fetching = false;
    this._sel = 0;
    this._timer = null;
    this._gradId = `sgc-grad-${++GRAD_SEQ}`;
  }

  setConfig(config) {
    if (!config || (!config.entity && !Array.isArray(config.entities))) {
      throw new Error("You must define entity or entities");
    }
    this._config = { hours: 24, decimals: 1, ...config };
    // Normalise both forms into a series list.
    const raw = Array.isArray(config.entities)
      ? config.entities
      : [{ entity: config.entity, name: config.name, accent: config.accent, icon: config.icon }];
    this._series = raw
      .map((s, i) =>
        typeof s === "string"
          ? { entity: s, accent: DEFAULT_ACCENTS[i % DEFAULT_ACCENTS.length] }
          : { accent: DEFAULT_ACCENTS[i % DEFAULT_ACCENTS.length], ...s }
      )
      .filter((s) => s.entity);
    this._sel = 0;
    this._cache = {};
    if (this._built) {
      this._buildTabs();
      this._update();
      this._maybeFetch(true);
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.isConnected) return;
    this._ensureBuilt();
    this._update();
    this._maybeFetch();
  }

  connectedCallback() {
    this._ensureBuilt();
    if (this._hass) {
      this._update();
      this._maybeFetch();
    }
    this._timer = window.setInterval(() => this._maybeFetch(true), 5 * 60 * 1000);
  }

  disconnectedCallback() {
    if (this._timer) {
      window.clearInterval(this._timer);
      this._timer = null;
    }
  }

  getCardSize() {
    return 3;
  }

  static getStubConfig(hass) {
    let entity = "";
    if (hass && hass.states) {
      entity =
        Object.keys(hass.states).find(
          (e) => e.startsWith("sensor.") && !isNaN(parseFloat(hass.states[e].state))
        ) || "";
    }
    return { entity };
  }

  _cur() {
    return this._series[this._sel] || this._series[0];
  }

  _ensureBuilt() {
    if (this._built) return;
    const root = this.shadowRoot;

    const style = document.createElement("style");
    style.textContent = this._css();
    root.appendChild(style);

    const card = document.createElement("ha-card");
    card.innerHTML = `
      <div class="head">
        <div class="left">
          <div class="icon-box"><ha-icon></ha-icon></div>
          <div class="txt">
            <div class="name"></div>
            <div class="range"></div>
          </div>
        </div>
        <div class="value"><span class="num">—</span><span class="unit"></span></div>
      </div>
      <div class="tabs hidden"></div>
      <svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="${this._gradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" class="g-top"></stop>
            <stop offset="100%" class="g-bot"></stop>
          </linearGradient>
        </defs>
        <path class="area" fill="url(#${this._gradId})"></path>
        <path class="line" fill="none"></path>
      </svg>
      <div class="foot">
        <span class="mm min"></span>
        <span class="mm max"></span>
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
      icon: $(".icon-box ha-icon"),
      iconBox: $(".icon-box"),
      name: $(".name"),
      range: $(".range"),
      num: $(".num"),
      unit: $(".unit"),
      tabs: $(".tabs"),
      chart: $(".chart"),
      area: $(".area"),
      line: $(".line"),
      gTop: $(".g-top"),
      gBot: $(".g-bot"),
      min: $(".mm.min"),
      max: $(".mm.max"),
    };

    this._els.head = root.querySelector(".head");
    this._els.head.style.cursor = "pointer";
    this._els.head.addEventListener("click", () => this._moreInfo());
    this._built = true;
    this._buildTabs();
  }

  _css() {
    return `
      :host {
        --_accent: #3F9E6B;
        --_value: var(--serenity-value-color, var(--primary-text-color, #16201b));
        --_muted: var(--serenity-muted-color, var(--secondary-text-color, #9aa3af));
        --_plate: var(--serenity-tile-plate, rgba(120, 130, 138, 0.10));
        --_font: var(--serenity-header-font, "Inter", "Roboto", system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif);
        display: block;
        font-family: var(--_font);
      }
      ha-card { padding: 13px 14px 10px; overflow: hidden; }
      .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .left { display: flex; align-items: center; gap: 11px; min-width: 0; }
      .icon-box {
        flex: 0 0 auto; width: 38px; height: 38px; border-radius: 12px;
        background: var(--_soft2, var(--_plate));
        display: flex; align-items: center; justify-content: center;
      }
      .icon-box ha-icon { --mdc-icon-size: 20px; color: var(--_accent); }
      .txt { min-width: 0; }
      .name { font-size: 15px; font-weight: 700; letter-spacing: -0.2px; color: var(--_value);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .range { margin-top: 2px; font-size: 12px; font-weight: 500; color: var(--_muted); }
      .value { display: flex; align-items: flex-start; line-height: 1; flex: 0 0 auto; }
      .num { font-size: 24px; font-weight: 800; letter-spacing: -0.6px; color: var(--_value); }
      .unit { font-size: 13px; font-weight: 700; color: var(--_muted); margin-left: 2px; margin-top: 2px; }
      .tabs { display: flex; gap: 6px; margin-top: 10px; overflow-x: auto; scrollbar-width: none; }
      .tabs::-webkit-scrollbar { display: none; }
      .tabs.hidden { display: none; }
      .tab {
        flex: 0 0 auto; border: none; cursor: pointer; font-family: inherit;
        padding: 5px 12px; border-radius: 999px; background: var(--_plate);
        font-size: 12px; font-weight: 600; color: var(--_muted);
        transition: background 0.15s ease, color 0.15s ease;
      }
      .tab.active { background: var(--t-soft); color: var(--t-accent); }
      .chart { width: 100%; height: 78px; display: block; margin-top: 10px; }
      .chart.loading {
        border-radius: 10px;
        background: linear-gradient(90deg, var(--_plate) 25%, rgba(120, 130, 138, 0.18) 50%, var(--_plate) 75%);
        background-size: 200% 100%;
        animation: shimmer 1.2s linear infinite;
      }
      @keyframes shimmer { to { background-position: -200% 0; } }
      .line { stroke: var(--_accent); stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round;
        vector-effect: non-scaling-stroke; transition: d 0.3s ease; }
      .foot { display: flex; justify-content: space-between; margin-top: 6px; }
      .mm { font-size: 11.5px; font-weight: 600; color: var(--_muted); }
    `;
  }

  _buildTabs() {
    if (!this._built) return;
    const tabs = this._els.tabs;
    tabs.textContent = "";
    tabs.classList.toggle("hidden", this._series.length < 2);
    if (this._series.length < 2) return;
    this._series.forEach((s, i) => {
      const b = document.createElement("button");
      b.className = "tab" + (i === this._sel ? " active" : "");
      b.style.setProperty("--t-accent", s.accent);
      b.style.setProperty("--t-soft", hexToRgba(s.accent, 0.14));
      b.textContent = s.name || s.entity.split(".")[1];
      b.addEventListener("click", () => {
        this._sel = i;
        for (const el of tabs.children) el.classList.remove("active");
        b.classList.add("active");
        this._update();
        this._maybeFetch();
      });
      tabs.appendChild(b);
    });
  }

  async _maybeFetch(force = false) {
    if (!this._hass || !this._config || this._fetching) return;
    const cur = this._cur();
    if (!cur) return;
    const now = Date.now();
    const cached = this._cache[cur.entity];
    if (!force && cached && now - cached.ts < 120000) return;
    if (force && cached && now - cached.ts < 15000) return;
    this._fetching = true;
    try {
      const hours = this._config.hours || 24;
      const res = await this._hass.callWS({
        type: "history/history_during_period",
        start_time: new Date(now - hours * 3600 * 1000).toISOString(),
        end_time: new Date(now).toISOString(),
        entity_ids: [cur.entity],
        minimal_response: true,
        no_attributes: true,
      });
      const series = (res && res[cur.entity]) || [];
      const data = series
        .map((p) => ({
          t:
            p.lu != null
              ? p.lu * 1000
              : Date.parse(p.last_updated || p.last_changed || 0),
          v: parseFloat(p.s != null ? p.s : p.state),
        }))
        .filter((p) => !isNaN(p.v))
        .sort((a, b) => a.t - b.t);
      this._cache[cur.entity] = { data, ts: now };
    } catch (e) {
      /* recorder unavailable — keep last data */
    }
    this._fetching = false;
    this._render();
  }

  _update() {
    if (!this._built || !this._config || !this._hass) return;
    const c = this._config;
    const els = this._els;
    const cur = this._cur();
    if (!cur) return;
    const st = this._hass.states[cur.entity];

    els.name.textContent =
      cur.name || (st && st.attributes.friendly_name) || cur.entity;
    els.icon.setAttribute(
      "icon",
      cur.icon || (st && st.attributes.icon) || "mdi:chart-bell-curve-cumulative"
    );
    els.range.textContent = `Dernières ${c.hours || 24} h`;

    const accent = cur.accent || "#3F9E6B";
    this.style.setProperty("--_accent", accent);
    this.style.setProperty("--_soft2", hexToRgba(accent, 0.14));
    els.gTop.setAttribute("stop-color", hexToRgba(accent, 0.22));
    els.gBot.setAttribute("stop-color", hexToRgba(accent, 0));

    const unit =
      cur.unit || c.unit || (st && st.attributes.unit_of_measurement) || "";
    els.unit.textContent = unit;
    const v = st ? parseFloat(st.state) : NaN;
    els.num.textContent = isNaN(v) ? "—" : v.toFixed(c.decimals);

    this._render();
  }

  _render() {
    if (!this._built) return;
    const els = this._els;
    const cur = this._cur();
    const cached = cur && this._cache[cur.entity];
    const data = cached && cached.data;

    if (!data || data.length < 2) {
      els.chart.classList.add("loading");
      els.area.setAttribute("d", "");
      els.line.setAttribute("d", "");
      els.min.textContent = "";
      els.max.textContent = "";
      return;
    }
    els.chart.classList.remove("loading");

    // Downsample to ~60 buckets for a clean curve.
    const buckets = 60;
    const t0 = data[0].t;
    const t1 = data[data.length - 1].t;
    const span = Math.max(1, t1 - t0);
    const sums = new Array(buckets).fill(0);
    const counts = new Array(buckets).fill(0);
    for (const p of data) {
      const i = Math.min(buckets - 1, Math.floor(((p.t - t0) / span) * buckets));
      sums[i] += p.v;
      counts[i]++;
    }
    const vals = [];
    let last = data[0].v;
    for (let i = 0; i < buckets; i++) {
      if (counts[i]) last = sums[i] / counts[i];
      vals.push(last);
    }

    let min = Math.min(...vals);
    let max = Math.max(...vals);
    if (max - min < 0.001) {
      max += 0.5;
      min -= 0.5;
    }
    const pts = vals.map((v, i) => ({
      x: (i / (buckets - 1)) * W,
      y: PAD + (1 - (v - min) / (max - min)) * (H - 2 * PAD),
    }));

    const line = smoothPath(pts);
    els.line.setAttribute("d", line);
    els.area.setAttribute("d", `${line} L ${W} ${H} L 0 ${H} Z`);

    const dec = this._config.decimals != null ? this._config.decimals : 1;
    const st = this._hass && this._hass.states[cur.entity];
    const unit =
      cur.unit ||
      this._config.unit ||
      (st && st.attributes.unit_of_measurement) ||
      "";
    els.min.textContent = `min ${min.toFixed(dec)}${unit}`;
    els.max.textContent = `max ${max.toFixed(dec)}${unit}`;
  }

  _moreInfo() {
    const cur = this._cur();
    if (!cur) return;
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId: cur.entity },
        bubbles: true,
        composed: true,
      })
    );
  }
}

if (!customElements.get("serenity-graph-card")) {
  customElements.define("serenity-graph-card", SerenityGraphCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "serenity-graph-card",
  name: "Serenity Graph",
  description:
    "Smooth gradient history curve with optional multi-sensor selector chips.",
  preview: true,
  documentationURL: "https://github.com/your-username/serenity-cards",
});

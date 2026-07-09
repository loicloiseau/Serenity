/**
 * Serenity Graph Card — custom:serenity-graph-card
 *
 * A smooth history curve for any numeric sensor (temperature, power…):
 * icon plate, name, the current value large on the right and a soft
 * gradient area chart of the last N hours with min/max in the footer.
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
    this._history = [];
    this._historyTs = 0;
    this._fetching = false;
    this._timer = null;
    this._gradId = `sgc-grad-${++GRAD_SEQ}`;
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("You must define a sensor entity");
    }
    this._config = { hours: 24, decimals: 1, ...config };
    this._history = [];
    this._historyTs = 0;
    if (this._built) {
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

    const $ = (s) => root.querySelector(s);
    this._els = {
      card,
      icon: $(".icon-box ha-icon"),
      name: $(".name"),
      range: $(".range"),
      num: $(".num"),
      unit: $(".unit"),
      area: $(".area"),
      line: $(".line"),
      gTop: $(".g-top"),
      gBot: $(".g-bot"),
      min: $(".mm.min"),
      max: $(".mm.max"),
    };

    card.addEventListener("click", () => this._moreInfo());
    this._built = true;
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
      ha-card { padding: 13px 14px 10px; cursor: pointer; overflow: hidden; }
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
      .chart { width: 100%; height: 78px; display: block; margin-top: 10px; }
      .line { stroke: var(--_accent); stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round;
        vector-effect: non-scaling-stroke; }
      .foot { display: flex; justify-content: space-between; margin-top: 6px; }
      .mm { font-size: 11.5px; font-weight: 600; color: var(--_muted); }
    `;
  }

  async _maybeFetch(force = false) {
    if (!this._hass || !this._config || this._fetching) return;
    const now = Date.now();
    if (!force && this._historyTs && now - this._historyTs < 120000) return;
    this._fetching = true;
    try {
      const hours = this._config.hours || 24;
      const res = await this._hass.callWS({
        type: "history/history_during_period",
        start_time: new Date(now - hours * 3600 * 1000).toISOString(),
        end_time: new Date(now).toISOString(),
        entity_ids: [this._config.entity],
        minimal_response: true,
        no_attributes: true,
      });
      const series = (res && res[this._config.entity]) || [];
      this._history = series
        .map((p) => ({
          t:
            p.lu != null
              ? p.lu * 1000
              : Date.parse(p.last_updated || p.last_changed || 0),
          v: parseFloat(p.s != null ? p.s : p.state),
        }))
        .filter((p) => !isNaN(p.v))
        .sort((a, b) => a.t - b.t);
      this._historyTs = now;
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
    const st = this._hass.states[c.entity];

    els.name.textContent =
      c.name || (st && st.attributes.friendly_name) || c.entity;
    els.icon.setAttribute(
      "icon",
      c.icon || (st && st.attributes.icon) || "mdi:chart-bell-curve-cumulative"
    );
    els.range.textContent = `Dernières ${c.hours || 24} h`;

    const accent = c.accent || "#3F9E6B";
    this.style.setProperty("--_accent", accent);
    this.style.setProperty("--_soft2", hexToRgba(accent, 0.14));
    els.gTop.setAttribute("stop-color", hexToRgba(accent, 0.22));
    els.gBot.setAttribute("stop-color", hexToRgba(accent, 0));

    const unit =
      c.unit || (st && st.attributes.unit_of_measurement) || "";
    els.unit.textContent = unit;
    const v = st ? parseFloat(st.state) : NaN;
    els.num.textContent = isNaN(v) ? "—" : v.toFixed(c.decimals);

    this._render();
  }

  _render() {
    if (!this._built) return;
    const els = this._els;
    const data = this._history;
    if (!data || data.length < 2) {
      els.area.setAttribute("d", "");
      els.line.setAttribute("d", "");
      els.min.textContent = "";
      els.max.textContent = "";
      return;
    }

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
    els.area.setAttribute(
      "d",
      `${line} L ${W} ${H} L 0 ${H} Z`
    );

    const dec = this._config.decimals != null ? this._config.decimals : 1;
    const unit =
      this._config.unit ||
      (this._hass &&
        this._hass.states[this._config.entity] &&
        this._hass.states[this._config.entity].attributes.unit_of_measurement) ||
      "";
    els.min.textContent = `min ${min.toFixed(dec)}${unit}`;
    els.max.textContent = `max ${max.toFixed(dec)}${unit}`;
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

if (!customElements.get("serenity-graph-card")) {
  customElements.define("serenity-graph-card", SerenityGraphCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "serenity-graph-card",
  name: "Serenity Graph",
  description:
    "Smooth gradient history curve for any numeric sensor, with current value and min/max.",
  preview: true,
  documentationURL: "https://github.com/your-username/serenity-cards",
});

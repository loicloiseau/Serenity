/**
 * Serenity Weather Card — custom:serenity-weather-card
 *
 * Current conditions in the Serenity style: icon plate, temperature,
 * French condition label, humidity/wind chips and an optional 5-day
 * forecast row (fetched via weather.get_forecasts, cached 30 min).
 * Tapping the card slides up a detailed forecast sheet
 * (sheet: false restores the native more-info).
 */

import { SHEET_CSS, createSheet } from "../sheet.js";

const CONDITIONS = {
  "clear-night": { label: "Nuit claire", icon: "mdi:weather-night", color: "#8B6FD0" },
  cloudy: { label: "Nuageux", icon: "mdi:weather-cloudy", color: "#8AA0B8" },
  fog: { label: "Brouillard", icon: "mdi:weather-fog", color: "#8AA0B8" },
  hail: { label: "Grêle", icon: "mdi:weather-hail", color: "#5B9BF5" },
  lightning: { label: "Orages", icon: "mdi:weather-lightning", color: "#E0A95B" },
  "lightning-rainy": { label: "Orages", icon: "mdi:weather-lightning-rainy", color: "#E0A95B" },
  partlycloudy: { label: "Partiellement nuageux", icon: "mdi:weather-partly-cloudy", color: "#5B9BF5" },
  pouring: { label: "Forte pluie", icon: "mdi:weather-pouring", color: "#5B9BF5" },
  rainy: { label: "Pluie", icon: "mdi:weather-rainy", color: "#5B9BF5" },
  snowy: { label: "Neige", icon: "mdi:weather-snowy", color: "#7FB6D9" },
  "snowy-rainy": { label: "Neige fondue", icon: "mdi:weather-snowy-rainy", color: "#7FB6D9" },
  sunny: { label: "Ensoleillé", icon: "mdi:weather-sunny", color: "#E2B33C" },
  windy: { label: "Venteux", icon: "mdi:weather-windy", color: "#8AA0B8" },
  "windy-variant": { label: "Venteux", icon: "mdi:weather-windy-variant", color: "#8AA0B8" },
  exceptional: { label: "Exceptionnel", icon: "mdi:alert-outline", color: "#E06B5B" },
};

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

export class SerenityWeatherCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
    this._forecast = [];
    this._fcTs = 0;
    this._fetching = false;
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("You must define a weather entity");
    }
    this._config = { ...config };
    this._forecast = [];
    this._fcTs = 0;
    if (this._built) this._update();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.isConnected) return;
    this._ensureBuilt();
    this._update();
    this._maybeFetchForecast();
  }

  connectedCallback() {
    this._ensureBuilt();
    if (this._hass) {
      this._update();
      this._maybeFetchForecast();
    }
  }

  getCardSize() {
    return 3;
  }

  static getStubConfig(hass) {
    let entity = "";
    if (hass && hass.states) {
      entity =
        Object.keys(hass.states).find((e) => e.startsWith("weather.")) || "";
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
            <div class="temp"><span class="t-num">—</span><span class="t-unit">°C</span></div>
            <div class="cond"></div>
          </div>
        </div>
        <div class="chips">
          <span class="chip hum"><ha-icon icon="mdi:water-percent"></ha-icon><span class="c-txt"></span></span>
          <span class="chip wind"><ha-icon icon="mdi:weather-windy"></ha-icon><span class="c-txt"></span></span>
        </div>
      </div>
      <div class="forecast hidden"></div>`;
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
      tNum: $(".t-num"),
      tUnit: $(".t-unit"),
      cond: $(".cond"),
      hum: $(".chip.hum"),
      humTxt: $(".chip.hum .c-txt"),
      wind: $(".chip.wind"),
      windTxt: $(".chip.wind .c-txt"),
      forecast: $(".forecast"),
    };

    card.addEventListener("click", () => {
      if (this._config && this._config.sheet === false) this._moreInfo();
      else this._openSheet();
    });
    this._sheet = createSheet(root);
    this._built = true;
  }

  _css() {
    return `
      :host {
        --_accent: #5B9BF5;
        --_value: var(--serenity-value-color, var(--primary-text-color, #16201b));
        --_muted: var(--serenity-muted-color, var(--secondary-text-color, #9aa3af));
        --_plate: var(--serenity-tile-plate, rgba(120, 130, 138, 0.10));
        --_font: var(--serenity-header-font, "Inter", "Roboto", system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif);
        display: block;
        font-family: var(--_font);
      }
      ha-card { padding: 14px 16px; cursor: pointer; overflow: hidden; }
      .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .left { display: flex; align-items: center; gap: 13px; min-width: 0; }
      .icon-box {
        flex: 0 0 auto; width: 46px; height: 46px; border-radius: 14px;
        background: var(--_soft, var(--_plate));
        display: flex; align-items: center; justify-content: center;
      }
      .icon-box ha-icon { --mdc-icon-size: 26px; color: var(--_accent); }
      .txt { min-width: 0; }
      .temp { display: flex; align-items: flex-start; line-height: 1; color: var(--_value); }
      .t-num { font-size: 28px; font-weight: 800; letter-spacing: -0.8px; }
      .t-unit { font-size: 14px; font-weight: 700; color: var(--_muted); margin-left: 2px; margin-top: 2px; }
      .cond { margin-top: 3px; font-size: 13px; font-weight: 500; color: var(--_muted);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .chips { display: flex; flex-direction: column; gap: 6px; flex: 0 0 auto; align-items: flex-end; }
      .chip {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 5px 10px; border-radius: 999px; background: var(--_plate);
        font-size: 12px; font-weight: 600; color: var(--_value); line-height: 1;
      }
      .chip ha-icon { --mdc-icon-size: 14px; color: var(--_muted); }
      .forecast {
        display: grid; grid-auto-flow: column; grid-auto-columns: 1fr;
        gap: 6px; margin-top: 14px; padding-top: 12px;
        border-top: 1px solid var(--divider-color, rgba(120, 130, 138, 0.18));
      }
      .forecast.hidden { display: none; }
      .day { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; }
      .d-name { font-size: 11px; font-weight: 600; color: var(--_muted); text-transform: capitalize; }
      .day ha-icon { --mdc-icon-size: 19px; }
      .d-hi { font-size: 12.5px; font-weight: 700; color: var(--_value); }
      .d-lo { font-size: 11px; font-weight: 500; color: var(--_muted); }
      ${SHEET_CSS}
      .f-row {
        display: flex; align-items: center; gap: 12px;
        padding: 11px 12px; border-radius: 14px;
      }
      .f-row ha-icon { --mdc-icon-size: 22px; flex: 0 0 auto; }
      .f-day { flex: 0 0 auto; width: 74px; font-size: 13.5px; font-weight: 700;
        color: var(--_value); text-transform: capitalize; }
      .f-cond { flex: 1 1 auto; min-width: 0; font-size: 12.5px; font-weight: 500;
        color: var(--_muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .f-rain { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 3px;
        font-size: 12px; font-weight: 600; color: #5B9BF5; }
      .f-rain ha-icon { --mdc-icon-size: 13px; color: #5B9BF5; }
      .f-temps { flex: 0 0 auto; min-width: 74px; text-align: right;
        font-size: 13.5px; font-variant-numeric: tabular-nums; }
      .f-temps .lo { font-weight: 500; color: var(--_muted); }
      .f-temps .hi { font-weight: 800; color: var(--_value); }
      .f-empty { padding: 14px 12px; font-size: 13px; color: var(--_muted); }
    `;
  }

  _update() {
    if (!this._built || !this._config || !this._hass) return;
    const c = this._config;
    const els = this._els;
    const st = this._hass.states[c.entity];

    if (!st || st.state === "unavailable") {
      els.tNum.textContent = "—";
      els.cond.textContent = "Indisponible";
      return;
    }

    const a = st.attributes;
    const meta =
      CONDITIONS[st.state] ||
      { label: st.state, icon: "mdi:weather-partly-cloudy", color: "#5B9BF5" };

    els.icon.setAttribute("icon", meta.icon);
    this.style.setProperty("--_accent", meta.color);
    this.style.setProperty("--_soft", hexToRgba(meta.color, 0.14));

    const t = a.temperature;
    els.tNum.textContent = t != null ? Math.round(t * 10) / 10 : "—";
    els.tUnit.textContent = a.temperature_unit || "°C";
    els.cond.textContent = c.name
      ? `${meta.label} · ${c.name}`
      : meta.label;

    els.hum.style.display = a.humidity != null ? "" : "none";
    if (a.humidity != null) els.humTxt.textContent = `${Math.round(a.humidity)}%`;
    els.wind.style.display = a.wind_speed != null ? "" : "none";
    if (a.wind_speed != null) {
      els.windTxt.textContent = `${Math.round(a.wind_speed * 10) / 10} ${a.wind_speed_unit || "km/h"}`;
    }
  }

  async _maybeFetchForecast(force = false) {
    if (!this._hass || !this._config) return;
    if (!force && this._config.show_forecast === false) return;
    const now = Date.now();
    if (this._fetching || now - this._fcTs < 30 * 60 * 1000) return;
    this._fetching = true;
    const days = this._config.forecast_days || 5;
    try {
      const r = await this._hass.callWS({
        type: "call_service",
        domain: "weather",
        service: "get_forecasts",
        service_data: { type: "daily" },
        target: { entity_id: this._config.entity },
        return_response: true,
      });
      const resp = (r && (r.response || r)) || {};
      const f = resp[this._config.entity] && resp[this._config.entity].forecast;
      this._forecast = Array.isArray(f) ? f.slice(0, days) : [];
    } catch (e) {
      const st = this._hass.states[this._config.entity];
      this._forecast = ((st && st.attributes.forecast) || []).slice(0, days);
    }
    this._fcTs = now;
    this._fetching = false;
    this._renderForecast();
    this._renderSheet();
  }

  _renderForecast() {
    const els = this._els;
    const list = this._forecast;
    els.forecast.classList.toggle(
      "hidden",
      this._config.show_forecast === false || !list || list.length === 0
    );
    if (this._config.show_forecast === false || !list || !list.length) return;
    els.forecast.textContent = "";
    for (const f of list) {
      const meta =
        CONDITIONS[f.condition] ||
        { icon: "mdi:weather-partly-cloudy", color: "#5B9BF5" };
      const day = document.createElement("div");
      day.className = "day";
      const name = document.createElement("div");
      name.className = "d-name";
      name.textContent = new Date(f.datetime).toLocaleDateString("fr-FR", {
        weekday: "short",
      });
      const ico = document.createElement("ha-icon");
      ico.setAttribute("icon", meta.icon);
      ico.style.color = meta.color;
      const hi = document.createElement("div");
      hi.className = "d-hi";
      hi.textContent =
        f.temperature != null ? `${Math.round(f.temperature)}°` : "—";
      const lo = document.createElement("div");
      lo.className = "d-lo";
      lo.textContent =
        f.templow != null ? `${Math.round(f.templow)}°` : "";
      day.append(name, ico, hi, lo);
      els.forecast.appendChild(day);
    }
  }

  _openSheet() {
    const st = this._hass && this._hass.states[this._config.entity];
    const name =
      this._config.name ||
      (st && st.attributes.friendly_name) ||
      "Météo";
    this._sheet.title.textContent = `Prévisions · ${name}`;
    this._renderSheet();
    this._maybeFetchForecast(true);
    this._sheet.open();
  }

  _renderSheet() {
    if (!this._sheet) return;
    const body = this._sheet.body;
    body.textContent = "";
    const list = this._forecast;
    if (!list || !list.length) {
      const d = document.createElement("div");
      d.className = "f-empty";
      d.textContent = "Chargement des prévisions…";
      body.appendChild(d);
      return;
    }
    for (const f of list.slice(0, this._config.forecast_days || 7)) {
      const meta =
        CONDITIONS[f.condition] ||
        { label: f.condition, icon: "mdi:weather-partly-cloudy", color: "#5B9BF5" };
      const row = document.createElement("div");
      row.className = "f-row";
      const day = document.createElement("div");
      day.className = "f-day";
      day.textContent = new Date(f.datetime).toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
      });
      const ico = document.createElement("ha-icon");
      ico.setAttribute("icon", meta.icon);
      ico.style.color = meta.color;
      const cond = document.createElement("div");
      cond.className = "f-cond";
      cond.textContent = meta.label || "";
      row.append(day, ico, cond);
      const pp = f.precipitation_probability;
      if (pp != null && pp > 0) {
        const rain = document.createElement("span");
        rain.className = "f-rain";
        rain.innerHTML = `<ha-icon icon="mdi:water"></ha-icon>${Math.round(pp)}%`;
        row.appendChild(rain);
      }
      const temps = document.createElement("div");
      temps.className = "f-temps";
      const lo = f.templow != null ? `${Math.round(f.templow)}°` : "";
      const hi = f.temperature != null ? `${Math.round(f.temperature)}°` : "—";
      temps.innerHTML = `<span class="lo">${lo}</span> <span class="hi">${hi}</span>`;
      row.appendChild(temps);
      body.appendChild(row);
    }
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

if (!customElements.get("serenity-weather-card")) {
  customElements.define("serenity-weather-card", SerenityWeatherCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "serenity-weather-card",
  name: "Serenity Weather",
  description:
    "Current conditions with humidity/wind chips and a 5-day forecast row.",
  preview: true,
  documentationURL: "https://github.com/your-username/serenity-cards",
});

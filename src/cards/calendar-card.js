/**
 * Serenity Calendar Card — custom:serenity-calendar-card
 *
 * An agenda of the next days across one or more calendars: French date
 * chips ("Auj.", "Demain", "mer. 16"), event title, time and a colour
 * bar per calendar. Events are fetched over the calendar REST API and
 * cached for 15 minutes.
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

const DEFAULT_ACCENTS = ["#3F9E6B", "#8B6FD0", "#E0813F", "#5B9BF5", "#D267A0"];
const CACHE_MS = 15 * 60 * 1000;

function dayChip(d) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((day - today) / 86400000);
  if (diff <= 0) return "Auj.";
  if (diff === 1) return "Demain";
  return d
    .toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })
    .replace(".", "");
}

export class SerenityCalendarCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
    this._events = null;
    this._fetchTs = 0;
    this._fetching = false;
    this._timer = null;
  }

  setConfig(config) {
    if (!config || !Array.isArray(config.calendars) || !config.calendars.length) {
      throw new Error("You must define calendars: [{entity: calendar.x}]");
    }
    this._config = { days: 7, max_events: 6, ...config };
    this._events = null;
    this._fetchTs = 0;
    if (this._built) {
      this._render();
      this._maybeFetch(true);
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.isConnected) return;
    this._ensureBuilt();
    this._maybeFetch();
  }

  connectedCallback() {
    this._ensureBuilt();
    if (this._hass) this._maybeFetch();
    this._timer = window.setInterval(() => this._maybeFetch(true), CACHE_MS);
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
        Object.keys(hass.states).find((e) => e.startsWith("calendar.")) || "";
    }
    return { title: "Agenda", calendars: entity ? [{ entity }] : [] };
  }

  _ensureBuilt() {
    if (this._built) return;
    const root = this.shadowRoot;

    const style = document.createElement("style");
    style.textContent = this._css();
    root.appendChild(style);

    const card = document.createElement("ha-card");
    card.innerHTML = `
      <div class="head hidden"><div class="title"></div></div>
      <div class="list"><div class="loading-row"></div></div>`;
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
      list: root.querySelector(".list"),
    };
    this._built = true;
    this._render();
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
      ha-card { padding: 13px 14px; overflow: hidden; }
      .head { margin-bottom: 10px; }
      .head.hidden { display: none; }
      .title { font-size: 14.5px; font-weight: 700; letter-spacing: -0.2px; color: var(--_value); }
      .list { display: flex; flex-direction: column; }
      .loading-row {
        height: 42px; border-radius: 12px;
        background: linear-gradient(90deg, var(--_plate) 25%, rgba(120, 130, 138, 0.18) 50%, var(--_plate) 75%);
        background-size: 200% 100%; animation: shimmer 1.2s linear infinite;
      }
      @keyframes shimmer { to { background-position: -200% 0; } }
      .ev {
        display: flex; align-items: center; gap: 11px; min-width: 0;
        padding: 7px 6px; border-radius: 12px;
      }
      .ev + .ev { margin-top: 2px; }
      .bar { flex: 0 0 auto; width: 4px; height: 30px; border-radius: 999px; background: var(--ev-accent, var(--_muted)); }
      .chip {
        flex: 0 0 auto; min-width: 56px; text-align: center;
        padding: 5px 8px; border-radius: 10px; background: var(--ev-soft, var(--_plate));
        font-size: 11.5px; font-weight: 700; color: var(--ev-accent, var(--_value));
        text-transform: capitalize; white-space: nowrap;
      }
      .txt { flex: 1 1 auto; min-width: 0; }
      .ev-title { font-size: 13.5px; font-weight: 600; color: var(--_value);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ev-sub { margin-top: 1px; font-size: 11.5px; font-weight: 500; color: var(--_muted);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .empty {
        display: flex; align-items: center; gap: 11px; padding: 8px 6px;
      }
      .empty .icon-box {
        width: 36px; height: 36px; border-radius: 11px;
        background: ${"rgba(63, 158, 107, 0.14)"};
        display: flex; align-items: center; justify-content: center;
      }
      .empty ha-icon { --mdc-icon-size: 19px; color: var(--_ok); }
      .empty .msg { font-size: 14px; font-weight: 600; color: var(--_ok); }
    `;
  }

  async _maybeFetch(force = false) {
    if (!this._hass || !this._config || this._fetching) return;
    const now = Date.now();
    if (!force && this._fetchTs && now - this._fetchTs < CACHE_MS) return;
    this._fetching = true;

    const start = new Date().toISOString();
    const end = new Date(
      now + (this._config.days || 7) * 86400000
    ).toISOString();

    const all = [];
    await Promise.all(
      this._config.calendars.map(async (cal, i) => {
        try {
          const events = await this._hass.callApi(
            "GET",
            `calendars/${cal.entity}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
          );
          for (const ev of events || []) {
            const s = ev.start || {};
            const allDay = s.date != null;
            const when = new Date(allDay ? `${s.date}T00:00:00` : s.dateTime);
            all.push({
              when,
              allDay,
              title: ev.summary || "(Sans titre)",
              cal,
              accent:
                cal.accent || DEFAULT_ACCENTS[i % DEFAULT_ACCENTS.length],
            });
          }
        } catch (e) {
          /* calendar unavailable — skip */
        }
      })
    );

    all.sort((a, b) => a.when - b.when);
    this._events = all.slice(0, this._config.max_events || 6);
    this._fetchTs = now;
    this._fetching = false;
    this._render();
  }

  _render() {
    if (!this._built || !this._config) return;
    const els = this._els;

    els.head.classList.toggle("hidden", !this._config.title);
    els.title.textContent = this._config.title || "";

    if (this._events == null) return; // keep skeleton

    els.list.textContent = "";
    if (!this._events.length) {
      const row = document.createElement("div");
      row.className = "empty";
      row.innerHTML = `
        <div class="icon-box"><ha-icon icon="mdi:calendar-check"></ha-icon></div>
        <div class="msg"></div>`;
      row.querySelector(".msg").textContent =
        this._config.empty_message || "Aucun événement à venir";
      els.list.appendChild(row);
      return;
    }

    for (const ev of this._events) {
      const row = document.createElement("div");
      row.className = "ev";
      row.style.setProperty("--ev-accent", ev.accent);
      row.style.setProperty("--ev-soft", hexToRgba(ev.accent, 0.12));
      row.innerHTML = `
        <div class="bar"></div>
        <div class="chip"></div>
        <div class="txt">
          <div class="ev-title"></div>
          <div class="ev-sub"></div>
        </div>`;
      row.querySelector(".chip").textContent = dayChip(ev.when);
      row.querySelector(".ev-title").textContent = ev.title;
      const calName =
        ev.cal.name ||
        (this._hass.states[ev.cal.entity] &&
          this._hass.states[ev.cal.entity].attributes.friendly_name) ||
        "";
      const time = ev.allDay
        ? "Journée"
        : ev.when.toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          });
      row.querySelector(".ev-sub").textContent = calName
        ? `${time} · ${calName}`
        : time;
      els.list.appendChild(row);
    }
  }
}

if (!customElements.get("serenity-calendar-card")) {
  customElements.define("serenity-calendar-card", SerenityCalendarCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "serenity-calendar-card",
  name: "Serenity Calendar",
  description:
    "Agenda of upcoming events across calendars with French date chips.",
  preview: true,
  documentationURL: "https://github.com/your-username/serenity-cards",
});

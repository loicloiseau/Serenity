/**
 * Visual editors for Serenity cards.
 *
 * One generic <serenity-form-editor> renders Home Assistant's native
 * ha-form from a per-card schema; each card class gets a static
 * getConfigElement() so the dashboard UI shows a form instead of raw
 * YAML. Advanced options (count-specs, buttons, scenes…) remain
 * YAML-only by design.
 */

class SerenityFormEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  set schema(schema) {
    this._schema = schema;
    this._render();
  }

  connectedCallback() {
    this._render();
  }

  _render() {
    if (!this._config || !this._schema) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => s.label || s.name;
      this._form.addEventListener("value-changed", (e) => {
        e.stopPropagation();
        const value = e.detail.value || {};
        const config = { ...this._config };
        for (const s of this._schema) {
          const v = value[s.name];
          if (
            v === "" ||
            v == null ||
            (Array.isArray(v) && v.length === 0)
          ) {
            delete config[s.name];
          } else {
            config[s.name] = v;
          }
        }
        this._config = config;
        this.dispatchEvent(
          new CustomEvent("config-changed", {
            detail: { config },
            bubbles: true,
            composed: true,
          })
        );
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.data = this._config;
    this._form.schema = this._schema;
  }
}

if (!customElements.get("serenity-form-editor")) {
  customElements.define("serenity-form-editor", SerenityFormEditor);
}

/* ------------------------------ schemas ------------------------------ */

const ENT = (domain, name = "entity", label = "Entité") => ({
  name,
  label,
  selector: { entity: domain ? { domain } : {} },
});
const ENTS = (domain, name, label) => ({
  name,
  label,
  selector: { entity: { multiple: true, ...(domain ? { domain } : {}) } },
});
const TXT = (name, label) => ({ name, label, selector: { text: {} } });
const BOOL = (name, label) => ({ name, label, selector: { boolean: {} } });
const NUM = (name, label, min, max, step = 1) => ({
  name,
  label,
  selector: { number: { min, max, step, mode: "box" } },
});
const ICON = (name = "icon", label = "Icône") => ({
  name,
  label,
  selector: { icon: {} },
});

const SCHEMAS = {
  "serenity-light-card": [
    ENT("light"),
    TXT("name", "Nom"),
    ICON(),
    TXT("accent", "Couleur d'accent (hex)"),
    BOOL("full_width", "Pleine largeur"),
    BOOL("popup", "Popup au maintien (désactiver = more-info)"),
  ],
  "serenity-entity-card": [
    ENT(null),
    TXT("name", "Nom"),
    ICON(),
    TXT("accent", "Couleur d'accent (hex)"),
    BOOL("full_width", "Pleine largeur"),
    BOOL("show_since", "Afficher « depuis »"),
  ],
  "serenity-cover-card": [
    ENT("cover"),
    TXT("name", "Nom"),
    ICON(),
    TXT("accent", "Couleur d'accent (hex)"),
    BOOL("full_width", "Pleine largeur"),
  ],
  "serenity-person-card": [
    ENT("person"),
    TXT("name", "Nom"),
    BOOL("show_picture", "Utiliser la photo"),
    BOOL("show_status", "Afficher le statut"),
    BOOL("show_since", "Afficher « depuis »"),
    ENT("sensor", "battery_entity", "Batterie du téléphone"),
    ENT("sensor", "distance_entity", "Distance (proximity)"),
  ],
  "serenity-camera-card": [
    ENT("camera"),
    TXT("name", "Nom"),
    ENT("binary_sensor", "motion_entity", "Capteur de mouvement"),
    BOOL("live", "Flux en direct"),
    NUM("refresh_seconds", "Rafraîchissement (s)", 2, 120),
  ],
  "serenity-weather-card": [
    ENT("weather"),
    TXT("name", "Nom"),
    BOOL("show_forecast", "Afficher les prévisions"),
    NUM("forecast_days", "Jours de prévision", 1, 7),
  ],
  "serenity-thermostat-card": [
    ENT("climate"),
    TXT("name", "Nom"),
    TXT("secondary", "Sous-titre"),
    ICON(),
    ENT("sensor", "humidity_entity", "Capteur d'humidité"),
    NUM("min", "Consigne min", 0, 30, 0.5),
    NUM("max", "Consigne max", 10, 40, 0.5),
    NUM("step", "Pas", 0.1, 5, 0.1),
    BOOL("show_humidity", "Afficher l'humidité"),
  ],
  "serenity-climate-card": [
    ENT("climate"),
    TXT("accent", "Couleur d'accent (hex)"),
    NUM("step", "Pas", 0.1, 5, 0.1),
  ],
  "serenity-group-card": [
    TXT("title", "Titre"),
    ICON(),
    TXT("accent", "Couleur d'accent (hex)"),
    ENTS(null, "entities", "Entités du groupe"),
  ],
  "serenity-alarm-card": [
    ENT("alarm_control_panel"),
    TXT("code", "Code (optionnel)"),
    ENTS("binary_sensor", "doors", "Portes & fenêtres"),
    ENTS("binary_sensor", "motion", "Capteurs de mouvement"),
    BOOL("show_actions", "Boutons armer/désarmer"),
  ],
  "serenity-title-card": [
    TXT("title", "Titre"),
    TXT("label", "Label (eyebrow)"),
    ICON(),
    TXT("accent", "Couleur d'accent (hex)"),
  ],
  "serenity-subtitle-card": [
    TXT("title", "Titre"),
    TXT("label", "Label (eyebrow)"),
  ],
  "serenity-tile-card": [
    TXT("title", "Titre"),
    ICON(),
    TXT("accent", "Couleur d'accent (hex)"),
    ENT(null, "entity", "Entité (état actif)"),
  ],
  "serenity-graph-card": [
    ENT("sensor"),
    TXT("name", "Nom"),
    ICON(),
    TXT("accent", "Couleur d'accent (hex)"),
    NUM("hours", "Fenêtre (heures)", 1, 168),
    TXT("unit", "Unité"),
    NUM("decimals", "Décimales", 0, 3),
  ],
  "serenity-temperature-card": [
    ENT("sensor"),
    TXT("name", "Nom"),
    NUM("hours", "Fenêtre (heures)", 1, 72),
    NUM("bars", "Nombre de barres", 6, 48),
  ],
  "serenity-humidity-card": [
    ENT("sensor"),
    TXT("name", "Nom"),
    NUM("hours", "Fenêtre (heures)", 1, 72),
    NUM("bars", "Nombre de barres", 6, 48),
  ],
  "serenity-alerts-card": [
    TXT("empty_message", "Message quand tout va bien"),
    ENTS("binary_sensor", "door_entities", "Portes"),
    ENTS("binary_sensor", "window_entities", "Fenêtres"),
    ENTS("sensor", "ink_entities", "Niveaux d'encre"),
    NUM("ink_threshold", "Seuil encre (%)", 1, 100),
    ENTS("sensor", "battery_entities", "Batteries"),
    NUM("battery_threshold", "Seuil batterie (%)", 1, 100),
    BOOL("expanded", "Dépliée par défaut"),
    NUM("snooze_hours", "Masquer pendant (heures)", 1, 168),
  ],
  "serenity-timer-card": [
    ENT("timer"),
    TXT("name", "Nom"),
    ICON(),
    TXT("accent", "Couleur d'accent (hex)"),
    BOOL("full_width", "Pleine largeur"),
  ],
};

for (const [tag, schema] of Object.entries(SCHEMAS)) {
  const cls = customElements.get(tag);
  if (!cls) continue;
  cls.getConfigElement = () => {
    const el = document.createElement("serenity-form-editor");
    el.schema = schema;
    return el;
  };
}

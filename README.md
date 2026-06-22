# Serenity Cards

Minimal **temperature** and **humidity** cards for Home Assistant, built to pair with the *Serenity* theme. Each card shows a live value, a status badge, a history sparkline pulled from your recorder, a trend arrow, and an optional secondary reading.

- `custom:serenity-temperature-card`
- `custom:serenity-humidity-card`

> Adding a new card later is one source file plus one import line — no copy‑pasting a giant monolith.

---

## Install

### Option A — HACS (recommended)

1. **HACS → ⋮ → Custom repositories.**
2. Add this repo's URL, category **Dashboard**.
3. Install **Serenity Cards**, then reload your browser.
4. HACS adds the resource automatically. (If not: **Settings → Dashboards → ⋮ → Resources → Add**, URL `/hacsfiles/serenity-cards/serenity-cards.js`, type **JavaScript Module**.)

### Option B — Manual

1. Copy `dist/serenity-cards.js` to `config/www/serenity-cards.js`.
2. **Settings → Dashboards → ⋮ → Resources → + Add Resource**
   - URL: `/local/serenity-cards.js`
   - Type: **JavaScript Module**
3. Hard‑refresh the browser (Ctrl/Cmd + Shift + R).

---

## Usage

Edit a dashboard → **Add Card** → search "Serenity", or paste YAML:

```yaml
type: custom:serenity-temperature-card
entity: sensor.living_room_temperature
name: Living Room
secondary_entity: sensor.living_room_humidity
secondary_unit: "% RH"
```

```yaml
type: custom:serenity-humidity-card
entity: sensor.living_room_humidity
name: Living Room
secondary_entity: sensor.living_room_temperature
```

> The sparkline needs the **recorder** enabled for the entity (on by default). With no history the card still shows the live value and a quiet placeholder baseline.

---

## Options

| Option              | Type   | Default                | Description                                              |
| ------------------- | ------ | ---------------------- | -------------------------------------------------------- |
| `entity`            | string | —                      | The sensor to display (required).                        |
| `name`              | string | friendly name          | Title shown on the card.                                 |
| `secondary_entity`  | string | —                      | Optional second reading shown in the trend line.         |
| `secondary_unit`    | string | entity's unit          | Override the secondary unit (e.g. `"% RH"`).             |
| `secondary_decimals`| number | `1`                    | Rounding for the secondary value.                        |
| `hours`             | number | `12`                   | History window covered by the bars.                      |
| `bars`              | number | `24`                   | Number of bars in the sparkline.                         |
| `trend_hours`       | number | `3`                    | Lookback used for the up/down trend arrow.               |
| `trend_unit`        | string | `°` / `%`              | Unit shown next to the trend value.                      |
| `decimals`          | number | `1`                    | Rounding for the main value.                             |
| `unit`              | string | entity's unit          | Override the main unit.                                  |
| `icon`              | string | `thermometer`/`water`  | Any `mdi:` icon.                                         |
| `min` / `max`       | number | auto                   | Fix the bar scale instead of auto‑ranging.               |
| `accent`            | string | theme / built‑in       | Override the accent colour.                              |
| `soft`              | string | theme / built‑in       | Override the icon tile background.                       |
| `bar_low`/`bar_high`| string | built‑in               | Gradient ends for the bars.                              |
| `thresholds`        | list   | sensible defaults      | Status bands — see below.                                |

### Custom status bands

```yaml
thresholds:
  - { value: 40, label: "Optimal", color: "#5B9BF5" }
  - { value: 60, label: "Humid",   color: "#E0A95B" }
  - { value: 70, label: "Too Humid", color: "#E06B5B" }
```

The card picks the last band whose `value` is `≤` the current reading.

---

## Theming

Define any of these in your `serenity.yaml` theme and both cards inherit them automatically (the card background, radius and shadow already follow `ha-card`):

```yaml
serenity:
  serenity-temperature-color: "#4FAE7C"
  serenity-temperature-soft: "#E9F5EE"
  serenity-humidity-color: "#5B9BF5"
  serenity-humidity-soft: "#EEF4FF"
  serenity-value-color: "var(--primary-text-color)"
  serenity-muted-color: "var(--secondary-text-color)"
```

---

## Development

```bash
npm install      # one-time
npm run build    # bundle src/ -> dist/serenity-cards.js
npm run watch    # rebuild on save
```

### Add a new card

1. Create `src/cards/my-card.js` extending `SerenitySensorCardBase` (or a new base) and `customElements.define(...)` it.
2. Add `import "./cards/my-card.js";` to `src/main.js`.
3. `npm run build`.

```
src/
├── main.js            entry — imports every card
├── version.js
├── const.js           per-type defaults (colors, thresholds)
├── styles.js          scoped CSS
├── utils.js           pure helpers (color, history, chevrons)
├── base-card.js       shared web component
└── cards/
    ├── temperature-card.js
    └── humidity-card.js
```

## License

MIT

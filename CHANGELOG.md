# Changelog

## v1.11.0

- **Light popup**: long-press opens a Serenity panel — fine brightness slider, white-temperature presets (2700–6200 K) and colour presets, capability-aware (`popup: false` restores native more-info)
- **Timer card** (`serenity-timer-card`): live countdown with progress fill, preset chips (5/10/30 min, configurable), pause/resume and cancel
- **Person card**: optional `battery_entity` (phone battery pill, orange ≤40 %, red ≤20 %) and `distance_entity` (distance shown while away)
- **Alerts card**: `snooze_hours` (dismiss temporarily instead of until state change) and per-rule `tap_action` on custom alerts
- **Polish**: entrance animation on every card (respects `prefers-reduced-motion`), shimmer skeleton while the graph card loads history
- Visual editors updated for all the new options

## v1.10.0

- **Graph card** (`serenity-graph-card`): smooth gradient history curve with current value and min/max
- **Cover card** (`serenity-cover-card`): up/stop/down, drag-to-position fill, device-class icons
- **Visual editors** for 18 cards via a generic `ha-form` editor

## v1.9.0

- **Camera card** (`serenity-camera-card`): rounded view, frosted name chip, pulsing motion badge, optional live stream
- Dark-theme-friendly colors (thermostat tiles, climate controls, header buttons)
- Full README documenting every card

## v1.8.0

- **Alarm quick actions**: Désarmer / Maison / Absent buttons on the card (configurable, optional code)
- **Media card** (`serenity-media-card`): artwork, transport controls, draggable volume, player chips

## v1.7.0

- Tile card `alert` spec (sensor-driven red override for the Security tile)
- Thermostat redesign: bigger dial, vertical steppers, inline stat chips
- Climate card: popup selection menus for mode/fan/swing, horizontal swing support, French labels

## v1.6.0

- Alerts card reworked into a notification centre: layer stack, expand, per-alert dismiss (persisted), clear-all

## v1.5.x

- Weather, alerts, scene and light cards; softer tints; grid heights fixed (`rows: auto`); compact climate view

## v1.4.0

- Tile, group, entity and alarm cards; header greeting, menu action, count formats (`format_zero`, `{s}`)

## v1.3.0 and earlier

- Person card (GPS zones, presence dot, "depuis …"), thermostat card, header title/subtitle cards, temperature/humidity sensor cards

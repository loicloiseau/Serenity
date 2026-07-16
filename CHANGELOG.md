# Changelog

## v1.15.0

- **Weather card**: tapping slides up a detailed forecast bottom sheet (day, condition, rain probability, min/max) — `sheet: false` restores more-info
- **Light card**: the long-press panel is now a bottom sheet, same chrome as the climate menus
- **Tabs card**: chips redesigned as a single card-shaped segmented control (consistent background and corner radius)
- **Scene card compact**: buttons now rounded rectangles (14px) matching the rest of the suite
- **Graph card**: all series are prefetched in the background — switching sensors is instant on first tap

## v1.14.0

- **Tabs card** (`serenity-tabs-card`): chip-switched decks of cards — the scroll-safe replacement for gesture swipers (vertical touches always scroll the page; a clear horizontal swipe still switches decks)
- **Graph card**: press/hover the curve to scrub — a cursor shows the exact value and time; `tabs: false` hides the chips; listens to `serenity-graph-select` events
- **Sensor cards**: `select_graph: true` — tapping the card switches the graph card to that sensor (accent ring marks the displayed one)
- **Tile card**: `power` spec — accent turns green when exporting/producing and amber when consuming, tint intensity scales with the wattage, auto subtitle "Production/Consommation · N W"
- **Scene card**: `compact: true` — plain pill buttons, no last-scene highlight
- **Climate card**: selection menus are now full-screen bottom sheets (easier to tap); power-on restores the last mode (remembered across reloads, `on_mode` to force one)
- **Thermostat card**: dial properly centred, steppers overlay on the right

## v1.13.0

- **Battery card** (`serenity-battery-card`): every battery sorted lowest-first with level bars, low/mid thresholds, auto-discovery (`auto: true`), `show_ok`, `max_items`
- **Graph card multi-series**: `entities: [{entity, name, accent, icon}]` with selector chips to switch series — one card for all room temperatures
- **Compact sensors**: `compact: true` on temperature/humidity cards — no history bars, half-width, fits a 2-up grid
- **Performance**: every card now skips re-rendering when its watched entities haven't changed (guarded `set hass`)
- **Navbar**: `hide_labels` option for an icon-only bar
- Visual editors updated (battery card, compact toggle)

## v1.12.0

- **Navbar card** (`serenity-navbar-card`): floating bottom navigation, active-tab accent, count-spec badges, in-flow spacer
- **Calendar card** (`serenity-calendar-card`): agenda for the next days with French date chips, per-calendar accents, 15-min cache
- **Alerts card**: `show_updates: true` aggregates pending `update.*` entities into one row that navigates to `/config/updates`
- **Title card**: `label: date` renders today's French date as the eyebrow

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

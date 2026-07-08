import { VERSION } from "./version.js";

// Register each card. To add a new one, drop a file in ./cards/
// and import it here — that's the only wiring needed.
import "./cards/temperature-card.js";
import "./cards/humidity-card.js";
import "./cards/climate-card.js";
import "./cards/thermostat-card.js";
import "./cards/person-card.js";
import "./cards/title-card.js";
import "./cards/subtitle-card.js";
import "./cards/tile-card.js";
import "./cards/group-card.js";
import "./cards/entity-card.js";
import "./cards/alarm-card.js";
import "./cards/weather-card.js";
import "./cards/alerts-card.js";
import "./cards/scene-card.js";
import "./cards/light-card.js";

console.info(
  `%c SERENITY-CARDS %c v${VERSION} `,
  "color:#fff;background:#5B9BF5;border-radius:3px 0 0 3px;padding:2px 6px;font-weight:600",
  "color:#fff;background:#4FAE7C;border-radius:0 3px 3px 0;padding:2px 6px;font-weight:600"
);

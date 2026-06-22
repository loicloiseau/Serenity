import { SerenitySensorCardBase } from "../base-card.js";

export class SerenityHumidityCard extends SerenitySensorCardBase {
  static cardType = "humidity";
}

if (!customElements.get("serenity-humidity-card")) {
  customElements.define("serenity-humidity-card", SerenityHumidityCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "serenity-humidity-card",
  name: "Serenity Humidity",
  description: "Minimal humidity card with history bars, status and trend.",
  preview: true,
  documentationURL: "https://github.com/your-username/serenity-cards",
});

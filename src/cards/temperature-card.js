import { SerenitySensorCardBase } from "../base-card.js";

export class SerenityTemperatureCard extends SerenitySensorCardBase {
  static cardType = "temperature";
}

if (!customElements.get("serenity-temperature-card")) {
  customElements.define("serenity-temperature-card", SerenityTemperatureCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "serenity-temperature-card",
  name: "Serenity Temperature",
  description: "Minimal temperature card with history bars, status and trend.",
  preview: true,
  documentationURL: "https://github.com/your-username/serenity-cards",
});

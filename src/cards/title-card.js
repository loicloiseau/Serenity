import { SerenityHeaderCardBase } from "../header-card-base.js";

export class SerenityTitleCard extends SerenityHeaderCardBase {
  static variant = "title";

  static getStubConfig() {
    return {
      label: "Title",
      title: "Living Room",
      icon: "mdi:home",
      badge: "4 active",
    };
  }
}

if (!customElements.get("serenity-title-card")) {
  customElements.define("serenity-title-card", SerenityTitleCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "serenity-title-card",
  name: "Serenity Title",
  description: "Section title with optional icon and a static or dynamic badge.",
  preview: true,
  documentationURL: "https://github.com/your-username/serenity-cards",
});

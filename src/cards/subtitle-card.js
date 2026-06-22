import { SerenityHeaderCardBase } from "../header-card-base.js";

export class SerenitySubtitleCard extends SerenityHeaderCardBase {
  static variant = "subtitle";

  static getStubConfig() {
    return {
      label: "Subtitle",
      title: "Climate",
      secondary: "3 sensors",
    };
  }
}

if (!customElements.get("serenity-subtitle-card")) {
  customElements.define("serenity-subtitle-card", SerenitySubtitleCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "serenity-subtitle-card",
  name: "Serenity Subtitle",
  description: "Smaller section subtitle with an inline secondary label or count.",
  preview: true,
  documentationURL: "https://github.com/your-username/serenity-cards",
});

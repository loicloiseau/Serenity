/**
 * Per-type defaults. Every value here can be overridden per-card in YAML,
 * or globally from your theme via the CSS variables documented in the README.
 */
export const DEFAULTS = {
  temperature: {
    icon: "mdi:thermometer",
    accent: "#4FAE7C",
    soft: "#E9F5EE",
    barLow: "#CFE9D9",
    barHigh: "#3E9E6B",
    trendUnit: "\u00B0",
    fallbackUnit: "\u00B0C",
    thresholds: [
      { value: -1000, label: "Cold", color: "#5B9BF5" },
      { value: 16, label: "Cool", color: "#6FB1E0" },
      { value: 18, label: "Mild", color: "#4FAE7C" },
      { value: 20, label: "Comfortable", color: "#4FAE7C" },
      { value: 24, label: "Warm", color: "#E0A95B" },
      { value: 27, label: "Hot", color: "#E06B5B" },
    ],
  },
  humidity: {
    icon: "mdi:water-outline",
    accent: "#5B9BF5",
    soft: "#EEF4FF",
    barLow: "#A9CCF6",
    barHigh: "#5B9BF5",
    trendUnit: "%",
    fallbackUnit: "%",
    thresholds: [
      { value: -1000, label: "Dry", color: "#E0A95B" },
      { value: 30, label: "Fair", color: "#6FB1E0" },
      { value: 40, label: "Optimal", color: "#5B9BF5" },
      { value: 60, label: "Humid", color: "#6FB1E0" },
      { value: 70, label: "Too Humid", color: "#E0A95B" },
    ],
  },
};

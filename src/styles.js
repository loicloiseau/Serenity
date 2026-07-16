import { DEFAULTS } from "./const.js";

/** Returns the scoped CSS for a card of the given type. */
export function cardStyles(type) {
  const d = DEFAULTS[type];
  return `
    :host {
      --_accent: var(--serenity-${type}-color, ${d.accent});
      --_soft: var(--serenity-${type}-soft, ${d.soft});
      --_value: var(--serenity-value-color, var(--primary-text-color, #1f2937));
      --_muted: var(--serenity-muted-color, var(--secondary-text-color, #9aa3af));
      --_sep: var(--serenity-sep-color, color-mix(in srgb, var(--_accent) 55%, transparent));
      display: block;
    }
    ha-card {
      padding: 9px 14px;
      cursor: pointer;
      overflow: hidden;
    }
    .serenity {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .icon-box {
      flex: 0 0 auto;
      width: 36px;
      height: 36px;
      border-radius: 12px;
      background: var(--_soft);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .icon-box ha-icon {
      --mdc-icon-size: 20px;
      color: var(--_accent);
    }
    .title-block {
      flex: 0 0 auto;
      min-width: 80px;
    }
    .name {
      font-size: 15px;
      font-weight: 700;
      line-height: 1.2;
      color: var(--_value);
      white-space: nowrap;
    }
    .status {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 3px;
      font-size: 12.5px;
      font-weight: 500;
      color: var(--_muted);
    }
    .dot {
      flex: 0 0 auto;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--_accent);
    }
    .chart {
      flex: 1 1 auto;
      min-width: 24px;
      height: 26px;
      display: flex;
      align-items: flex-end;
      gap: 3px;
      overflow: hidden;
    }
    .bar {
      flex: 1 1 0;
      min-width: 2px;
      border-radius: 3px;
      background: var(--_accent);
      transition: height 0.4s ease;
    }
    .value-block {
      flex: 0 0 auto;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }
    .value {
      display: flex;
      align-items: flex-start;
      line-height: 1;
    }
    .num {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: var(--_value);
    }
    .unit {
      font-size: 13px;
      font-weight: 700;
      margin-left: 2px;
      margin-top: 2px;
      color: var(--_muted);
    }
    .sub {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 5px;
      font-size: 12px;
      font-weight: 600;
      color: var(--_accent);
      white-space: nowrap;
    }
    .sub svg {
      width: 11px;
      height: 11px;
      flex: 0 0 auto;
    }
    .sub .sep {
      color: var(--_sep);
      margin: 0 1px;
    }
    .unavailable .num { color: var(--_muted); }
    /* compact: no history bars, tighter row — fits two-up */
    .compact { padding: 9px 12px; }
    .compact .chart { display: none; }
    .compact .serenity { gap: 10px; }
    .compact .title-block { flex: 1 1 auto; min-width: 0; }
    .compact .name { overflow: hidden; text-overflow: ellipsis; }
    .compact .num { font-size: 19px; }
    .compact .sub { display: none; }
  `;
}

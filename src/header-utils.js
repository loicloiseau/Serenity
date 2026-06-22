/** Helpers for header cards: count entities and format dynamic labels. */

const INACTIVE = new Set([
  "off",
  "unavailable",
  "unknown",
  "idle",
  "standby",
  "closed",
  "not_home",
  "none",
  "0",
  "",
]);

function matches(state, spec) {
  if (spec.state != null) {
    const arr = Array.isArray(spec.state) ? spec.state : [spec.state];
    return arr.map(String).includes(String(state));
  }
  if (spec.state_not != null) {
    const arr = Array.isArray(spec.state_not) ? spec.state_not : [spec.state_not];
    return !arr.map(String).includes(String(state));
  }
  return !INACTIVE.has(String(state).toLowerCase());
}

/**
 * Count entities matching a spec:
 *   { entities: [...], domain: "climate"|[...], state | state_not: value|[...] }
 * With no state filter, anything not "inactive" (off/unavailable/idle/...) counts.
 */
export function countEntities(hass, spec) {
  if (!hass || !spec) return 0;
  let ids = Array.isArray(spec.entities) ? spec.entities.slice() : [];
  if (spec.domain) {
    const domains = Array.isArray(spec.domain) ? spec.domain : [spec.domain];
    for (const k of Object.keys(hass.states)) {
      if (domains.includes(k.split(".")[0])) ids.push(k);
    }
  }
  ids = [...new Set(ids)];
  let n = 0;
  for (const id of ids) {
    const st = hass.states[id];
    if (st && matches(st.state, spec)) n++;
  }
  return n;
}

/** Render a count into text: `format` ("{n} active") wins, else `${n} ${suffix}`. */
export function countText(n, spec) {
  if (spec.format) return String(spec.format).replace(/\{n\}/g, n);
  const suffix = spec.suffix != null ? ` ${spec.suffix}` : "";
  return `${n}${suffix}`;
}

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

/**
 * Render a count into text. Tokens: {n} = count, {s} = "s" when n > 1.
 * `format_zero` / `format_one` override `format` for those counts,
 * else `format` wins, else `${n} ${suffix}`.
 */
export function countText(n, spec) {
  const rep = (t) =>
    String(t)
      .replace(/\{n\}/g, n)
      .replace(/\{s\}/g, n > 1 ? "s" : "");
  if (n === 0 && spec.format_zero != null) return rep(spec.format_zero);
  if (n === 1 && spec.format_one != null) return rep(spec.format_one);
  if (spec.format) return rep(spec.format);
  const suffix = spec.suffix != null ? ` ${spec.suffix}` : "";
  return `${n}${suffix}`;
}

/** True when a state should be considered "active" (not off/idle/…). */
export function isActiveState(state) {
  return !INACTIVE.has(String(state).toLowerCase());
}

/** Time-of-day greeting, personalised with the HA user's first name. */
export function greetingText(hass) {
  const h = new Date().getHours();
  const g =
    h >= 5 && h < 12
      ? "Bonjour"
      : h >= 12 && h < 18
        ? "Bonne après-midi"
        : "Bonsoir";
  const name =
    hass && hass.user && hass.user.name ? hass.user.name.split(" ")[0] : "";
  return name ? `${g}, ${name}` : g;
}

/** French relative time: "à l'instant", "il y a 18 min", "14:32", "hier 09:10", "3 mars". */
export function relativeTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const now = new Date();
  const min = Math.floor((now - d) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const hm = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return hm;
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return `hier ${hm}`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export const CAP = 12;
export const TZ = "Pacific/Auckland";
export const WEEKDAYS = [
  { key: "tue", dow: 2, day: "Tuesday", zh: "周二", defaults: { time: "8:45pm – 10:15pm", price: "$5 per person", courts: "", note: "" } },
  { key: "fri", dow: 5, day: "Friday", zh: "周五", defaults: { time: "7:30pm – 10:30pm", price: "$10 per person", courts: "", note: "" } },
];
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function todayNZ() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
export function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function dowOf(iso) {
  return new Date(iso + "T00:00:00Z").getUTCDay();
}
/** Rolling window: the next two Tuesdays and next two Fridays (today + 13 days), Auckland time,
 *  up to the last day in settings. When a date passes, the next one opens automatically. */
export function upcoming(config) {
  const t = todayNZ(), end = (config && config.end) || "2099-12-31", out = [];
  const mon = addDays(t, -((dowOf(t) + 6) % 7));
  for (let d = t; d <= addDays(t, 13) && d <= end; d = addDays(d, 1)) {
    const w = WEEKDAYS.find((x) => x.dow === dowOf(d));
    if (w) out.push({ date: d, w, week: d <= addDays(mon, 6) ? 0 : d <= addDays(mon, 13) ? 1 : 2 });
  }
  return out;
}
export function label(iso) {
  const d = new Date(iso + "T00:00:00Z");
  return { en: `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`, zh: `${d.getUTCMonth() + 1}月${d.getUTCDate()}日` };
}
/** Time, price and note carry over week to week. Courts never do: each date shows TBC until the organizer fills it in. */
export function info(config, date, w) {
  const own = (config.dates || {})[date] || {};
  return { ...w.defaults, ...((config.weekly || {})[w.key] || {}), ...own, courts: own.courts || "" };
}
/** Session start as a timestamp (ms), read from the first time in "8:45pm – 10:15pm", Auckland time. */
export function startMs(config, date, w) {
  const parse = (t) => { const m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i.exec(t || ""); return m && [(+m[1] % 12) + (/pm/i.test(m[3]) ? 12 : 0), +(m[2] || 0)]; };
  const [h, mi] = parse(info(config, date, w).time) || parse(w.defaults.time);
  const [y, mo, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" })
    .formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
  const offset = Date.UTC(+p.year, p.month - 1, +p.day, +p.hour % 24, +p.minute) - guess;
  return guess - offset;
}
/** Players can't remove their own name within 24 hours of the start. */
export function locked(config, date, w) {
  return Date.now() >= startMs(config, date, w) - 24 * 3600 * 1000;
}
export function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
}

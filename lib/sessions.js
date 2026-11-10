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
/** Sessions for this week + next week (Mon–Sun), Auckland time, up to the last day in settings. */
export function upcoming(config) {
  const t = todayNZ(), end = (config && config.end) || "2099-12-31", out = [];
  const mon = addDays(t, -((dowOf(t) + 6) % 7)), sunThis = addDays(mon, 6), sunNext = addDays(mon, 13);
  for (let d = t; d <= sunNext && d <= end; d = addDays(d, 1)) {
    const w = WEEKDAYS.find((x) => x.dow === dowOf(d));
    if (w) out.push({ date: d, w, thisWeek: d <= sunThis });
  }
  return out;
}
export function label(iso) {
  const d = new Date(iso + "T00:00:00Z");
  return { en: `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`, zh: `${d.getUTCMonth() + 1}月${d.getUTCDate()}日` };
}
export function info(config, date, w) {
  return { ...w.defaults, ...((config.weekly || {})[w.key] || {}), ...((config.dates || {})[date] || {}) };
}
export function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
}

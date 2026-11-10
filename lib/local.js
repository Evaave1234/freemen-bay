import { uid } from "./sessions";

function ls(k, v) {
  try {
    if (v === undefined) return localStorage.getItem(k);
    localStorage.setItem(k, v);
  } catch (e) { return null; }
}
/** Private per-browser token: lets a visitor remove their own names later. */
export function myToken() {
  let t = ls("fb_token");
  if (!t) { t = uid(); ls("fb_token", t); }
  return t;
}
export function getMine() {
  try { return JSON.parse(ls("fb_mine") || "[]"); } catch (e) { return []; }
}
export function setMine(a) { ls("fb_mine", JSON.stringify(a)); }

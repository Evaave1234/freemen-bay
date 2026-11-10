import { createClient } from "@supabase/supabase-js";
import { CAP, upcoming, todayNZ, addDays, dowOf, uid } from "./sessions";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

/** Preview mode runs when the two environment variables are missing. Nothing is saved. */
export const IS_DEMO = !URL || !KEY;

/** Organizer logs in with an account number; Supabase needs an email, so we add this domain. */
export const ORGANIZER_DOMAIN = "example.com";

let client = null;
export function getBackend() {
  if (client) return client;
  client = IS_DEMO ? makeDemo() : createClient(URL, KEY);
  return client;
}

function makeDemo() {
  let admin = false;
  let settings = {
    end: "2026-12-12",
    weekly: {
      tue: { time: "8:45pm – 10:15pm", price: "$5 per person", courts: "2 court", note: "" },
      fri: { time: "7:30pm – 10:30pm", price: "$10 per person", courts: "7:30-8:30 1 court and 8:30-10:30 2 court", note: "" },
    },
    dates: {},
  };
  let signups = [];
  const listeners = [];
  const ok = (d) => Promise.resolve({ data: d, error: null });
  const bad = (m) => Promise.resolve({ data: null, error: { message: m } });
  let seeded = false;
  const seed = () => {
    if (seeded) return; seeded = true;
    const ups = upcoming(settings), now = Date.now();
    if (ups[0]) [["Amy", false, true], ["Ben", false, false], ["Leo", true, false]].forEach(([n, k, p], i) =>
      signups.push({ id: uid(), session: ups[0].date, name: n, kid: k, paid: p, owner_token: "x", created_at: now + i }));
    if (ups[1]) [["Cathy", false, true], ["David", false, false]].forEach(([n, k, p], i) =>
      signups.push({ id: uid(), session: ups[1].date, name: n, kid: k, paid: p, owner_token: "x", created_at: now + 9 + i }));
    for (let i = 1, j = 0; i <= 14; i++) {
      const d = addDays(todayNZ(), -i);
      if (![2, 5].includes(dowOf(d))) continue;
      [["Amy", true], ["Ben", false], ["Cathy", true], ["Leo", false]].forEach(([n, p], k) => {
        if ((k + j) % 3 !== 2) signups.push({ id: uid(), session: d, name: n, kid: n === "Leo", paid: p || j % 2 === 1, owner_token: "x", created_at: now - 100000 + j * 10 + k });
      });
      j++;
    }
  };
  function from(table) {
    const st = { op: "select", f: [], v: null };
    const run = () => {
      seed();
      if (table === "settings") {
        if (st.op === "update") { if (!admin) return ok([]); settings = st.v.data; return ok([{ id: 1 }]); }
        return ok({ data: settings });
      }
      if (!admin) return ok([]);
      const m = signups.filter((r) => st.f.every(([k, v]) => r[k] === v));
      if (st.op === "update") { m.forEach((r) => Object.assign(r, st.v)); return ok(m.map((r) => ({ id: r.id }))); }
      if (st.op === "delete") { signups = signups.filter((r) => !m.includes(r)); return ok(null); }
      return ok(m.map(({ owner_token, ...r }) => r));
    };
    const b = {
      select() { return b; }, update(v) { st.op = "update"; st.v = v; return b; }, delete() { st.op = "delete"; return b; },
      eq(k, v) { st.f.push([k, v]); return b; }, maybeSingle() { return run(); },
      then(a, c) { return run().then(a, c); },
    };
    return b;
  }
  return {
    from,
    rpc(name, a) {
      seed();
      if (name === "list_signups")
        return ok(signups.filter((r) => r.session >= todayNZ()).sort((x, y) => x.created_at - y.created_at).map(({ owner_token, ...r }) => r));
      if (name === "add_signup") {
        if (!upcoming(settings).some((u) => u.date === a.p_session)) return bad("CLOSED");
        if (signups.filter((r) => r.session === a.p_session).length >= CAP) return bad("FULL");
        const id = uid();
        signups.push({ id, session: a.p_session, name: a.p_name, kid: a.p_kid, paid: false, owner_token: a.p_token, created_at: Date.now() });
        return ok(id);
      }
      if (name === "remove_my_signup") {
        const n = signups.length;
        signups = signups.filter((r) => !(r.id === a.p_id && r.owner_token === a.p_token));
        return ok(signups.length < n);
      }
      return bad("unknown");
    },
    auth: {
      signInWithPassword() { admin = true; listeners.forEach((f) => f("SIGNED_IN", {})); return ok({}); },
      signOut() { admin = false; listeners.forEach((f) => f("SIGNED_OUT", null)); return ok(null); },
      onAuthStateChange(f) { listeners.push(f); setTimeout(() => f("INITIAL_SESSION", null), 0); return { data: { subscription: { unsubscribe() {} } } }; },
    },
  };
}

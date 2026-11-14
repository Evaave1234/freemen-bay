import { createClient } from "@supabase/supabase-js";
import { CAP, upcoming, todayNZ, uid } from "./sessions";

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
  let signups = [], people = [];
  const listeners = [];
  const ok = (d) => Promise.resolve({ data: d, error: null });
  const bad = (m) => Promise.resolve({ data: null, error: { message: m } });
  function from(table) {
    const st = { op: "select", f: [], v: null };
    const run = () => {
      if (table === "settings") {
        if (st.op === "update") { if (!admin) return ok([]); settings = st.v.data; return ok([{ id: 1 }]); }
        return ok({ data: settings });
      }
      if (!admin) return ok([]);
      if (table === "people") {
        if (st.op === "upsert") { people = people.filter((p) => p.name_key !== st.v.name_key).concat(st.v); return ok(null); }
        if (st.op === "delete") { people = people.filter((p) => !st.f.every(([k, v]) => p[k] === v)); return ok(null); }
        return ok(people);
      }
      const m = signups.filter((r) => st.f.every(([k, v]) => r[k] === v));
      if (st.op === "update") { m.forEach((r) => Object.assign(r, st.v)); return ok(m.map((r) => ({ id: r.id }))); }
      if (st.op === "delete") { signups = signups.filter((r) => !m.includes(r)); return ok(null); }
      return ok(m.map(({ owner_token, ...r }) => r));
    };
    const b = {
      select() { return b; }, update(v) { st.op = "update"; st.v = v; return b; }, delete() { st.op = "delete"; return b; }, upsert(v) { st.op = "upsert"; st.v = v; return b; },
      eq(k, v) { st.f.push([k, v]); return b; }, maybeSingle() { return run(); },
      then(a, c) { return run().then(a, c); },
    };
    return b;
  }
  return {
    from,
    rpc(name, a) {
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

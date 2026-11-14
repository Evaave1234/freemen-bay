"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getBackend, IS_DEMO, ORGANIZER_DOMAIN } from "../lib/backend";
import { CAP, WEEKDAYS, todayNZ, upcoming, label, info, dowOf, locked } from "../lib/sessions";
import { myToken, getMine, setMine } from "../lib/local";
import ZoomViewer from "../components/ZoomViewer";

const keyOf = (n) => String(n).trim().toLowerCase();
const Zh = ({ children, inline, style }) => <span className={inline ? "zh-i" : "zh"} style={style}>{children}</span>;

export default function Page() {
  const sb = useMemo(() => getBackend(), []);
  const [mounted, setMounted] = useState(false);
  const [config, setConfig] = useState({});
  const [rows, setRows] = useState([]);
  const [history, setHistory] = useState([]);
  const [people, setPeople] = useState({});
  const [person, setPerson] = useState(null);
  const [dayTab, setDayTab] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("Loading… 加载中…");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showNotice, setShowNotice] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editVals, setEditVals] = useState({});
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null);
  const [mine, setMineState] = useState([]);
  const [forms, setForms] = useState({});
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loginErr, setLoginErr] = useState("");

  const adminRef = useRef(false), busyRef = useRef(false), editingRef = useRef(null);
  const pendingRef = useRef(null), pendingTimer = useRef(null);
  adminRef.current = isAdmin; busyRef.current = busy; editingRef.current = editing;

  const load = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([
        sb.from("settings").select("data").eq("id", 1).maybeSingle(),
        sb.rpc("list_signups"),
      ]);
      if (s.error || l.error) throw s.error || l.error;
      setConfig((s.data && s.data.data) || {});
      setRows(l.data || []);
      setLoaded(true);
      if (adminRef.current) {
        const [h, pp] = await Promise.all([
          sb.from("signups").select("id,session,name,kid,paid,created_at"),
          sb.from("people").select("name_key,name,phone,grp"),
        ]);
        if (!h.error) setHistory(h.data || []);
        if (!pp.error) setPeople(Object.fromEntries((pp.data || []).map((p) => [p.name_key, p])));
      } else { setHistory([]); setPeople({}); }
      setStatus("");
    } catch (e) {
      setStatus("Can’t connect right now; the list may be out of date. 暂时连不上，名单可能不是最新的。");
    }
  }, [sb]);

  useEffect(() => {
    setMounted(true);
    setMineState(getMine());
    load();
    const { data } = sb.auth.onAuthStateChange((_e, session) => {
      const now = !!session, was = adminRef.current;
      adminRef.current = now; setIsAdmin(now);
      if (!now) setEditing(null);
      if (now !== was) load();
    });
    const iv = setInterval(() => {
      if (!document.hidden && !busyRef.current && !editingRef.current) load();
    }, 5000);
    const vis = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", vis);
      data?.subscription?.unsubscribe?.();
    };
  }, [sb, load]);

  /** First tap arms a confirm, second tap within 4s confirms. */
  const arm = (key) => {
    clearTimeout(pendingTimer.current);
    if (pendingRef.current !== key) {
      pendingRef.current = key; setPending(key);
      pendingTimer.current = setTimeout(() => { pendingRef.current = null; setPending(null); }, 4000);
      return false;
    }
    pendingRef.current = null; setPending(null);
    return true;
  };

  const addEntry = async (date) => {
    const f = forms[date] || {}, name = (f.name || "").trim();
    if (!name || busy) return;
    setBusy(true);
    const { data, error } = await sb.rpc("add_signup", { p_session: date, p_name: name, p_kid: !!f.kid, p_token: myToken() });
    if (error) {
      const m = error.message || "";
      setStatus(/FULL/.test(m) ? "This session is full. 这一场已经满了。"
        : /CLOSED/.test(m) ? "Sign-up isn’t open for this date. 这一天还不能报名。"
        : "Sign-up failed, please try again. 报名没有成功，请再试一次。");
    } else {
      const next = [...getMine(), data]; setMine(next); setMineState(next);
      setForms((p) => ({ ...p, [date]: { name: "", kid: false } }));
      setStatus("");
    }
    setBusy(false);
    await load();
  };

  const delEntry = async (id) => {
    if (!arm(id)) return;
    let error;
    if (isAdmin) ({ error } = await sb.from("signups").delete().eq("id", id));
    else ({ error } = await sb.rpc("remove_my_signup", { p_id: id, p_token: myToken() }));
    if (error) setStatus(/LOCKED/.test(error.message || "") ? "Less than 24 hours to go, so you can’t remove your name. Please contact the organizer. 开场前24小时内不能取消，请联系组织者。" : "Couldn’t remove. 删除没有成功。");
    else { const next = getMine().filter((x) => x !== id); setMine(next); setMineState(next); }
    await load();
  };

  const setPaid = async (id, v) => {
    setRows((p) => p.map((r) => (r.id === id ? { ...r, paid: v } : r)));
    setHistory((p) => p.map((r) => (r.id === id ? { ...r, paid: v } : r)));
    const { data, error } = await sb.from("signups").update({ paid: v }).eq("id", id).select("id");
    if (error || !data || !data.length) setStatus("Couldn’t update — please log in again. 没有更新成功，请重新登录。");
    await load();
  };

  const openPerson = (name) => {
    const p = people[keyOf(name)] || {};
    setPerson({ name: String(name).trim(), phone: p.phone || "", grp: p.grp || "", err: "" });
  };
  const savePerson = async () => {
    const key = keyOf(person.name), phone = person.phone.trim(), grp = person.grp.trim();
    const { error } = phone || grp
      ? await sb.from("people").upsert({ name_key: key, name: person.name, phone, grp, updated_at: new Date().toISOString() })
      : await sb.from("people").delete().eq("name_key", key);
    if (error) { setPerson({ ...person, err: "Couldn’t save — please log in again. 保存没有成功，请重新登录。" }); return; }
    setPeople((p) => { const n = { ...p }; if (phone || grp) n[key] = { name_key: key, name: person.name, phone, grp }; else delete n[key]; return n; });
    setPerson(null);
  };

  const startEdit = (u) => { setEditVals(info(config, u.date, u.w)); setEditing(u.date); };

  const saveConfig = async () => {
    const ups = upcoming(config), u = ups.find((x) => x.date === editing);
    if (!u) return;
    const vals = { time: (editVals.time || "").trim(), price: (editVals.price || "").trim(), courts: (editVals.courts || "").trim(), note: (editVals.note || "").trim() };
    const dates = { ...(config.dates || {}) };
    ups.filter((x) => x.w.key === u.w.key && x.date !== u.date && !dates[x.date]).forEach((x) => { dates[x.date] = info(config, x.date, x.w); });
    dates[u.date] = vals;
    const next = { ...config, dates, weekly: { ...(config.weekly || {}), [u.w.key]: { ...vals, courts: "" } } };
    const { data, error } = await sb.from("settings").update({ data: next, updated_at: new Date().toISOString() }).eq("id", 1).select("id");
    if (error || !data || !data.length) { setStatus("Couldn’t save — please log in again. 保存没有成功，请重新登录。"); return; }
    setConfig(next); setEditing(null);
  };

  const doLogin = async () => {
    const acct = email.trim();
    const login = acct.includes("@") ? acct : `${acct}@${ORGANIZER_DOMAIN}`;
    const { error } = await sb.auth.signInWithPassword({ email: login, password: pass });
    if (error) { setLoginErr("Login failed. 登录失败。"); return; }
    setPass(""); setShowLogin(false);
  };

  const ups = mounted ? upcoming(config) : [];
  const tab = dayTab || (ups[0] && ups[0].w.key) || WEEKDAYS[0].key;

  return (
    <>
      <div className="wrap">
        <header>
          <div className="toprow">
            <button className="ghost findbtn" onClick={() => setShowMap(true)}>Can’t find the stadium?<Zh inline>找不到球馆？</Zh></button>
          </div>
          <h1>Freemans Bay Beginner Badminton<Zh>初学者羽毛球 报名</Zh></h1>
          <p style={{ color: "var(--ink)", fontWeight: 700, fontSize: "1.05rem", marginTop: 8 }}>
            Please bring cash when you come.<Zh style={{ fontWeight: 700, fontSize: ".85em" }}>来的时候请带现金。</Zh>
          </p>
          <p style={{ color: "var(--ink)", marginTop: 8 }}>Available from now until 12 December.<Zh>即日起至 12 月 12 日。</Zh></p>
          <p><b>Location</b><Zh inline>地点</Zh>：95 Wellington Street, Freemans Bay, Auckland 1011</p>
          <p className="notice">
            Add your name below to sign up — you can book up to two weeks ahead. Tick “Kid” if it’s a child. Max 12 people per session.
            <Zh>在下面写上自己的名字就算报名，可以提前两周报名。带小孩请勾上“小孩”。每场最多 12 人。</Zh>
          </p>
        </header>

        {IS_DEMO && (
          <div className="admin-bar" style={{ borderColor: "var(--kid)" }}>
            Preview mode — sign-ups here are not saved. Organizer login accepts any account/password.
            <Zh inline>预览模式：这里的报名不会保存，管理员登录随便输入即可。</Zh>
          </div>
        )}
        {isAdmin && (
          <div className="admin-bar">
            You’re logged in as organizer. Tap the box before a name to mark paid.
            <Zh inline>你已作为管理员登录，点名字前面的方框标记已付款</Zh>
            <button className="ghost" onClick={() => sb.auth.signOut()}>Log out<Zh inline>退出</Zh></button>
          </div>
        )}

        <div className="daytabs" role="tablist">
          {WEEKDAYS.map((w) => (
            <button key={w.key} role="tab" aria-selected={tab === w.key} className={tab === w.key ? "on" : ""} onClick={() => setDayTab(w.key)}>
              {w.day}<Zh inline>{w.zh}</Zh>
            </button>
          ))}
        </div>
        <div className="grid">
          {WEEKDAYS.map((w) => {
            const list = ups.filter((u) => u.w.key === w.key);
            return (
              <div className={"col" + (tab === w.key ? " on" : "")} key={w.key}>
                <h2 className="col-h">{w.day}<Zh>{w.zh}</Zh></h2>
                {mounted && !list.length && (
                  <div className="card"><span className="empty" style={{ margin: 0 }}>No more sessions<Zh inline>没有更多场次</Zh></span></div>
                )}
                {list.map((u) => (
                  <SessionCard key={u.date} u={u} c={info(config, u.date, u.w)} lock={locked(config, u.date, u.w)} rows={rows.filter((r) => r.session === u.date)}
                    isAdmin={isAdmin} mine={mine} pending={pending} busy={busy} agreed={agreed && loaded} declined={declined}
                    editing={editing === u.date} editVals={editVals} setEditVals={setEditVals}
                    onEdit={() => startEdit(u)} onSave={saveConfig} onCancel={() => setEditing(null)}
                    form={forms[u.date] || { name: "", kid: false }}
                    setForm={(v) => setForms((p) => ({ ...p, [u.date]: v }))}
                    onAdd={() => addEntry(u.date)} onDel={delEntry} onPaid={setPaid} people={people} onPerson={openPerson}
                    onReread={() => setShowNotice(true)} />
                ))}
              </div>
            );
          })}
        </div>

        {isAdmin && <Stats history={history} onPaid={setPaid} people={people} onPerson={openPerson} />}

        <div className="status">{status}</div>
        {!isAdmin && (
          <div className="foot">
            <button className="ghost" onClick={() => { setLoginErr(""); setShowLogin(true); }}>Organizer<Zh inline>管理员</Zh></button>
          </div>
        )}
      </div>

      {showMap && <ZoomViewer src="/directions.jpg" onClose={() => setShowMap(false)}
        alt="Directions: enter through the gate on Wellington Street (free street parking), the stadium is on your right." />}

      {showNotice && (
        <div className="overlay">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="n-title">
            <h2 id="n-title">Please note<Zh>请注意</Zh></h2>
            <p>Just a friendly heads-up: the ceiling at the Freemans Bay venue is a little low. If that’s a concern for you, it may be best not to come.</p>
            <p className="zh" style={{ fontSize: ".9rem" }}>Freemans Bay 场地的天花板会比较矮，如果您介意，请不要来。</p>
            <p><b>Cancelling:</b> please cancel at least 24 hours before the session starts. Within 24 hours you can’t remove your name, and if no one takes your spot you still need to pay.</p>
            <p className="zh" style={{ fontSize: ".9rem" }}><b>取消：</b>请至少在开场前 24 小时取消。开场前 24 小时内不能删除名字；如果没有人替补，仍需付款。</p>
            <div className="btns">
              <button className="ghost" onClick={() => { setAgreed(false); setDeclined(true); setShowNotice(false); }}>Cancel<Zh inline>取消</Zh></button>
              <button className="primary" onClick={() => { setAgreed(true); setDeclined(false); setShowNotice(false); }}>OK<Zh inline>好的</Zh></button>
            </div>
          </div>
        </div>
      )}

      {person && (() => {
        const groups = [...new Set(Object.values(people).map((p) => p.grp).filter(Boolean))].sort();
        const mates = person.grp.trim() ? Object.values(people).filter((p) => p.grp === person.grp.trim() && p.name_key !== keyOf(person.name)).map((p) => p.name) : [];
        return (
          <div className="overlay" onClick={(e) => e.target === e.currentTarget && setPerson(null)}>
            <div className="modal" role="dialog" aria-modal="true" aria-labelledby="p-title">
              <h2 id="p-title">{person.name}</h2>
              <p className="paidnote" style={{ marginTop: 0 }}>Only you (organizer) can see this.<Zh inline>只有管理员能看到。</Zh></p>
              <label className="paidnote">Phone 电话
                <input type="tel" value={person.phone} onChange={(e) => setPerson({ ...person, phone: e.target.value })} placeholder="e.g. 021 123 4567" maxLength={30} />
              </label>
              {person.phone.trim() && <p style={{ marginTop: 6 }}><a href={"tel:" + person.phone.replace(/[^\d+]/g, "")}>Call {person.phone.trim()}<Zh inline>拨打</Zh></a></p>}
              <label className="paidnote" style={{ display: "block", marginTop: 12 }}>Group 同一组（same name = same group 组名相同即为同组）
                <input type="text" list="grp-list" value={person.grp} onChange={(e) => setPerson({ ...person, grp: e.target.value })} placeholder="e.g. Wang family" maxLength={40} />
                <datalist id="grp-list">{groups.map((g) => <option key={g} value={g} />)}</datalist>
              </label>
              {mates.length > 0 && <p className="paidnote" style={{ marginTop: 6 }}>Same group 同组：{mates.join(", ")}</p>}
              <div className="err">{person.err}</div>
              <div className="btns">
                <button className="ghost" onClick={() => setPerson(null)}>Cancel<Zh inline>取消</Zh></button>
                <button className="primary" onClick={savePerson}>Save<Zh inline>保存</Zh></button>
              </div>
            </div>
          </div>
        );
      })()}

      {showLogin && (
        <div className="overlay">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="l-title">
            <h2 id="l-title">Organizer login<Zh>管理员登录</Zh></h2>
            <input type="text" inputMode="numeric" placeholder="Account number 账号" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input type="password" placeholder="Password 密码" autoComplete="current-password" value={pass}
              onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doLogin()} />
            <div className="err">{loginErr}</div>
            <div className="btns">
              <button className="ghost" onClick={() => setShowLogin(false)}>Cancel<Zh inline>取消</Zh></button>
              <button className="primary" onClick={doLogin}>Log in<Zh inline>登录</Zh></button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SessionCard({ u, c, lock, rows, isAdmin, mine, pending, busy, agreed, declined, editing, editVals, setEditVals,
  onEdit, onSave, onCancel, form, setForm, onAdd, onDel, onPaid, onReread, people, onPerson }) {
  const lb = label(u.date), full = rows.length >= CAP;
  const tbc = <>TBC<Zh inline>待定</Zh></>;
  const paidN = rows.filter((r) => r.paid).length;
  const field = (k) => ({ value: editVals[k] || "", onChange: (e) => setEditVals({ ...editVals, [k]: e.target.value }) });
  return (
    <section className="card">
      <div className="wk">{["This week · 本周", "Next week · 下周", "Week after next · 下下周"][u.week]}</div>
      <h3 className="day">{u.w.day.slice(0, 3)} {lb.en}<Zh>{lb.zh} {u.w.zh}</Zh></h3>

      {editing ? (
        <div className="edit">
          <label>Time 时间<input type="text" {...field("time")} /></label>
          <label>Price 价格<input type="text" {...field("price")} /></label>
          <label>Courts 场地<input type="text" {...field("courts")} /></label>
          <label>Note 备注<textarea rows={2} {...field("note")} /></label>
          <div className="btns"><button className="primary" onClick={onSave}>Save 保存</button><button className="ghost" onClick={onCancel}>Cancel 取消</button></div>
        </div>
      ) : (
        <>
          <ul className="meta">
            <li><b>Time<Zh>时间</Zh></b><span>{c.time}</span></li>
            <li><b>Price<Zh>价格</Zh></b><span>{c.price}</span></li>
            <li><b>Courts<Zh>场地</Zh></b><span>{c.courts || tbc}</span></li>
          </ul>
          {c.note && <div className="note">{c.note}</div>}
          {isAdmin && <div style={{ marginTop: 10 }}><button className="ghost" onClick={onEdit}>Edit time / courts<Zh inline>修改时间 / 场地</Zh></button></div>}
        </>
      )}

      <div className="count">
        <span>Signed up <strong>{rows.length}</strong> / {CAP}<Zh inline>已报名</Zh></span>
        {full && <span className="full">Full<Zh inline>已满</Zh></span>}
      </div>
      {isAdmin && rows.length > 0 && <div className="paidnote">Paid {paidN} / {rows.length}<Zh inline>已付款</Zh></div>}

      <ol>
        {!rows.length && <li className="empty">No one yet<Zh inline>还没有人报名</Zh></li>}
        {rows.map((e) => {
          const isMine = mine.includes(e.id), canDel = isAdmin || (isMine && !lock);
          return (
            <li key={e.id}>
              <div className="row">
                {isAdmin && <button className={"pay" + (e.paid ? " on" : "")} onClick={() => onPaid(e.id, !e.paid)} title="Paid 已付款" aria-label="Paid">{e.paid ? "✓" : ""}</button>}
                {isAdmin ? <button className="who" onClick={() => onPerson(e.name)}>{e.name}</button> : <span>{e.name}</span>}
                {e.kid && <span className="tag">Kid · 小孩</span>}
                {isAdmin && people[keyOf(e.name)]?.grp && <span className="gtag">{people[keyOf(e.name)].grp}</span>}
                {canDel ? (
                  <button className="x" onClick={() => onDel(e.id)}>
                    {pending === e.id ? <>Tap again to confirm<Zh inline>再点一次确认删除</Zh></> : <>Remove<Zh inline>删除</Zh></>}
                  </button>
                ) : isMine && (
                  <span className="x" style={{ cursor: "default" }}>Within 24h, can’t remove<Zh inline>24小时内不能取消</Zh></span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {agreed ? (
        <form onSubmit={(ev) => { ev.preventDefault(); onAdd(); }}>
          <input type="text" maxLength={40} placeholder={full ? "Full 已满" : "Your name 你的名字"} disabled={full} required
            value={form.name} onChange={(ev) => setForm({ ...form, name: ev.target.value })} />
          <label className="kid"><input type="checkbox" checked={!!form.kid} onChange={(ev) => setForm({ ...form, kid: ev.target.checked })} /> Kid<Zh inline>小孩</Zh></label>
          <button className="primary" disabled={full || busy}>Join<Zh inline>加入</Zh></button>
        </form>
      ) : declined ? (
        <div className="viewonly">View only — you can’t sign up.<Zh inline>仅可查看，不能报名</Zh>
          <button className="ghost" onClick={onReread}>Read notice again<Zh inline>重新阅读</Zh></button></div>
      ) : null}
    </section>
  );
}

function Stats({ history, onPaid, people, onPerson }) {
  const t = todayNZ(), groups = {};
  history.forEach((r) => {
    const k = String(r.name).trim().toLowerCase();
    (groups[k] = groups[k] || { name: String(r.name).trim(), items: [] }).items.push(r);
  });
  const arr = Object.values(groups).map((g) => {
    const unpaid = g.items.filter((r) => !r.paid).sort((a, b) => (a.session < b.session ? -1 : 1));
    return { ...g, unpaid, paid: g.items.length - unpaid.length, owed: unpaid.filter((r) => r.session <= t).length };
  }).sort((a, b) => b.owed - a.owed || b.unpaid.length - a.unpaid.length || b.items.length - a.items.length || a.name.localeCompare(b.name));

  return (
    <section className="card stats">
      <h2 className="col-h">Sign-ups &amp; payments<Zh>报名次数与付款统计</Zh></h2>
      <div className="paidnote">All sessions, grouped by name. Ticking or unticking a name’s box updates Unpaid straight away. Red dates are unpaid sessions that have already happened; grey ones are upcoming. Tap a date to mark it paid.
        <Zh>按名字统计所有场次。勾选或取消勾选名字前的方框，未付次数会马上更新。红框是已经打过但还没付款的，灰框是还没到的场次。点日期即可标记已付款。</Zh></div>
      {!arr.length ? (
        <div className="paidnote" style={{ marginTop: 12 }}>No sign-ups yet<Zh inline>还没有报名记录</Zh></div>
      ) : (
        <>
          <div className="tbl">
            <table>
              <thead><tr>
                <th>Name<Zh>名字</Zh></th><th>Times<Zh>报名次数</Zh></th><th>Unpaid<Zh>未付次数</Zh></th><th>Unpaid sessions<Zh>未付款场次</Zh></th>
              </tr></thead>
              <tbody>
                {arr.map((g) => (
                  <tr key={g.name.toLowerCase()}>
                    <td><button className="who" onClick={() => onPerson(g.name)}>{g.name}</button>{g.items.some((r) => r.kid) && <> <span className="tag">Kid · 小孩</span></>}
                      {people[keyOf(g.name)]?.grp && <> <span className="gtag">{people[keyOf(g.name)].grp}</span></>}</td>
                    <td>{g.items.length}</td>
                    <td className={g.owed ? "owe" : ""}>{g.unpaid.length}</td>
                    <td>
                      {g.unpaid.length ? g.unpaid.map((r) => {
                        const w = WEEKDAYS.find((x) => x.dow === dowOf(r.session)), lb = label(r.session);
                        return <button key={r.id} className={"chip" + (r.session > t ? " future" : "")} onClick={() => onPaid(r.id, true)} title="Mark paid 标记已付款">{w ? w.day.slice(0, 3) + " " : ""}{lb.en}</button>;
                      }) : <span className="paidnote">All paid<Zh inline>已全部付清</Zh></span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="paidnote">Names are matched by spelling (not case), so “Amy” and “amy” count as the same person, but “Amy W” is counted separately.
            <Zh>名字按拼写匹配（不分大小写），写法不同会被算成不同的人。</Zh></div>
        </>
      )}
    </section>
  );
}

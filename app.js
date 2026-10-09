/* ============ CONFIG ============ */
const API_URL = "https://script.google.com/macros/s/AKfycby6rvrLqLvCQc9PNPyjFss0y9Nuam0K4TaCYTT_KKr3IGWqKI0Ppfwhp5W2Y6F0hNEG/exec"; // see README
const CACHE_MS = 60000;                                     // reuse data for 60s
/* ================================ */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num = v => Number(v) || 0;
const key = s => String(s ?? "").trim().toLowerCase();
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const DEMO = !API_URL.startsWith("http");
const PREVIEW = new URLSearchParams(location.search).has("preview"); // ?preview=1 skips the schedule
const CROWN = `<svg class="ci" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18l1.5-10-5 4L12 4 7.5 12l-5-4zM4 20h16v2H4z"/></svg>`;

/* ---------- Opening schedule (Asia/Kolkata, UTC+5:30, no DST) ---------- */
const IST = 5.5 * 36e5, DAY = 864e5;
const OPEN_HOUR = 10;      // opens at 10:00 AM IST
const OPEN_FOR = 2 * DAY;  // stays live for 48 hours
function windows(now) {
  const d = new Date(now + IST), out = [];
  for (let k = -1; k <= 1; k++) {
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k, 1));
    const y = t.getUTCFullYear(), m = t.getUTCMonth();
    const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    [10, 20, 30].forEach(day => { const s = Date.UTC(y, m, Math.min(day, dim), OPEN_HOUR) - IST; out.push([s, s + OPEN_FOR]); }); // 30th -> last day in short months
  }
  return out.sort((a, b) => a[0] - b[0]);
}
function status(now = Date.now()) {
  const w = windows(now), cur = w.find(x => now >= x[0] && now < x[1]);
  return cur ? { open: true, end: cur[1] } : { open: false, next: w.find(x => x[0] > now)[0] };
}
const p2 = n => String(n).padStart(2, "0");
function parts(ms) { ms = Math.max(0, ms); return { d: Math.floor(ms / DAY), h: Math.floor(ms % DAY / 36e5), m: Math.floor(ms % 36e5 / 6e4), s: Math.floor(ms % 6e4 / 1e3) }; }
const fmtDate = ms => new Date(ms).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/* ---------- Data (cached, de-duplicated) ---------- */
const store = {}, inflight = {};
async function load(kind, force) {
  const c = store[kind];
  if (!force && c && Date.now() - c.t < CACHE_MS) return c.d;
  if (inflight[kind]) return inflight[kind];
  inflight[kind] = (DEMO ? Promise.resolve(demo(kind)) : fetch(`${API_URL}?action=${kind}`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(j => { if (j.error) throw new Error(j.error); return j.data; }))
    .then(d => (store[kind] = { t: Date.now(), d }, d)).finally(() => delete inflight[kind]);
  return inflight[kind];
}
function demo(kind) { // sample data so the UI works before the API is connected
  const T = ["Alpha Lions", "Blue Titans", "Crown Hawks", "Delta Storm"], names = "Aarav Bhavna Chirag Diya Esha Farhan Gauri Hemant Isha Jay Kabir Lata".split(" ");
  if (kind === "team") return T.map((t, i) => ({ Team: t, "Total Score": 980 - i * 130, Rank: i + 1, "Prev Rank": [2, 1, 3, 4][i], "Team Logo": "", lastSeasonWinner: i === 1 }));
  return names.map((n, i) => ({ Name: n, Team: T[i % 4], Score: 320 - i * 21, Rank: i + 1, "Total SV": 9 - (i >> 1), "Total VC": 6, "Total F2F": 4, "Total Token": 3, "Total Booking": 2, "Team Logo": "" }));
}

/* ---------- Helpers ---------- */
const initials = n => esc(String(n || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase());
function pic(url, name, cls) {
  const ini = initials(name);
  return /^https?:/.test(url || "") ? `<img class="${cls}" src="${esc(url)}" alt="" loading="lazy" onerror="this.outerHTML='<span class=&quot;${cls}&quot;><span class=ini>${ini}</span></span>'">` : `<span class="${cls}"><span class="ini">${ini}</span></span>`;
}
function move(t) {
  const r = num(t.Rank), p = num(t["Prev Rank"]);
  let ch = p && r ? p - r : num(t["Rank Change"]);
  return ch > 0 ? `<span class="mv up">▲ ${ch}</span>` : ch < 0 ? `<span class="mv dn">▼ ${-ch}</span>` : `<span class="mv eq">– same</span>`;
}
function countUp(root) {
  root.querySelectorAll("[data-n]").forEach(el => {
    const to = num(el.dataset.n); if (RM) return el.textContent = to;
    const t0 = performance.now();
    (function f(t) { const k = Math.min(1, (t - t0) / 800); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(f); })(t0);
  });
}
const loadingHTML = `<div class="state"><div class="ball"></div><b>Entering the League...</b></div>`;
const errHTML = k => `<div class="state"><b>Couldn't load the scores.</b><p>Check your connection and try again.</p><button class="btn" onclick="show('${k}',true)">Retry</button></div>`;
const emptyHTML = `<div class="state"><b>No scores yet.</b><p>The leaderboard fills up once the first points are in.</p></div>`;
const sorted = a => [...a].sort((x, y) => (num(x.Rank) || 999) - (num(y.Rank) || 999));

/* ---------- Views ---------- */
function renderIndividual(list) {
  if (!list.length) return emptyHTML;
  const L = sorted(list), top = L.slice(0, 3);
  const pod = [1, 0, 2].filter(i => top[i]).map(i => { const p = top[i]; return `<div class="pod p${i + 1}"><div class="m">${i === 0 ? CROWN : `<span class="mdl">${i + 1}</span>`}</div>${pic(p["Team Logo"], p.Name, "av")}<div class="nm">${esc(p.Name)}</div><div class="tm">${esc(p.Team)}</div><div class="sc" data-n="${num(p.Score)}">0</div></div>`; }).join("");
  const rows = L.slice(3).map((p, i) => `<div class="row" style="--i:${i}"><div class="rk">${esc(p.Rank)}</div><div class="info"><b>${esc(p.Name)}</b><small>${esc(p.Team)} · SV ${num(p["Total SV"])} · VC ${num(p["Total VC"])} · F2F ${num(p["Total F2F"])} · Tok ${num(p["Total Token"])} · Bk ${num(p["Total Booking"])}</small></div><div class="pts" data-n="${num(p.Score)}">0</div></div>`).join("");
  return `<h3 class="t">Individual Leaderboard</h3><div class="podium">${pod}</div>${rows}`;
}
function renderTeam(list) {
  if (!list.length) return emptyHTML;
  const L = sorted(list), lead = L[0];
  const hero = `<button class="hero" data-t="${esc(lead.Team)}">${pic(lead["Team Logo"], lead.Team, "lg")}<div class="info"><div class="lead">${CROWN}Leading the league</div><h4>${esc(lead.Team)}</h4></div><div class="pts"><span data-n="${num(lead["Total Score"])}">0</span><small>points</small></div></button>`;
  const rows = L.slice(1).map((t, i) => `<button class="row" style="--i:${i}" data-t="${esc(t.Team)}"><div class="rk">${esc(t.Rank)}</div>${pic(t["Team Logo"], t.Team, "lg")}<div class="info"><b>${esc(t.Team)}${t.lastSeasonWinner === true || key(t.lastSeasonWinner) === "true" || key(t.lastSeasonWinner) === "yes" ? '<span class="crown">S4 CHAMPS</span>' : ""}</b>${move(t)}</div><div class="pts"><span data-n="${num(t["Total Score"])}">0</span><small>points</small></div></button>`).join("");
  return `<h3 class="t">Team Leaderboard</h3>${hero}${rows}`;
}
async function openTeam(name) {
  const box = $("#detail");
  box.innerHTML = loadingHTML; box.classList.add("show"); box.setAttribute("aria-hidden", "false");
  try {
    const [teams, inds] = await Promise.all([load("team"), load("individual")]); // both reused from cache if already loaded
    const t = teams.find(x => key(x.Team) === key(name)), M = sorted(inds.filter(i => key(i.Team) === key(name)));
    const sum = f => M.reduce((a, m) => a + num(m[f]), 0), top = M[0];
    box.innerHTML = `<div class="dh"><button class="back" id="back">← Back</button>${pic(t?.["Team Logo"], name, "lg")}<h3>${esc(name)}</h3><div>Rank #${esc(t?.Rank ?? "-")} ${t ? move(t).replace("mv ", "mv on ") : ""}</div></div>
    <div class="stats"><div class="stat"><b data-n="${num(t?.["Total Score"])}">0</b><small>Team score</small></div><div class="stat"><b>${M.length}</b><small>Players</small></div><div class="stat"><b data-n="${M.length ? Math.round(sum("Score") / M.length) : 0}">0</b><small>Avg score</small></div><div class="stat"><b>${sum("Total SV")}</b><small>Site visits</small></div><div class="stat"><b>${sum("Total Token")}</b><small>Tokens</small></div><div class="stat"><b>${sum("Total Booking")}</b><small>Bookings</small></div></div>
    <div class="mem">${M.length ? `<h3 class="t" style="margin-top:8px">Squad${top ? " · Top: " + esc(top.Name) : ""}</h3>` + M.map((m, i) => `<div class="row" style="--i:${i}"><div class="rk">${esc(m.Rank)}</div><div class="info"><b>${esc(m.Name)}</b><small>Individual rank #${esc(m.Rank)}</small></div><div class="pts"><span data-n="${num(m.Score)}">0</span><small>points</small></div></div>`).join("") : emptyHTML}</div>`;
    $("#back").onclick = closeTeam; countUp(box); box.scrollTop = 0;
  } catch (e) { box.innerHTML = `<div class="dh"><button class="back" id="back">← Back</button></div>` + errHTML("team").replace(/onclick="[^"]*"/, `onclick="openTeam('${esc(name).replace(/'/g, "\\'")}')"`); $("#back").onclick = closeTeam; }
}
function closeTeam() { const b = $("#detail"); b.classList.remove("show"); b.setAttribute("aria-hidden", "true"); }

/* ---------- Navigation ---------- */
let current = "individual";
const rendered = {};
async function show(v, force) {
  const el = $("#" + v);
  if (v !== current) {
    $("#" + current).hidden = true; el.hidden = false; current = v;
    el.classList.remove("enter"); void el.offsetWidth; el.classList.add("enter");
    document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("on", b.dataset.v === v));
    $("#nav").classList.toggle("t", v === "team");
  }
  if (rendered[v] && !force && store[v] && Date.now() - store[v].t < CACHE_MS) return;
  if (!rendered[v] || force) el.innerHTML = loadingHTML;
  try {
    const data = await load(v, force);
    el.innerHTML = v === "individual" ? renderIndividual(data) : renderTeam(data);
    rendered[v] = true; countUp(el);
    el.querySelectorAll("[data-t]").forEach(b => b.onclick = () => openTeam(b.dataset.t));
  } catch (e) { el.innerHTML = errHTML(v); }
}
document.querySelectorAll("#nav button").forEach(b => b.onclick = () => show(b.dataset.v));
$("#refresh").onclick = async () => { const r = $("#refresh"); r.classList.add("spin"); await show(current, true); setTimeout(() => r.classList.remove("spin"), 400); };
document.addEventListener("keydown", e => e.key === "Escape" && closeTeam());

/* ---------- Open / closed gate ---------- */
let wasOpen = null;
function tick() {
  const now = Date.now(), s = PREVIEW ? { open: true, end: now + 36e5 * 48 } : status(now), pill = $("#pill"), c = $("#closed");
  if (s.open) {
    const p = parts(s.end - now), soon = s.end - now < 36e5 * 3;
    pill.className = "pill " + (soon ? "warn" : "open");
    pill.textContent = (soon ? "Closing " : "Open · closes ") + (p.d ? `${p.d}d ` : "") + `${p2(p.h)}:${p2(p.m)}:${p2(p.s)}`;
    if (wasOpen !== true) { c.hidden = true; if (wasOpen === false || wasOpen === null) show(current); }
  } else {
    const p = parts(s.next - now); pill.className = "pill"; pill.textContent = "Resting";
    c.hidden = false;
    if (!c.firstChild) c.innerHTML = `<img class="logo" src="assets/logo.webp" alt="TPL Season 5 – Stronger. Bolder."><h1>The league is resting</h1><p></p><div class="cd"></div>`; // built once so the logo animation doesn't restart
    c.querySelector("p").textContent = `The arena reopens on ${fmtDate(s.next)} IST.`;
    c.querySelector(".cd").innerHTML = [["d", "days"], ["h", "hrs"], ["m", "min"], ["s", "sec"]].map(([k, l]) => `<div><b>${p2(p[k])}</b><small>${l}</small></div>`).join("");
  }
  wasOpen = s.open;
}
tick(); setInterval(tick, 1000);

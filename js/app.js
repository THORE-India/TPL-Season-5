(() => {
const C = window.CONFIG, $ = s => document.querySelector(s), OFF = 19800000; // IST = UTC+5:30, no DST
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalizeName = s => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const num = v => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return isFinite(n) ? n : 0; };
const bool = v => v === true || String(v).trim().toUpperCase() === 'TRUE';
const fmt = n => Math.round(n).toLocaleString('en-IN');
const enc = s => encodeURIComponent(s);
const S = { d: null, offset: 0, updated: null, stale: false, err: null, fetchedAt: null };

/* ---------- images ---------- */
function resolveImageUrl(v) {
  v = String(v || '').trim(); if (!v) return '';
  const m = v.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=|thumbnail\?id=)([\w-]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w200`;
  if (/^https?:\/\//i.test(v)) return v;
  return 'assets/logos/' + v.replace(/^\/+/, '');
}
const initials = t => String(t || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const logo = (t, u) => { const s = resolveImageUrl(u); return `<span class="lg"><i>${esc(initials(t))}</i>${s ? `<img src="${esc(s)}" alt="${esc(t)} logo" loading="lazy" onerror="this.remove()">` : ''}</span>`; };

/* ---------- status engine (Asia/Kolkata) ---------- */
const now = () => Date.now() + S.offset;
function getAppStatus(t = now()) {
  const d = new Date(t + OFF), y = d.getUTCFullYear(), m = d.getUTCMonth();
  let cur = null, next = Infinity;
  for (let k = -1; k <= 2; k++) for (const day of C.OPEN_DAYS) {
    const u = Date.UTC(y, m + k, day);
    if (new Date(u).getUTCDate() !== day) continue;          // skips nonexistent dates (e.g. 30 Feb)
    const s = u - OFF, e = s + C.OPEN_HOURS * 36e5;
    if (t >= s && t < e) cur = { s, e }; else if (s > t && s < next) next = s;
  }
  return cur ? { isOpen: true, status: 'OPEN', currentOpenTime: cur.s, currentCloseTime: cur.e, nextOpenTime: next, millisecondsRemaining: cur.e - t }
             : { isOpen: false, status: 'CLOSED', currentOpenTime: null, currentCloseTime: null, nextOpenTime: next, millisecondsRemaining: next - t };
}
const fmtIST = ms => new Date(ms).toLocaleString('en-GB', { timeZone: C.TIMEZONE, day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).replace(',', ' •').toUpperCase();
const parts = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return [Math.floor(s / 86400), Math.floor(s % 86400 / 3600), Math.floor(s % 3600 / 60), s % 60].map(n => String(n).padStart(2, '0')); };
const timerHTML = ms => { const v = parts(ms); return `<div class="timer" role="timer" aria-label="Countdown">${['D','H','M','S'].map((l, i) => `<div><b data-t="${i}">${v[i]}</b><small>${l}</small></div>`).join('')}</div>`; };
function statusHTML() {
  const a = getAppStatus();
  return a.isOpen
    ? `<div class="st live">⚔ TPL ARENA IS LIVE</div>${timerHTML(a.millisecondsRemaining)}<div class="st">BATTLE CLOSES IN</div><p class="dates">OPENED: ${fmtIST(a.currentOpenTime)} &nbsp; CLOSES: ${fmtIST(a.currentCloseTime)}</p>`
    : `<div class="closed"><svg class="glow"><use href="#emb"/></svg></div><div class="st">THE ARENA IS CLOSED<br>THE LIONS ARE RESTING</div>${timerHTML(a.millisecondsRemaining)}<div class="st">NEXT BATTLE OPENS IN</div><p class="dates">NEXT OPENING: ${fmtIST(a.nextOpenTime)}</p>`;
}
let lastState = null;
function tick() {
  const a = getAppStatus();
  if (lastState !== null && a.status !== lastState) { const h = $('#status'); if (h) h.innerHTML = statusHTML(); load(true); }
  lastState = a.status;
  const v = parts(a.millisecondsRemaining);
  document.querySelectorAll('[data-t]').forEach(e => e.textContent = v[e.dataset.t]);
}

/* ---------- data ---------- */
function build(j) {
  const rk = a => a.sort((x, y) => x.rank - y.rank);
  const teams = rk((j.teams || []).filter(t => t && t.team).map(t => ({ ...t, totalScore: num(t.totalScore), rank: num(t.rank) || 9999, prevRank: num(t.prevRank), rankChange: num(t.rankChange), lastSeasonWinner: bool(t.lastSeasonWinner) })));
  const teamsByName = {}; teams.forEach(t => teamsByName[normalizeName(t.team)] = t);
  const inds = rk((j.individuals || []).filter(p => p && p.name).map(p => ({ ...p, score: num(p.score), rank: num(p.rank) || 9999, rankChange: num(p.rankChange), totalSV: num(p.totalSV), totalVC: num(p.totalVC), totalF2F: num(p.totalF2F), totalToken: num(p.totalToken), totalBooking: num(p.totalBooking), ultimateWinner: bool(p.ultimateWinner), secondPlace: bool(p.secondPlace), thirdPlace: bool(p.thirdPlace), teamLogo: p.teamLogo || (teamsByName[normalizeName(p.team)] || {}).teamLogo })));
  const individualsByName = {}; inds.forEach(p => individualsByName[normalizeName(p.name)] = p);
  const scoresByExecutive = {};
  (j.scores || []).forEach(r => { if (!r || !r.executiveName) return; (scoresByExecutive[normalizeName(r.executiveName)] ||= []).push({ ...r, ts: Date.parse(r.date) || 0, siteVisits: num(r.siteVisits), vcs: num(r.vcs), f2fs: num(r.f2fs), token: num(r.token), booking: num(r.booking), dsr: num(r.dsr), additionalPoints: num(r.additionalPoints), negativePoints: num(r.negativePoints), dailyTotal: num(r.dailyTotal) }); });
  Object.values(scoresByExecutive).forEach(a => a.sort((x, y) => y.ts - x.ts));
  return { teams, inds, teamsByName, individualsByName, scoresByExecutive };
}
async function load(silent) {
  if (!silent) $('#view').innerHTML = '<div class="msg"><svg width="70" height="78" style="animation:br 2s infinite"><use href="#emb"/></svg><h2>ENTERING THE ARENA...</h2></div><div class="sk"></div><div class="sk"></div><div class="sk"></div>';
  try {
    if (C.USE_MOCK_DATA) throw new Error('Mock data not bundled');
    if (!C.API_URL || C.API_URL.startsWith('YOUR_')) throw new Error('API_URL not configured in js/config.js');
    const t0 = Date.now(), r = await fetch(C.API_URL + (C.API_URL.includes('?') ? '&' : '?') + 'action=all', { cache: 'no-store' });
    const j = await r.json(); if (!j.success) throw new Error(j.error || 'API returned success:false');
    if (j.serverTime) S.offset = Date.parse(j.serverTime) - (t0 + Date.now()) / 2;  // corrects a wrong device clock
    S.d = build(j); S.updated = j.updatedAt || new Date().toISOString(); S.stale = false; S.err = null; S.fetchedAt = new Date();
    try { localStorage.setItem(C.CACHE_KEY, JSON.stringify({ j, at: S.updated })); } catch (e) {}
  } catch (e) {
    S.err = e.message;
    try { const c = JSON.parse(localStorage.getItem(C.CACHE_KEY)); if (c) { S.d = build(c.j); S.updated = c.at; S.stale = true; } } catch (x) {}
  }
  render();
}

/* ---------- components ---------- */
const mv = n => n > 0 ? `<span class="mv up">▲ +${n}</span>` : n < 0 ? `<span class="mv dn">▼ ${n}</span>` : `<span class="mv eq">— 0</span>`;
const rkN = r => r < 9999 ? String(r).padStart(2, '0') : '—';
const badge = p => p.ultimateWinner ? '<span class="bd g">SEASON CHAMPION</span>' : p.secondPlace ? '<span class="bd s">RUNNER UP</span>' : p.thirdPlace ? '<span class="bd b">THIRD PLACE</span>' : '';
const pc = p => `<a class="card" href="#/player/${enc(p.name)}"><b class="rk">#${rkN(p.rank)}</b>${logo(p.team, p.teamLogo)}<div class="nm"><strong>${esc(p.name)}</strong><small>${esc(p.team)}</small> ${badge(p)}</div><div class="sc"><b>${fmt(p.score)}</b><small>POINTS</small>${mv(p.rankChange)}</div></a>`;
const tc = t => `<a class="card tm ${t.rank === 1 ? 'top' : ''}" href="#/team/${enc(t.team)}"><b class="rk">#${rkN(t.rank)}</b>${logo(t.team, t.teamLogo)}<div class="nm"><strong>${esc(t.team)}</strong>${t.rank === 1 ? '<span class="bd g">CURRENT LEADER</span>' : ''} ${t.lastSeasonWinner ? '<span class="bd d">DEFENDING CHAMPIONS</span>' : ''}</div><div class="sc"><b>${fmt(t.totalScore)}</b><small>POINTS</small>${mv(t.rankChange)}</div></a>`;
const podium = a => a.length ? `<div class="pod">${a.slice(0, 3).map((p, i) => `<a class="card p ${'gsb'[i]}" href="#/player/${enc(p.name)}"><b class="rk">${i === 0 ? '👑 ' : ''}#${i + 1}</b>${logo(p.team, p.teamLogo)}<strong>${esc(p.name)}</strong><small>${esc(p.team)}</small><div class="sc"><b>${fmt(p.score)}</b><small>POINTS</small></div>${mv(p.rankChange)}${badge(p)}</a>`).join('')}</div>` : '';
const empty = '<div class="msg"><h2>NO PLAYERS FOUND</h2><p>THE ARENA IS QUIET.</p></div>';

/* ---------- views ---------- */
function home(d) {
  const tot = d.teams.reduce((s, t) => s + t.totalScore, 0), movers = d.inds.filter(p => p.rankChange > 0).sort((a, b) => b.rankChange - a.rankChange).slice(0, 5);
  const hi = [...d.inds].sort((a, b) => b.score - a.score)[0], wins = d.inds.filter(p => p.ultimateWinner || p.secondPlace || p.thirdPlace), def = d.teams.filter(t => t.lastSeasonWinner);
  return `<section class="hero"><svg width="64" height="70"><use href="#emb"/></svg><h1>THREE LIONS • TPL SEASON 5</h1><p>Every Point Counts. Every Rank Matters.</p><div id="status">${statusHTML()}</div></section>
  <div class="stats"><div class="stat"><b>${d.teams.length}</b><small>TEAMS</small></div><div class="stat"><b>${d.inds.length}</b><small>PLAYERS</small></div><div class="stat"><b>${fmt(tot)}</b><small>TOTAL POINTS</small></div><div class="stat"><b style="font-size:16px">${esc(d.inds[0]?.name || '—')}</b><small>CURRENT LEADER</small></div></div>
  <h2>THE INDIVIDUAL LEAGUE <a href="#/players">VIEW ALL ›</a></h2>${podium(d.inds)}${d.inds.slice(3, 8).map(pc).join('')}
  <h2>THE TEAM LEAGUE <a href="#/teams">VIEW ALL ›</a></h2>${d.teams.slice(0, 5).map(tc).join('') || empty}
  <h2>THE RACE IS ON</h2><div class="stats"><div class="stat"><small>#1 INDIVIDUAL</small><b style="font-size:15px">${esc(d.inds[0]?.name || '—')}</b></div><div class="stat"><small>#1 TEAM</small><b style="font-size:15px">${esc(d.teams[0]?.team || '—')}</b></div><div class="stat"><small>HIGHEST SCORE</small><b style="font-size:15px">${hi ? esc(hi.name) + ' • ' + fmt(hi.score) : '—'}</b></div><div class="stat"><small>BIGGEST JUMP</small><b style="font-size:15px">${movers[0] ? esc(movers[0].name) + ' ▲' + movers[0].rankChange : '—'}</b></div></div>
  ${movers.length ? `<h2>POWER MOVERS</h2><div class="scroll">${movers.map(pc).join('')}</div>` : ''}
  ${wins.length || def.length ? `<h2>CHAMPIONS WALL</h2>${wins.sort((a, b) => a.rank - b.rank).map(pc).join('')}${def.map(tc).join('')}` : ''}`;
}
let q = {};
function players(d) {
  const teams = [...new Set(d.inds.map(p => p.team).filter(Boolean))].sort();
  const a = d.inds.filter(p => (!q.team || p.team === q.team) && (!q.q || normalizeName(p.name + ' ' + p.team).includes(normalizeName(q.q))));
  if (q.sort === 'score') a.sort((x, y) => y.score - x.score); else if (q.sort === 'name') a.sort((x, y) => x.name.localeCompare(y.name));
  const tm = q.q ? d.teams.filter(t => normalizeName(t.team).includes(normalizeName(q.q))) : [];
  const plain = !q.q && !q.team && !q.sort;
  return `<h2>INDIVIDUAL LEAGUE</h2><div class="tools"><input id="q" type="search" placeholder="🔍 Search player or team" aria-label="Search player or team" value="${esc(q.q || '')}"><select id="ft" aria-label="Team filter"><option value="">All teams</option>${teams.map(t => `<option ${t === q.team ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select><select id="so" aria-label="Sort"><option value="">Sort: Rank</option><option value="score" ${q.sort === 'score' ? 'selected' : ''}>Sort: Score</option><option value="name" ${q.sort === 'name' ? 'selected' : ''}>Sort: Name</option></select></div>
  ${tm.map(tc).join('')}${plain ? podium(a) + a.slice(3).map(pc).join('') : a.map(pc).join('') || empty}`;
}
const teamsView = d => `<h2>TEAM LEAGUE</h2>${d.teams.map(tc).join('') || empty}`;
function teamDetail(d, name) {
  const t = d.teamsByName[normalizeName(name)]; if (!t) return empty;
  const m = d.inds.filter(p => normalizeName(p.team) === normalizeName(t.team));
  return `<a href="#/teams" class="dates">‹ TEAMS</a><h2>THE LION'S DEN</h2>${tc(t)}<h2>TEAM MEMBERS</h2><div class="two">${m.map(p => `<div>${pc(p)}<div class="grid" style="margin:-2px 0 10px">${[['SV', p.totalSV], ['VC', p.totalVC], ['F2F', p.totalF2F], ['TOKEN', p.totalToken], ['BOOKING', p.totalBooking]].map(x => `<div><b>${x[1]}</b><small>${x[0]}</small></div>`).join('')}</div></div>`).join('') || empty}</div>`;
}
function chart(h) {
  const a = [...h].reverse().slice(-30); if (a.length < 2) return '';
  const mx = Math.max(...a.map(x => x.dailyTotal), 1), w = 300 / a.length;
  return `<h2>DAILY TOTAL</h2><div class="chart"><svg viewBox="0 0 300 100" preserveAspectRatio="none" role="img" aria-label="Daily total chart">${a.map((x, i) => { const hh = Math.max(0, x.dailyTotal) / mx * 96; return `<rect x="${i * w + 1}" y="${100 - hh}" width="${w - 2}" height="${hh}" fill="#d4af37" rx="1"><title>${esc(x.date)}: ${x.dailyTotal}</title></rect>`; }).join('')}</svg></div>`;
}
function playerDetail(d, name) {
  const p = d.individualsByName[normalizeName(name)]; if (!p) return empty;
  const h = d.scoresByExecutive[normalizeName(p.name)] || [], sg = n => (n > 0 ? '+' : '') + n;
  return `<a href="#/team/${enc(p.team)}" class="dates">‹ ${esc(p.team)}</a><h2>PLAYER DETAILS</h2>${pc(p)}
  <div class="grid">${[['SITE VISITS', p.totalSV], ['VCs', p.totalVC], ['F2Fs', p.totalF2F], ['TOKENS', p.totalToken], ['BOOKINGS', p.totalBooking]].map(x => `<div><b>${x[1]}</b><small>${x[0]}</small></div>`).join('')}</div>
  ${chart(h)}<h2>PERFORMANCE HISTORY</h2>${h.map(r => `<details><summary><span>${esc(String(r.date).slice(0, 10).split('-').reverse().join('/'))}</span><span>${fmt(r.dailyTotal)} pts</span></summary><div class="in"><div><b>${r.siteVisits}</b>SV</div><div><b>${r.vcs}</b>VC</div><div><b>${r.f2fs}</b>F2F</div><div><b>${r.token}</b>TOKEN</div><div><b>${r.booking}</b>BOOKING</div><div><b>${sg(r.dsr)}</b>DSR</div><div><b>${sg(r.additionalPoints)}</b>BONUS</div><div><b>${sg(r.negativePoints)}</b>PENALTY</div></div></details>`).join('') || empty}`;
}
const about = () => `<h2>ABOUT TPL SEASON 5</h2><div class="card" style="display:block"><p>The arena opens on the 10th, 20th and 30th of each month at 12:00 AM IST and stays open for 48 hours. Ranks and scores are calculated in the league sheets; this app only displays them.</p></div>`;

/* ---------- router ---------- */
function render() {
  const v = $('#view'), h = location.hash.replace(/^#\/?/, '') || 'home', [r, ...rest] = h.split('/'), arg = decodeURIComponent(rest.join('/'));
  const tab = r === 'team' ? 'teams' : r === 'player' ? 'players' : r;
  document.querySelectorAll('[data-r]').forEach(a => a.classList.toggle('on', a.dataset.r === tab));
  document.querySelectorAll('.dnav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#/' + tab));
  if (!S.d) { v.innerHTML = `<div class="msg"><svg width="70" height="78"><use href="#emb"/></svg><h2>THE ARENA CONNECTION IS UNAVAILABLE</h2><p>Unable to load the latest league data.</p><p class="dates">${esc(S.err || '')}</p><button class="btn" id="retry">RETRY</button></div>`; $('#retry').onclick = () => load(); return; }
  const d = S.d, views = { home: () => home(d), players: () => players(d), teams: () => teamsView(d), team: () => teamDetail(d, arg), player: () => playerDetail(d, arg), about };
  v.innerHTML = `<div class="view">${S.err ? `<div class="banner">${S.stale ? 'Connection lost — showing last saved data.' : 'Update failed.'} <button class="btn" style="min-height:36px;margin:0 0 0 8px" id="retry">RETRY</button></div>` : ''}${(views[r] || views.home)()}</div>`;
  const rt = $('#retry'); if (rt) rt.onclick = () => load(true);
  if (r === 'players') {
    const up = () => { q = { q: $('#q').value, team: $('#ft').value, sort: $('#so').value }; const pos = $('#q').selectionStart, f = document.activeElement.id; render(); const el = $('#' + f); if (el) { el.focus(); if (f === 'q') el.setSelectionRange(pos, pos); } };
    $('#q').oninput = up; $('#ft').onchange = up; $('#so').onchange = up;
  }
  const dt = S.updated ? new Date(S.updated).toLocaleString('en-GB', { timeZone: C.TIMEZONE, day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase() : '—';
  $('#upd').textContent = (S.stale ? 'LAST UPDATED: ' : 'DATA UPDATED: ') + dt;
  const dbg = $('#dbg'); if (C.DEBUG_MODE) { dbg.hidden = false; const a = getAppStatus(); dbg.textContent = `API: ${C.API_URL}\nFetched: ${S.fetchedAt}\nTeams: ${d.teams.length} Individuals: ${d.inds.length} Score rows: ${Object.values(d.scoresByExecutive).reduce((s, x) => s + x.length, 0)}\nStatus: ${a.status}\nServer offset ms: ${Math.round(S.offset)}`; }
}
let lastRoute = '';
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
$('#refresh').onclick = () => load(true);
const sp = $('#splash'); if (sessionStorage.getItem('tpl5s')) sp.remove(); else { sessionStorage.setItem('tpl5s', 1); setTimeout(() => { sp.classList.add('out'); setTimeout(() => sp.remove(), 600); }, 1500); }
setInterval(tick, 1000); setInterval(() => load(true), C.REFRESH_MS);
load();
})();

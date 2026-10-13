import { newGame, BOTS as CLASSIC, VAL } from './engine.js';
import { Uci, SF_BOTS, ANALYSIS, pickLegal } from './uci.js';
const $ = id => document.getElementById(id);
const VS = '\uFE0E'; // force text (not emoji) glyphs on iOS
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const INFO = {
  real: '<b class="tag">Real Chess</b> Official rules, refereed by chess.js. Bots are <b>Stockfish 19</b> (running in your browser) at different strengths; every engine move is double-checked for legality. Ratings are rough estimates.',
  chaos: '<b class="tag">No Rules</b> 🌪️ Any piece can teleport to any square (not onto its own team). No check. Capture the enemy king to win — but 🛡️ <b>Royal Shield</b>: only a piece within 2 squares of a king can grab it. 200-ply cap = draw. <b>Uses the Chaos bots</b>: real engines like Stockfish only know real chess. Eval bar shows material.'
};
// ---------- engines ----------
const mkEngine = () => { const w = new Worker('js/stockfish/stockfish-19-lite-single.js'); const u = new Uci(l => w.postMessage(l)); w.onmessage = e => typeof e.data === 'string' && u.feed(e.data); w.onerror = e => console.error('Stockfish worker error', e.message); return u; };
const player = mkEngine(), analyst = mkEngine();
let engineReady = false;
Promise.all([player.init(), analyst.init()]).then(() => { engineReady = true; if (!started) status('Stockfish ready. Pick players and press Start.'); }).catch(e => status('Engine failed to load: ' + e.message));
// ---------- sounds (WebAudio, generated) ----------
let ac; const beep = (f, d, type = 'sine', v = .15, when = 0) => {
  if (!ac) return; try { const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + when;
    o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * .6, t + d); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d); } catch {}
};
const SND = { move: () => beep(520, .07, 'triangle'), capture: () => { beep(300, .09, 'square', .1); beep(180, .1, 'triangle', .15, .03); }, check: () => { beep(880, .08, 'sine', .15); beep(1100, .1, 'sine', .12, .08); }, end: () => [523, 659, 784].forEach((f, i) => beep(f, .25, 'sine', .14, i * .12)) };
['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, () => { try { ac ||= new (window.AudioContext || window.webkitAudioContext)(); ac.resume?.(); } catch {} }, { capture: true }));
// ---------- state ----------
let mode = 'real', g, snaps, ucis, evals, viewPly = null, orient = 'w', sel = null, started = false, running = false, over = null, gid = 0, timer = null;
let clocks, tc = [600, 0], clockSide = null, clockT0 = 0;
const rosterFor = m => m === 'real' ? { ...SF_BOTS, ...CLASSIC } : CLASSIC;
const bot = k => rosterFor(mode)[k];
const who = c => $(c === 'w' ? 'selw' : 'selb').value;
const isHuman = c => who(c) === 'human';
const pname = c => isHuman(c) ? { name: 'You', emoji: '🙂', rating: '' } : bot(who(c));
function fillSelects() {
  const old = [$('selw').value, $('selb').value];
  const opt = (k, b) => `<option value="${k}">${b.emoji} ${b.name} (${b.rating})</option>`;
  const html = mode === 'real'
    ? `<optgroup label="Stockfish bots">${Object.entries(SF_BOTS).map(e => opt(...e)).join('')}</optgroup><optgroup label="Classic bots">${Object.entries(CLASSIC).map(e => opt(...e)).join('')}</optgroup>`
    : `<optgroup label="Chaos bots (No Rules)">${Object.entries(CLASSIC).map(([k, b]) => opt(k, b)).join('')}</optgroup>`;
  for (const s of ['selw', 'selb']) $(s).innerHTML = html + '<option value="human">🙂 You (human)</option>';
  const r = rosterFor(mode);
  $('selw').value = r[old[0]] || old[0] === 'human' ? old[0] : (mode === 'real' ? 'human' : 'greedy');
  $('selb').value = r[old[1]] || old[1] === 'human' ? old[1] : (mode === 'real' ? 'mocha' : 'max2');
}
const snap = (last = null) => ({ board: g.board().map(r => r.map(p => p && { ...p })), last, check: g.inCheck(), turn: g.turn(), cap: { w: [...g.captured.w], b: [...g.captured.b] }, san: last?.san });
function reset() {
  gid++; clearTimeout(timer); player.stop(); g = newGame(mode); snaps = [snap()]; ucis = []; evals = [mode === 'real' ? 20 : 0];
  viewPly = null; sel = null; started = false; running = false; over = null; stopClock(false);
  tc = $('tc').value.split(',').map(Number); clocks = { w: tc[0] * 1000, b: tc[0] * 1000 };
  $('modal').hidden = true; $('promo').hidden = true;
  $('modeinfo').innerHTML = INFO[mode]; $('modeinfo').className = mode;
  $('m-real').classList.toggle('on', mode === 'real'); $('m-chaos').classList.toggle('on', mode === 'chaos');
  $('moves').tBodies[0].innerHTML = ''; $('start').textContent = '▶ Start';
  status(mode === 'real' && !engineReady ? 'Loading Stockfish…' : 'Pick players and press Start.'); render();
}
const status = t => { $('status').textContent = t; };
// ---------- clocks ----------
const timed = () => tc[0] > 0;
function startClock(c) { if (!timed() || over) return; clockSide = c; clockT0 = performance.now(); }
function stopClock(addInc = true) { if (clockSide && timed()) { clocks[clockSide] -= performance.now() - clockT0; if (addInc && clocks[clockSide] > 0) clocks[clockSide] += tc[1] * 1000; } clockSide = null; }
const left = c => clocks[c] - (clockSide === c ? performance.now() - clockT0 : 0);
const fmt = ms => { if (!timed()) return '∞'; ms = Math.max(0, ms); const s = ms / 1000; if (s < 20) return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`; const t = Math.ceil(s); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
function onlyKingOrMinor(c) { const ps = g.board().flat().filter(p => p && p.color === c && p.type !== 'k'); return ps.length === 0 || (ps.length === 1 && 'nb'.includes(ps[0].type)); }
setInterval(() => {
  if (clockSide && left(clockSide) <= 0) {
    const c = clockSide; clocks[c] = 0; clockSide = null; const opp = c === 'w' ? 'b' : 'w';
    finish(mode === 'real' && onlyKingOrMinor(opp) ? { winner: null, reason: 'Timeout vs insufficient material' } : { winner: opp, reason: 'Won on time' });
  }
  for (const c of 'wb') { const el = document.querySelector(`.clock[data-c="${c}"]`); if (el) { el.textContent = fmt(left(c)); el.classList.toggle('run', clockSide === c); el.classList.toggle('low', timed() && left(c) < 20000); } }
}, 100);
// ---------- rendering ----------
const cur = () => snaps[viewPly ?? snaps.length - 1];
const live = () => viewPly === null || viewPly === snaps.length - 1;
function render() {
  const s = cur(), b = s.board; let h = '';
  const humanTurn = live() && !over && isHuman(g.turn());
  const tg = sel && humanTurn ? g.legalMoves().filter(m => m.from === sel).map(m => m.to) : [];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const r = orient === 'w' ? i : 7 - i, c = orient === 'w' ? j : 7 - j;
    const name = 'abcdefgh'[c] + (8 - r), p = b[r][c];
    let cls = 'sq ' + ((r + c) % 2 ? 'd' : 'l');
    if (s.last && (s.last.from === name || s.last.to === name)) cls += ' last';
    if (p && p.type === 'k' && p.color === s.turn && s.check) cls += ' chk';
    if (sel === name && humanTurn) cls += ' sel';
    if (tg.includes(name)) cls += ' tgt' + (p ? ' occ' : '');
    h += `<div class="${cls}" data-sq="${name}">${p ? `<span class="pc ${p.color}">${GLYPH[p.type]}${VS}</span>` : ''}${j === 0 ? `<span class="co r">${8 - r}</span>` : ''}${i === 7 ? `<span class="co f">${'abcdefgh'[c]}</span>` : ''}</div>`;
  }
  $('board').innerHTML = h;
  const top = orient === 'w' ? 'b' : 'w';
  card($('card-top'), top, s); card($('card-bot'), top === 'w' ? 'b' : 'w', s);
  renderEval(); renderMoves(); buttons();
}
function card(el, c, s) {
  const p = pname(c), opp = c === 'w' ? 'b' : 'w';
  const mat = x => s.cap[x].reduce((a, t) => a + (t === 'k' ? 0 : VAL[t]), 0), adv = mat(c) - mat(opp);
  const caps = [...s.cap[c]].sort((a, b) => VAL[b] - VAL[a]).map(t => GLYPH[t] + VS).join('');
  el.className = 'pcard' + (!over && g.turn() === c && started ? ' turn' : '');
  el.innerHTML = `<div class="av">${p.emoji}</div><div class="pinfo"><div class="pname">${p.name} <span class="rt">${p.rating ? '(' + p.rating + ')' : ''}</span></div><div class="caps">${caps}${adv > 0 ? `<span class="adv">+${adv}</span>` : ''}</div></div><div class="clock ${c === 'b' ? 'dark' : ''} ${timed() ? '' : 'inf'}" data-c="${c}">${fmt(left(c))}</div>`;
}
function renderEval() {
  const i = viewPly ?? snaps.length - 1; let cp = evals[i];
  if (cp === undefined) for (let k = i; k >= 0; k--) if (evals[k] !== undefined) { cp = evals[k]; break; }
  if (mode === 'chaos') { const s = cur(), m = x => s.cap[x].reduce((a, t) => a + (t === 'k' ? 0 : VAL[t]), 0); cp = (m('w') - m('b')) * 100; }
  cp ??= 0; const mate = Math.abs(cp) > 50000;
  const frac = mate ? (cp > 0 ? 1 : 0) : 1 / (1 + Math.exp(-cp / 250));
  $('evalfill').style.height = (orient === 'w' ? frac : 1 - frac) * 100 + '%';
  $('evalfill').style.background = orient === 'w' ? '#fff' : '#403d39'; $('evalbar').style.background = orient === 'w' ? '#403d39' : '#fff';
  const t = mode === 'chaos' ? (cp / 100 > 0 ? '+' : '') + cp / 100 : mate ? 'M' + (100000 - Math.abs(cp)) : Math.abs(cp / 100).toFixed(1);
  $('evaltxt').textContent = t; const whiteAhead = cp >= 0;
  $('evaltxt').className = (whiteAhead === (orient === 'w')) ? '' : 'top';
  $('evaltxt').style.color = whiteAhead ? '#403d39' : '#fff';
  $('evalbar').title = mode === 'chaos' ? 'Material balance (No Rules)' : 'Stockfish evaluation (white +)';
}
function renderMoves() {
  const tb = $('moves').tBodies[0]; let h = ''; const curPly = viewPly ?? snaps.length - 1;
  for (let p = 1; p < snaps.length; p += 2) {
    const cell = q => q < snaps.length ? `<td class="mv${q === curPly ? ' cur' : ''}" data-ply="${q}">${snaps[q].san}</td>` : '<td></td>';
    h += `<tr><td class="n">${(p + 1) / 2}.</td>${cell(p)}${cell(p + 1)}</tr>`;
  }
  tb.innerHTML = h; const c = tb.querySelector('.cur'); if (c && live()) $('movesbox').scrollTop = 1e9; else c?.scrollIntoView({ block: 'nearest' });
}
function buttons() {
  const hum = isHuman('w') || isHuman('b');
  $('resign').disabled = !hum || !!over || !started; $('draw').disabled = !hum || !!over || !started || (isHuman('w') && isHuman('b'));
  $('start').textContent = over ? '▶ Start' : running ? '⏸ Pause' : started ? '▶ Resume' : '▶ Start';
}
// ---------- game flow ----------
function apply(m) {
  const r = g.play(m); stopClock(true);
  if (r.uci) ucis.push(r.uci);
  snaps.push(snap(r)); sel = null; if (viewPly !== null && viewPly === snaps.length - 2) viewPly = null;
  const res = g.result();
  (res ? null : r.check ? SND.check : r.captured ? SND.capture : SND.move)?.();
  if (mode === 'real') analyse(snaps.length - 1, res);
  render();
  if (res) { finish(res); return false; }
  status(`${g.turn() === 'w' ? 'White' : 'Black'} to move${g.inCheck() ? ' — check!' : ''}`);
  return true;
}
function analyse(ply, res) {
  if (res && res.reason === 'Checkmate') { evals[ply] = res.winner === 'w' ? 99999 : -99999; return; }
  if (res) { evals[ply] = 0; return; }
  const id = gid, moves = [...ucis], wtm = snaps[ply].turn === 'w';
  analyst.search({ moves, ...ANALYSIS, whiteToMove: wtm }).then(r => { if (id !== gid || r.cp === null) return; evals[ply] = r.cp; if ((viewPly ?? snaps.length - 1) === ply) renderEval(); if (over) summary(); }).catch(() => {});
}
function finish(res) {
  if (over) return; over = res; running = false; stopClock(false); clearTimeout(timer); player.stop(); SND.end(); render();
  const text = res.winner ? `${res.winner === 'w' ? 'White' : 'Black'} wins` : 'Draw';
  status(`${text} — ${res.reason}`);
  $('m-icon').textContent = res.winner ? (isHuman(res.winner) ? '🏆' : (isHuman(res.winner === 'w' ? 'b' : 'w') ? '🤖' : '🏆')) : '🤝';
  $('m-title').textContent = res.winner ? `${pname(res.winner).emoji} ${pname(res.winner).name} won` : 'Draw'; $('m-reason').textContent = `${text} · ${res.reason}`;
  summary(); $('modal').hidden = false;
}
function summary() {
  if (mode !== 'real' || snaps.length < 3) { $('m-summary').innerHTML = mode === 'chaos' ? '<span class="note">No Rules games have no engine review.</span>' : ''; $('m-summary').hidden = mode !== 'chaos'; return; }
  const st = { w: { b: 0, m: 0, n: 0 }, b: { b: 0, m: 0, n: 0 } }; const clamp = v => Math.max(-1500, Math.min(1500, v));
  for (let p = 1; p < snaps.length; p++) {
    if (evals[p - 1] === undefined || evals[p] === undefined) continue;
    const c = snaps[p - 1].turn, sgn = c === 'w' ? 1 : -1, drop = sgn * (clamp(evals[p - 1]) - clamp(evals[p]));
    st[c].n++; if (drop > 300) st[c].b++; else if (drop > 100) st[c].m++;
  }
  $('m-summary').hidden = false;
  $('m-summary').innerHTML = `<table><tr><td></td><td>⚪ ${pname('w').name}</td><td>⚫ ${pname('b').name}</td></tr><tr><td>?? Blunders</td><td>${st.w.b}</td><td>${st.b.b}</td></tr><tr><td>? Mistakes</td><td>${st.w.m}</td><td>${st.b.m}</td></tr></table><div class="note">Simple estimate from quick Stockfish evals (drop &gt;3 pawns = blunder, &gt;1 = mistake; ${st.w.n + st.b.n} of ${snaps.length - 1} moves checked).</div>`;
}
const delay = () => Math.round(2000 - $('speed').value * 19.5);
async function tick() {
  if (!running || over) return;
  const c = g.turn(); startClock(c);
  if (isHuman(c)) { render(); status(`Your move (${c === 'w' ? 'White' : 'Black'}) — drag or tap a piece.`); return; }
  const id = gid, legal = g.legalMoves(), k = who(c); let m;
  status(`${bot(k).emoji} ${bot(k).name} is thinking…`);
  if (mode === 'real' && SF_BOTS[k]) {
    try { const b = SF_BOTS[k]; const r = await player.search({ moves: [...ucis], opts: b.opts, go: b.go, whiteToMove: c === 'w', timeout: 30000 }); m = pickLegal(r.best, legal).move; }
    catch (e) { console.warn('[BotChess] engine error, falling back', e); m = pickLegal(null, legal).move; }
  } else { await new Promise(r => setTimeout(r, 30)); m = bot(k).choose(g, legal); }
  if (id !== gid || over || !running) return; // reset/paused while thinking
  if (apply(m)) next();
}
function next() { clearTimeout(timer); if (!running || over) return; timer = setTimeout(tick, isHuman(g.turn()) ? 0 : delay()); }
function start() { if (over) reset(); if (!started) { started = true; } running = true; beep(1, .001, 'sine', .0001); render(); tick(); }
function pause() { if (over) return; running = false; gid++; player.stop(); stopClock(false); clearTimeout(timer); status('Paused.'); render(); gid; }
// ---------- human input ----------
async function tryMove(from, to) {
  const cands = g.legalMoves().filter(m => m.from === from && m.to === to); if (!cands.length) return false;
  let m = cands[0];
  if (cands.length > 1 || m.promotion) {
    const ch = await new Promise(res => {
      const c = g.turn(); $('promo').innerHTML = 'qrbn'.split('').map(t => `<button data-p="${t}"><span class="pc ${c}" style="font-size:44px">${GLYPH[t]}${VS}</span></button>`).join('');
      $('promo').hidden = false; $('promo').onclick = e => { const b = e.target.closest('button'); $('promo').hidden = true; res(b ? b.dataset.p : null); };
    });
    if (!ch) { sel = null; render(); return false; }
    m = cands.find(x => x.promotion === ch) || m;
  }
  if (!started) { started = true; } running = true;
  if (apply(m)) next(); return true;
}
let drag = null;
const canTouch = () => live() && !over && isHuman(g.turn()) && (mode === 'chaos' || engineReady || true);
const ownAt = sq => { const p = cur().board[8 - +sq[1]]['abcdefgh'.indexOf(sq[0])]; return p && p.color === g.turn(); };
$('board').addEventListener('pointerdown', e => {
  const el = e.target.closest('.sq'); if (!el) return; const sq = el.dataset.sq;
  if (!live()) { viewPly = null; render(); return; }
  if (!canTouch()) return;
  if (sel && sel !== sq && !ownAt(sq)) { const f = sel; sel = null; tryMove(f, sq).then(ok => ok || render()); return; }
  if (!ownAt(sq)) { sel = null; render(); return; }
  const was = sel === sq; sel = sq; render();
  const pc = $('board').querySelector(`[data-sq="${sq}"] .pc`); if (!pc) return;
  const gh = pc.cloneNode(true); gh.id = 'ghost'; gh.style.fontSize = getComputedStyle(pc).fontSize; gh.style.left = e.clientX + 'px'; gh.style.top = e.clientY + 'px';
  document.body.appendChild(gh); $('board').querySelector(`[data-sq="${sq}"]`).classList.add('dragging');
  drag = { from: sq, gh, was }; $('board').setPointerCapture?.(e.pointerId); e.preventDefault();
});
window.addEventListener('pointermove', e => { if (drag) { drag.gh.style.left = e.clientX + 'px'; drag.gh.style.top = e.clientY + 'px'; } });
window.addEventListener('pointerup', e => {
  if (!drag) return; const d = drag; drag = null; d.gh.remove();
  const to = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.sq')?.dataset.sq;
  if (to && to !== d.from) { sel = null; tryMove(d.from, to).then(ok => ok || render()); return; }
  if (d.was) sel = null; render();
});
// ---------- controls ----------
$('start').onclick = () => { if (mode === 'real' && !engineReady && [who('w'), who('b')].some(k => SF_BOTS[k])) return status('Still loading Stockfish… one moment.'); running ? pause() : start(); };
$('newgame').onclick = () => reset();
$('flip').onclick = () => { orient = orient === 'w' ? 'b' : 'w'; render(); };
$('m-real').onclick = () => { mode = 'real'; fillSelects(); reset(); };
$('m-chaos').onclick = () => { mode = 'chaos'; fillSelects(); reset(); };
$('selw').onchange = $('selb').onchange = () => { if (!started) { if (isHuman('b') && !isHuman('w')) orient = 'b'; else if (isHuman('w')) orient = 'w'; } render(); };
$('tc').onchange = () => { if (!started) reset(); else status('New time control applies to the next game.'); };
$('resign').onclick = () => { const c = isHuman(g.turn()) ? g.turn() : isHuman('w') ? 'w' : 'b'; finish({ winner: c === 'w' ? 'b' : 'w', reason: 'Resignation' }); };
$('draw').onclick = () => {
  const human = isHuman(g.turn()) ? g.turn() : isHuman('w') ? 'w' : 'b', botSide = human === 'w' ? 'b' : 'w';
  let accept;
  if (mode === 'real') { let cp = 0; for (let k = evals.length - 1; k >= 0; k--) if (evals[k] !== undefined) { cp = evals[k]; break; } accept = Math.abs(cp) <= 50; }
  else { const s = cur(), m = x => s.cap[x].reduce((a, t) => a + (t === 'k' ? 0 : VAL[t]), 0); accept = m('w') === m('b'); }
  if (accept) finish({ winner: null, reason: 'Draw agreed' }); else status(`${pname(botSide).emoji} ${pname(botSide).name} declines the draw — keep playing!`);
};
const nav = p => { viewPly = Math.max(0, Math.min(snaps.length - 1, p)); if (viewPly === snaps.length - 1) viewPly = null; sel = null; render(); };
$('nav-first').onclick = () => nav(0); $('nav-prev').onclick = () => nav((viewPly ?? snaps.length - 1) - 1);
$('nav-next').onclick = () => nav((viewPly ?? snaps.length - 1) + 1); $('nav-last').onclick = () => nav(snaps.length - 1);
$('moves').onclick = e => { const t = e.target.closest('td.mv'); if (t) nav(+t.dataset.ply); };
document.addEventListener('keydown', e => { if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return; if (e.key === 'ArrowLeft') $('nav-prev').click(); if (e.key === 'ArrowRight') $('nav-next').click(); });
$('m-close').onclick = () => { $('modal').hidden = true; };
$('m-new').onclick = () => reset();
$('m-rematch').onclick = () => { const w = $('selw').value; $('selw').value = $('selb').value; $('selb').value = w; if (isHuman('b') && !isHuman('w')) orient = 'b'; else orient = 'w'; reset(); start(); };
// ---------- boot ----------
const q = new URLSearchParams(location.search);
if (q.get('mode') === 'chaos') mode = 'chaos';
fillSelects();
if (q.get('w')) $('selw').value = q.get('w'); if (q.get('b')) $('selb').value = q.get('b');
if (q.get('tc')) $('tc').value = q.get('tc');
reset();
if (q.get('speed')) $('speed').value = q.get('speed');
window.__bc = { start, pause, reset, finish, state: () => ({ plies: snaps.length - 1, over, engineReady, evals: evals.length, ucis: [...ucis] }) };
if (q.get('autostart')) { const go = () => (mode === 'chaos' || engineReady) ? start() : setTimeout(go, 200); go(); }

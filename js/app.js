import { newGame, BOTS } from './engine.js';
const $ = id => document.getElementById(id);
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const INFO = {
  real: '<b class="tag">Real Chess</b> All the official rules! Bots may only pick <b>legal</b> moves — the referee rejects anything else. Check, checkmate, castling, en passant, promotion, stalemate and draws (50-move rule, threefold repetition, not enough pieces) all count.',
  chaos: '<b class="tag">No Rules Chess</b> Total chaos! 🌪️ Any piece can teleport to <b>any</b> square (except onto its own team). No check, no castling. First bot to <b>capture the enemy king</b> wins — but kings have a 🛡️ <b>Royal Shield</b>: only a piece within 2 squares of a king can grab it (otherwise the first move would always win!). After 200 moves with no king captured, it\'s a draw.'
};
let mode = 'real', g, timer = null, running = false, lastMove = null, sel = null, history = [];
for (const s of ['selw', 'selb']) {
  $(s).innerHTML = Object.entries(BOTS).map(([k, b]) => `<option value="${k}">${b.emoji} ${b.name} ${'★'.repeat(b.strength)}</option>`).join('') + '<option value="human">🙋 You (human)</option>';
}
$('selw').value = 'greedy'; $('selb').value = 'max2';
const who = c => $(c === 'w' ? 'selw' : 'selb').value;
const label = c => who(c) === 'human' ? '🙋 You' : BOTS[who(c)].emoji + ' ' + BOTS[who(c)].name;

function reset() {
  stop(); g = newGame(mode); lastMove = null; sel = null; history = [];
  $('moves').innerHTML = ''; $('banner').hidden = true;
  $('modeinfo').innerHTML = INFO[mode]; $('modeinfo').className = mode === 'chaos' ? 'chaos' : '';
  $('m-real').classList.toggle('on', mode === 'real'); $('m-chaos').classList.toggle('on', mode === 'chaos');
  status('Press Start to watch the bots play!'); render();
}
function status(t) { $('status').textContent = t; }
function render() {
  const b = g.board(), turn = g.turn(); let h = '';
  const targets = sel ? g.legalMoves().filter(m => m.from === sel).map(m => m.to) : [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const name = 'abcdefgh'[c] + (8 - r), p = b[r][c];
    let cls = 'sq ' + ((r + c) % 2 ? 'd' : 'l');
    if (lastMove && (lastMove.from === name || lastMove.to === name)) cls += ' last';
    if (p && p.type === 'k' && p.color === turn && g.inCheck()) cls += ' chk';
    if (sel === name) cls += ' sel'; if (targets.includes(name)) cls += ' tgt';
    h += `<div class="${cls}" data-sq="${name}">${p ? `<span class="p${p.color}">${GLYPH[p.type]}</span>` : ''}${c === 0 ? `<span class="coord">${8 - r}</span>` : ''}</div>`;
  }
  $('board').innerHTML = h;
  $('pw').textContent = '⚪ White: ' + label('w'); $('pb').textContent = '⚫ Black: ' + label('b');
  $('pw').classList.toggle('turn', turn === 'w' && !g.result()); $('pb').classList.toggle('turn', turn === 'b' && !g.result());
  $('capw').innerHTML = g.captured.w.map(t => `<span class="pb">${GLYPH[t]}</span>`).join('');
  $('capb').innerHTML = g.captured.b.map(t => `<span class="pw">${GLYPH[t]}</span>`).join('');
}
function addMove(r) {
  history.push(r);
  if (r.color === 'w' || !$('moves').lastChild || mode === 'chaos' && history.length % 2 === 1) {
    const li = document.createElement('li'); li.textContent = r.san; $('moves').appendChild(li);
  } else $('moves').lastChild.textContent += '  ' + r.san;
  $('moves').scrollTop = 1e9;
}
function apply(m) {
  const r = g.play(m); lastMove = r; addMove(r); render();
  const res = g.result();
  if (res) {
    stop();
    const text = res.winner ? `🏆 ${res.winner === 'w' ? 'White' : 'Black'} (${label(res.winner)}) wins! — ${res.reason}` : `🤝 Draw — ${res.reason}`;
    $('banner').textContent = text; $('banner').hidden = false; status(text); return false;
  }
  status(`${g.turn() === 'w' ? 'White' : 'Black'} to move${g.inCheck() ? ' — CHECK!' : ''}`);
  return true;
}
function step() {
  if (g.result()) return false;
  const c = g.turn();
  if (who(c) === 'human') { stop(); status('Your turn! Tap a piece, then tap where it goes.'); return false; }
  const moves = g.legalMoves();
  return apply(BOTS[who(c)].choose(g, moves));
}
const delay = () => 1500 - $('speed').value * 14.5;
function loop() { if (!running) return; if (step() && running) timer = setTimeout(loop, delay()); else if (!g.result() && who(g.turn()) === 'human') { running = true; $('start').textContent = '⏸ Pause'; } }
function start() { if (g.result()) reset(); running = true; $('start').textContent = '⏸ Pause'; loop(); }
function stop() { running = false; clearTimeout(timer); $('start').textContent = '▶ Start'; }
$('start').onclick = () => running && who(g.turn()) !== 'human' ? stop() : start();
$('step').onclick = () => { stop(); step(); };
$('reset').onclick = reset;
$('m-real').onclick = () => { mode = 'real'; reset(); };
$('m-chaos').onclick = () => { mode = 'chaos'; reset(); };
$('selw').onchange = $('selb').onchange = render;
$('board').onclick = e => {
  const sq = e.target.closest('.sq')?.dataset.sq; if (!sq || g.result() || who(g.turn()) !== 'human') return;
  const moves = g.legalMoves();
  if (sel) {
    const cand = moves.filter(m => m.from === sel && m.to === sq);
    if (cand.length) { sel = null; const m = cand.find(x => !x.promotion || x.promotion === 'q') || cand[0]; if (apply(m)) { running = true; timer = setTimeout(loop, 400); } return; }
  }
  sel = moves.some(m => m.from === sq) ? sq : null; render();
};
reset();
window.__bc = { start, stop, step, setMode: m => { mode = m; reset(); } };
// Demo hook: ?mode=chaos&plies=12 pre-plays some moves (used for screenshots)
const q = new URLSearchParams(location.search);
if (q.get('mode') === 'chaos') { mode = 'chaos'; reset(); }
for (let i = 0, n = +q.get('plies') || 0; i < n && step(); i++);

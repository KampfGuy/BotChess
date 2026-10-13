// Real Chess games played by the vendored Stockfish (run in Node), every move checked by chess.js.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { Uci, SF_BOTS, pickLegal } from '../js/uci.js';
import { newGame } from '../js/engine.js';
import { Chess } from '../js/chess.js';

const path = fileURLToPath(new URL('../js/stockfish/stockfish-19-lite-single.js', import.meta.url));
function engine() {
  const p = spawn(process.execPath, [path], { stdio: ['pipe', 'pipe', 'inherit'] });
  const u = new Uci(l => p.stdin.write(l + '\n'));
  createInterface({ input: p.stdout }).on('line', l => u.feed(l));
  u.kill = () => p.kill(); return u;
}
const fast = go => go.replace(/movetime \d+/, 'movetime 40'); // keep test runtime low
const pairs = [['pip', 'bramble'], ['bramble', 'mocha'], ['mocha', 'ranger'], ['ranger', 'athena'], ['athena', 'drako'], ['drako', 'max']];
let fail = 0; const t0 = Date.now();
const eng = engine(); await eng.init();
// fallback check: an illegal "bestmove" must be rejected
{ const legal = new Chess().moves({ verbose: true }); const r = pickLegal('e2e5', legal, () => {}); if (!r.fallback || !legal.includes(r.move)) { console.log('fallback check FAILED'); fail++; } else console.log('Illegal engine move e2e5 rejected → fallback to legal', r.move.san); }
for (const [i, [w, b]] of pairs.entries()) {
  const g = newGame('real'), ref = new Chess(), ucis = []; let fallbacks = 0, res;
  while (!(res = g.result()) && ucis.length < 700) {
    const bot = SF_BOTS[g.turn() === 'w' ? w : b];
    const { best } = await eng.search({ moves: ucis, opts: bot.opts, go: fast(bot.go), whiteToMove: g.turn() === 'w' });
    const { move, fallback } = pickLegal(best, g.legalMoves()); fallbacks += fallback;
    const ok = ref.moves({ verbose: true }).some(x => x.from === move.from && x.to === move.to && (x.promotion || null) === (move.promotion || null));
    if (!ok) { console.log('ILLEGAL', best); fail++; break; }
    const r = g.play(move); ref.move({ from: move.from, to: move.to, promotion: move.promotion }); ucis.push(r.uci);
  }
  const valid = res && ['Checkmate', 'Stalemate', 'Insufficient material', 'Threefold repetition', '50-move rule'].includes(res.reason) && ref.game_over();
  if (!valid || fallbacks) fail++;
  console.log(`SF #${i + 1} ${SF_BOTS[w].name} (${SF_BOTS[w].rating}) vs ${SF_BOTS[b].name} (${SF_BOTS[b].rating}): ${res ? (res.winner || 'draw') + ' – ' + res.reason : 'NO END'} in ${ucis.length} plies, ${fallbacks} fallbacks`);
}
eng.kill();
console.log(`(${((Date.now() - t0) / 1000).toFixed(1)}s)`, fail ? `FAILED (${fail})` : 'STOCKFISH TESTS PASSED'); process.exit(fail ? 1 : 0);

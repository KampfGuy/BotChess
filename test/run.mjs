import { newGame, BOTS } from '../js/engine.js';
import { Chess } from '../js/chess.js';
const ids = Object.keys(BOTS); let fail = 0; const tally = {};
for (let i = 0; i < 20; i++) {
  const g = newGame('real'), w = ids[i % 4], b = ids[(i >> 2) % 4], ref = new Chess();
  let res;
  while (!(res = g.result())) {
    const moves = g.legalMoves(); const m = BOTS[g.turn() === 'w' ? w : b].choose(g, moves);
    const refLegal = ref.moves({ verbose: true }).some(x => x.from === m.from && x.to === m.to && (x.promotion||null) === (m.promotion||null));
    if (!refLegal) { console.log('ILLEGAL', m); fail++; break; }
    g.play(m); ref.move({ from: m.from, to: m.to, promotion: m.promotion });
  }
  // engine must reject an illegal move
  try { g.play({ from: 'a1', to: 'h8' }); console.log('engine accepted illegal'); fail++; } catch {}
  const ok = res && ['Checkmate','Stalemate','Insufficient material','Threefold repetition','50-move rule'].includes(res.reason) && ref.game_over();
  if (!ok) fail++;
  tally[res.reason] = (tally[res.reason] || 0) + 1;
  console.log(`Real #${i+1} ${BOTS[w].name} vs ${BOTS[b].name}: ${res.winner || 'draw'} (${res.reason}) in ${g.c.history().length} plies`);
}
for (let i = 0; i < 10; i++) {
  const g = newGame('chaos'), w = ids[i % 4], b = ids[(i + 1) % 4]; let n = 0;
  while (!g.result() && n < 1000) { g.play(BOTS[g.turn()==='w'?w:b].choose(g, g.legalMoves())); n++; }
  const r = g.result(); if (!r || n > 200) fail++;
  console.log(`Chaos #${i+1}: ${r ? (r.winner||'draw') + ' – ' + r.reason : 'NO END'} after ${n} plies`);
}
console.log('Real results:', tally); console.log(fail ? `FAILED (${fail})` : 'ALL TESTS PASSED'); process.exit(fail ? 1 : 0);

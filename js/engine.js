// BotChess engine: Real Chess (via vendored chess.js) + No Rules chaos mode, and bots.
import { Chess } from './chess.js';

export const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const FILES = 'abcdefgh';
export const sqName = (r, c) => FILES[c] + (8 - r); // r=0 is rank 8

// ---------- Real Chess game ----------
export class RealGame {
  constructor() { this.c = new Chess(); this.mode = 'real'; this.captured = { w: [], b: [] }; }
  turn() { return this.c.turn(); }
  board() { return this.c.board(); } // [r][c] {type,color} or null
  legalMoves() { return this.c.moves({ verbose: true }); }
  // Strict: only accepts a move that exactly matches a legal move.
  play(m) {
    const legal = this.legalMoves().find(x => x.from === m.from && x.to === m.to && (x.promotion || null) === (m.promotion || null));
    if (!legal) throw new Error('Illegal move rejected: ' + JSON.stringify(m));
    const r = this.c.move({ from: legal.from, to: legal.to, promotion: legal.promotion });
    if (r.captured) this.captured[r.color].push(r.captured);
    return { san: r.san, from: r.from, to: r.to, color: r.color, captured: r.captured, promotion: r.promotion, uci: r.from + r.to + (r.promotion || ''), check: this.c.in_check() };
  }
  inCheck() { return this.c.in_check(); }
  result() {
    const c = this.c;
    if (c.in_checkmate()) return { winner: c.turn() === 'w' ? 'b' : 'w', reason: 'Checkmate' };
    if (c.in_stalemate()) return { winner: null, reason: 'Stalemate' };
    if (c.insufficient_material()) return { winner: null, reason: 'Insufficient material' };
    if (c.in_threefold_repetition()) return { winner: null, reason: 'Threefold repetition' };
    if (c.in_draw()) return { winner: null, reason: '50-move rule' };
    return null;
  }
}

// ---------- No Rules (chaos) game ----------
const START = ['rnbqkbnr', 'pppppppp', '........', '........', '........', '........', 'PPPPPPPP', 'RNBQKBNR'];
export class ChaosGame {
  constructor(cap = 200) {
    this.mode = 'chaos'; this.cap = cap; this.ply = 0; this.t = 'w'; this.captured = { w: [], b: [] }; this.over = null;
    this.b = START.map(row => [...row].map(ch => ch === '.' ? null : { type: ch.toLowerCase(), color: ch === ch.toUpperCase() ? 'w' : 'b' }));
  }
  turn() { return this.t; }
  board() { return this.b; }
  legalMoves() { // any own piece to any square not holding an own piece
    if (this.over) return [];
    const mv = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = this.b[r][c]; if (!p || p.color !== this.t) continue;
      for (let r2 = 0; r2 < 8; r2++) for (let c2 = 0; c2 < 8; c2++) {
        const q = this.b[r2][c2]; if (q && q.color === this.t) continue;
        // Royal Shield: a king can only be grabbed by a piece within 2 squares of it
        if (q && q.type === 'k' && Math.max(Math.abs(r - r2), Math.abs(c - c2)) > 2) continue;
        mv.push({ from: sqName(r, c), to: sqName(r2, c2), piece: p.type, color: p.color, captured: q ? q.type : undefined });
      }
    }
    return mv;
  }
  play(m) {
    if (this.over) throw new Error('Game over');
    const rc = s => [8 - +s[1], FILES.indexOf(s[0])];
    const [r, c] = rc(m.from), [r2, c2] = rc(m.to);
    const p = this.b[r][c], q = this.b[r2][c2];
    if (!p || p.color !== this.t || (q && q.color === this.t) || (q && q.type === 'k' && Math.max(Math.abs(r - r2), Math.abs(c - c2)) > 2)) throw new Error('Rejected chaos move');
    if (q) this.captured[this.t].push(q.type);
    this.b[r2][c2] = p; this.b[r][c] = null; this.ply++;
    const sym = p.type === 'p' ? '' : p.type.toUpperCase();
    const san = sym + m.from + (q ? 'x' : '-') + m.to + (q && q.type === 'k' ? '#' : '');
    if (q && q.type === 'k') this.over = { winner: this.t, reason: 'King captured!' };
    else if (this.ply >= this.cap) this.over = { winner: null, reason: `Move cap (${this.cap} plies) reached` };
    this.t = this.t === 'w' ? 'b' : 'w';
    return { san, from: m.from, to: m.to, color: p.color, captured: q ? q.type : undefined, uci: m.from + m.to, check: false };
  }
  inCheck() { return false; }
  result() { return this.over; }
}

// ---------- Evaluation for Minimax ----------
const PST = { // from white's view, index [r][c] r=0 rank8
  p: [[0,0,0,0,0,0,0,0],[5,5,5,5,5,5,5,5],[1,1,2,3,3,2,1,1],[.5,.5,1,2.5,2.5,1,.5,.5],[0,0,0,2,2,0,0,0],[.5,-.5,-1,0,0,-1,-.5,.5],[.5,1,1,-2,-2,1,1,.5],[0,0,0,0,0,0,0,0]],
  n: [[-5,-4,-3,-3,-3,-3,-4,-5],[-4,-2,0,0,0,0,-2,-4],[-3,0,1,1.5,1.5,1,0,-3],[-3,.5,1.5,2,2,1.5,.5,-3],[-3,0,1.5,2,2,1.5,0,-3],[-3,.5,1,1.5,1.5,1,.5,-3],[-4,-2,0,.5,.5,0,-2,-4],[-5,-4,-3,-3,-3,-3,-4,-5]],
};
function evaluate(board) { // positive = good for white
  let s = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c]; if (!p) continue;
    let v = VAL[p.type] * 10;
    const t = PST[p.type]; if (t) v += p.color === 'w' ? t[r][c] : t[7 - r][c];
    else if (p.type !== 'k') v += (3.5 - Math.abs(3.5 - c)) * 0.2 + (3.5 - Math.abs(3.5 - r)) * 0.2;
    s += p.color === 'w' ? v : -v;
  }
  return s;
}
function negamax(c, depth, alpha, beta) {
  if (c.in_checkmate()) return -10000 - depth;
  if (c.in_draw()) return 0;
  if (depth === 0) return (c.turn() === 'w' ? 1 : -1) * evaluate(c.board());
  const ms = c.moves({ verbose: true }).sort((a, b) => (b.captured ? VAL[b.captured] : 0) - (a.captured ? VAL[a.captured] : 0));
  let best = -Infinity;
  for (const m of ms) {
    c.move(m); const v = -negamax(c, depth - 1, -beta, -alpha); c.undo();
    if (v > best) best = v; if (v > alpha) alpha = v; if (alpha >= beta) break;
  }
  return best;
}

// ---------- Bots ----------
const pick = a => a[Math.floor(Math.random() * a.length)];
const capVal = m => (m.captured ? VAL[m.captured] : 0);
function greedy(moves) {
  const best = Math.max(...moves.map(m => capVal(m) * 10 + (m.promotion ? 8 : 0) + (m.san && m.san.includes('#') ? 1000 : 0)));
  return pick(moves.filter(m => capVal(m) * 10 + (m.promotion ? 8 : 0) + (m.san && m.san.includes('#') ? 1000 : 0) === best));
}
// chaos heuristic: grab king, else biggest capture (with cheapest attacker), else random
function chaosPick(moves, skill) {
  const king = moves.filter(m => m.captured === 'k'); if (king.length) return pick(king);
  if (skill === 0) return pick(moves);
  const caps = moves.filter(m => m.captured);
  if (caps.length) {
    const top = Math.max(...caps.map(capVal));
    let c = caps.filter(m => capVal(m) === top);
    if (skill >= 2) { const lo = Math.min(...c.map(m => VAL[m.piece])); c = c.filter(m => VAL[m.piece] === lo); }
    return pick(c);
  }
  return pick(moves);
}
export const BOTS = {
  random: { name: 'Random Rook', emoji: '🎲', rating: 100, blurb: 'Picks any allowed move at random. Very silly!', strength: 1,
    choose: (g, moves) => g.mode === 'chaos' ? chaosPick(moves, 0) : pick(moves) },
  greedy: { name: 'Greedy Gary', emoji: '🍪', rating: 250, blurb: 'Always grabs the biggest piece it can eat.', strength: 2,
    choose: (g, moves) => g.mode === 'chaos' ? chaosPick(moves, 1) : greedy(moves) },
  max2: { name: 'Minimax Max', emoji: '🧠', rating: 600, blurb: 'Thinks 2 moves ahead (alpha-beta search).', strength: 3, depth: 2 },
  max3: { name: 'Professor Penny', emoji: '🦊', rating: 800, blurb: 'Thinks 3 moves ahead. The toughest bot!', strength: 4, depth: 3 },
};
for (const k of ['max2', 'max3']) {
  const d = BOTS[k].depth;
  BOTS[k].choose = (g, moves) => {
    if (g.mode === 'chaos') return chaosPick(moves, 2);
    const c = new Chess(g.c.fen());
    let best = -Infinity, bestMs = [];
    for (const m of moves) {
      c.move({ from: m.from, to: m.to, promotion: m.promotion });
      const v = -negamax(c, d - 1, -Infinity, Infinity) + Math.random() * 0.3; c.undo();
      if (v > best) { best = v; bestMs = [m]; }
    }
    return bestMs[0];
  };
}
export const newGame = mode => mode === 'chaos' ? new ChaosGame() : new RealGame();

// Fen helper for engines
export const fenOf = g => g.c ? g.c.fen() : null;

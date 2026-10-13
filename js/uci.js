// Tiny UCI driver usable in the browser (Web Worker) and in Node (child process).
// Stockfish speaks UCI text lines; this queues searches so they never overlap.
export class Uci {
  constructor(post) { this.post = post; this.ls = []; this.q = Promise.resolve(); this.ready = null; }
  feed(line) { for (const f of [...this.ls]) f(line); }
  waitFor(re, ms) {
    return new Promise((res, rej) => {
      const f = l => { if (re.test(l)) { off(); res(l); } };
      const t = setTimeout(() => { off(); rej(new Error('UCI timeout waiting for ' + re)); }, ms);
      const off = () => { this.ls = this.ls.filter(x => x !== f); clearTimeout(t); };
      this.ls.push(f);
    });
  }
  init() {
    return this.ready ||= (async () => {
      this.post('uci'); await this.waitFor(/^uciok/, 60000);
      this.post('setoption name Hash value 16');
      this.post('isready'); await this.waitFor(/^readyok/, 60000);
    })();
  }
  run(fn) { const p = this.q.then(fn, fn); this.q = p.catch(() => {}); return p; }
  stop() { this.post('stop'); }
  // opts: [[name,value]], moves: uci list from startpos, go: e.g. "movetime 300"
  // Returns { best, cp } with cp from WHITE's point of view (mate => ±(100000 - plies)).
  search({ moves = [], opts = [], go = 'movetime 200', whiteToMove = true, timeout = 60000 }) {
    return this.run(async () => {
      await this.init();
      for (const [k, v] of opts) this.post(`setoption name ${k} value ${v}`);
      this.post('isready'); await this.waitFor(/^readyok/, 20000);
      let cp = null, mate = null, depth = 0;
      const f = l => {
        const m = l.match(/^info .*?depth (\d+).*? score (cp|mate) (-?\d+)/);
        if (m && !/ (lower|upper)bound/.test(l) && !/multipv [2-9]/.test(l)) { depth = +m[1]; if (m[2] === 'cp') { cp = +m[3]; mate = null; } else { mate = +m[3]; cp = null; } }
      };
      this.ls.push(f);
      try {
        this.post('position startpos' + (moves.length ? ' moves ' + moves.join(' ') : ''));
        this.post('go ' + go);
        const l = await this.waitFor(/^bestmove/, timeout);
        let score = mate !== null ? Math.sign(mate || -1) * (100000 - Math.abs(mate)) : cp;
        if (score !== null && !whiteToMove) score = -score;
        return { best: l.split(/\s+/)[1], cp: score, mate: mate === null ? null : (whiteToMove ? mate : -mate), depth };
      } finally { this.ls = this.ls.filter(x => x !== f); }
    });
  }
}

// Validate an engine move against the rules referee's legal list; fall back to a random legal move.
export function pickLegal(best, legal, log = console.warn) {
  const m = best && legal.find(x => x.from === best.slice(0, 2) && x.to === best.slice(2, 4) && (x.promotion || '') === (best[4] || ''));
  if (m) return { move: m, fallback: false };
  log(`[BotChess] engine move "${best}" rejected as illegal – using a random legal move instead`);
  return { move: legal[Math.floor(Math.random() * legal.length)], fallback: true };
}

// Stockfish-powered bot roster (ratings are rough estimates, especially for the lite network).
const FULL = [['UCI_LimitStrength', 'false'], ['Skill Level', 20]];
const elo = e => [['Skill Level', 20], ['UCI_LimitStrength', 'true'], ['UCI_Elo', e]];
export const SF_BOTS = {
  pip:    { name: 'Pip the Chick', emoji: '🐣', rating: 500,  blurb: 'Just hatched. Skill 0, looks 1 move deep.', opts: [['UCI_LimitStrength', 'false'], ['Skill Level', 0]], go: 'depth 1' },
  bramble:{ name: 'Bramble Hedgehog', emoji: '🦔', rating: 900, blurb: 'Learning fast. Skill 3, shallow search.', opts: [['UCI_LimitStrength', 'false'], ['Skill Level', 3]], go: 'depth 4 movetime 300' },
  mocha:  { name: 'Mocha', emoji: '☕', rating: 1350, blurb: 'Casual café player (UCI_Elo 1350).', opts: elo(1350), go: 'movetime 400' },
  ranger: { name: 'Rook Ranger', emoji: '🛡️', rating: 1600, blurb: 'Solid club player (UCI_Elo 1600).', opts: elo(1600), go: 'movetime 500' },
  athena: { name: 'Athena Owl', emoji: '🦉', rating: 2000, blurb: 'Expert tactician (UCI_Elo 2000).', opts: elo(2000), go: 'movetime 600' },
  drako:  { name: 'Drako', emoji: '🐉', rating: 2400, blurb: 'Master strength (UCI_Elo 2400).', opts: elo(2400), go: 'movetime 800' },
  max:    { name: 'Stockfish Max', emoji: '🚀', rating: 3000, blurb: 'Full-strength Stockfish (lite net), 1s per move.', opts: FULL, go: 'movetime 1000' },
};
export const ANALYSIS = { opts: FULL, go: 'movetime 150' };

# ♞ BotChess v2 — play & watch Stockfish bots

Live: **https://kampfguy.github.io/BotChess/**

An original chess site with a familiar "online chess" layout (dark theme, green board, player cards with clocks, eval bar, move list) — not affiliated with or copied from any chess site; all pieces are Unicode glyphs and all sounds are generated with WebAudio.

## Features
- **Real Chess** with real AI: Stockfish 19 (lite, single-threaded WASM) running in a Web Worker — no server, no CDN, works on GitHub Pages without COOP/COEP headers.
- Every engine move is validated by chess.js; an illegal `bestmove` would be rejected and replaced by a random legal move (logged to the console).
- Clocks: 1|0, 3|2, 5|0, 10|0, unlimited. Flag = loss (draw if the opponent has insufficient material). In bot games the clock only runs while a bot is thinking (the "bot speed" display delay is not charged).
- Eval bar (second Stockfish worker, ~150 ms per position), captured pieces + material advantage, last-move/check highlights, legal-move dots, drag-and-drop **and** click-to-move, promotion picker (Q/R/B/N), flip board, resign, draw offers (bots accept if |eval| ≤ 0.5), clickable move list with ⏮◀▶⏭ review (and ←/→ keys), game-over modal with Rematch / New game and a **simple estimated** blunder/mistake count (eval drop >300cp / >100cp).
- **No Rules** (chaos) mode with the 🛡️ Royal Shield rule (a king can only be captured from within 2 squares). Stockfish only knows real chess, so No Rules uses the **Chaos bots** (the classic homemade bots); the eval bar shows material balance there.
- Responsive: Chromebook/desktop side-by-side; phones (390px) get a full-width board with the panel below.

## Bot roster (ratings are rough estimates)
| Bot | Rating | Engine settings |
|---|---|---|
| 🐣 Pip the Chick | ~500 | Skill Level 0, depth 1 |
| 🦔 Bramble Hedgehog | ~900 | Skill Level 3, depth 4 / 300 ms |
| ☕ Mocha | ~1350 | UCI_LimitStrength, UCI_Elo 1350, 400 ms |
| 🛡️ Rook Ranger | ~1600 | UCI_Elo 1600, 500 ms |
| 🦉 Athena Owl | ~2000 | UCI_Elo 2000, 600 ms |
| 🐉 Drako | ~2400 | UCI_Elo 2400, 800 ms |
| 🚀 Stockfish Max | ~3000 | full strength, 1 s/move |

Classic bots (Real Chess "Classic" group, and the Chaos bots in No Rules): 🎲 Random Rook, 🍪 Greedy Gary, 🧠 Minimax Max, 🦊 Professor Penny.

## Tests
```
node test/stockfish.mjs   # 6 Stockfish games across strengths (fast movetime), every move legal, valid termination, illegal-bestmove fallback
node test/run.mjs         # classic bots: 20 Real games + 10 chaos games
node test/chaos.mjs       # chaos games
```
Screenshots: `docs/screenshot-desktop.png`, `docs/screenshot-phone.png`, `docs/screenshot-gameover.png`, `docs/screenshot-chaos.png`.

## Credits & licenses
- **Stockfish** (GPL-3.0) — https://github.com/official-stockfish/Stockfish — compiled to WebAssembly by **stockfish.js** (npm `stockfish` 19.0.1, https://github.com/nmrugg/stockfish.js). Files vendored unmodified in `js/stockfish/` with the GPL text in `js/stockfish/COPYING-GPL3.txt`. Source code for the engine is available at the links above; this site's source is public in this repo.
- **chess.js** 0.13.4 (BSD-2) — `js/chess.js`.

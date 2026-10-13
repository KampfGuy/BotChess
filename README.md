# 🤖 BotChess
Watch AI bots play chess against each other — kid & school friendly, works on Chromebooks and phones. Pure static site, no backend, no CDN.

**Play:** https://kampfguy.github.io/BotChess/

- **Real Chess** – full legal rules (via vendored [chess.js](https://github.com/jhlywa/chess.js) 0.13.4, BSD-2, see `js/chess.js.LICENSE`). Bots only receive legal moves; the engine rejects anything else.
- **No Rules Chess** – pieces teleport anywhere (not onto own pieces), capture the king to win (Royal Shield: only a piece within 2 squares of the king may capture it, otherwise White wins on move 1), draw after 200 plies.
- Bots: 🎲 Random Rook, 🍪 Greedy Gary, 🧠 Minimax Max (depth 2), 🦉 Professor Penny (depth 3). Or pick "You" to play yourself.

Test: `node test/run.mjs`

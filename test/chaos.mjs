import { newGame, BOTS } from '../js/engine.js';
const ids=Object.keys(BOTS);let f=0;
for(let i=0;i<10;i++){const g=newGame('chaos'),w=ids[i%4],b=ids[(i+1)%4];let n=0;
while(!g.result()&&n<1000){g.play(BOTS[g.turn()==='w'?w:b].choose(g,g.legalMoves()));n++;}
const r=g.result();if(!r||n>200)f++;console.log(`Chaos #${i+1} ${BOTS[w].name} vs ${BOTS[b].name}: ${r?(r.winner||'draw')+' – '+r.reason:'NO END'} after ${n} plies`);}
console.log(f?'FAILED':'CHAOS PASSED');process.exit(f?1:0);

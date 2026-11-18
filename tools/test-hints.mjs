import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHintSession} from '../js/hints.js';
import {generateExercise} from '../js/generator.js';
const read = path => readFileSync(new URL(`../data/${path}`,import.meta.url),'utf8');
let marked=0, runs=0, state=31337;
const random=()=> (state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296;
for (const task of JSON.parse(read('catalog.json')).tasks) for (const t of task.templates) {
  const code=read(`${t.path}/template.py`).replace(/\r\n?/g,'\n'), config=JSON.parse(read(`${t.path}/config.json`));
  for(const gap of config.gaps){
    const original=Array.from(code).slice(gap.start,gap.end).join('');
    const s=createHintSession({gaps:[{...gap,original}]},config,15,code);
    assert.deepEqual(s.summary(),{usedHints:false,hintCount:0});
    for(let i=1;i<=3;i++) assert.deepEqual(s.reveal(gap.id),{stage:i,hints:gap.hints.slice(0,i)});
    assert.equal(s.reveal(gap.id).stage,3);
    assert.deepEqual(s.summary(),{usedHints:true,hintCount:3}); marked++;
  }
  for(const level of [15,30,50,75,100]) for(let i=0;i<100;i++){
    const seed=generateExercise(code,config,level,random);
    const session=createHintSession(seed,config,level,code);
    const ids=session.targets.map(t=>t.id); assert.deepEqual(ids,level===100?['full']:seed.gaps.map(g=>g.id));
    for(const id of ids){ assert.equal(session.get(id).stage,0); session.reveal(id); }
    assert.equal(session.summary().hintCount,ids.length);
    const id=ids[0]; session.reveal(id); session.reveal(id); assert.equal(session.get(id).hints[2],level===100?code:seed.gaps[0].original);
    for(const other of ids.slice(1)) assert.equal(session.get(other).stage,1);
    assert.equal(createHintSession(seed,config,level,code).summary().hintCount,0); runs++;
  }
}
assert.throws(()=>createHintSession({gaps:[{id:'a',original:'x',hints:['a','b','wrong']}]},{},15,''));
console.log(`OK: ${marked} marked fragments; ${runs} sessions, all levels, separate hint stages, stats, fresh session, invalid data`);

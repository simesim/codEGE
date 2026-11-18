import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PythonClient } from '../js/python-client.js';
import { loadTests, checkCode, normalizeOutput } from '../js/checker.js';
class FakeWorker {
  constructor(mode='good') { this.mode=mode; this.terminated=false; setTimeout(()=> { if (!this.terminated) this.onmessage?.({data:mode==='boot-error'?{type:'boot-error',message:'no network'}:{type:'ready'}}); }, 2); }
  postMessage({requestId,payload}) {
    if (this.mode==='timeout' || payload.code==='hang') return;
    if (this.mode==='crash') { setTimeout(()=>this.onerror?.({}),1); return; }
    setTimeout(()=>{if(!this.terminated) this.onmessage?.({data:{type:'result',requestId,result:{stdout:payload.stdin,stderr:'',error:null}}})},1);
  }
  terminate() { this.terminated=true; }
}
const workers=[];
const client=new PythonClient({createWorker:()=>{ const w=new FakeWorker(); workers.push(w); return w; },testTimeout:20,loadTimeout:100});
await client.prepare(); assert(client.ready);
const tests=await loadTests({tests:[{id:'1',stdin:'  12 \n 24 ',expected:'12 24'},{id:'2',stdin:'36 12',expected:'12 36'}]}, new URL('file:///tmp/'));
const summary=await checkCode(client,'print()',tests); assert.equal(summary.passed,1); assert.equal(summary.total,2); assert(!summary.success);
assert.equal(normalizeOutput('12\n24'),'12 24'); assert.notEqual(normalizeOutput('1 2'),'12');
const timed=await client.run({code:'hang'}); assert.equal(timed.error.type,'Timeout'); assert(workers[0].terminated); assert(!client.ready);
await client.run({code:'ok',stdin:'1'}); assert.equal(workers.length,2); client.stop();
const bad=new PythonClient({createWorker:()=>new FakeWorker('boot-error'),loadTimeout:100}); await assert.rejects(()=>bad.prepare()); assert(!bad.ready);
let tries=0; const retry=new PythonClient({createWorker:()=>new FakeWorker(tries++?'good':'boot-error'),loadTimeout:100}); await assert.rejects(()=>retry.prepare()); await retry.prepare(); assert(retry.ready); retry.stop();
const crash=new PythonClient({createWorker:()=>new FakeWorker('crash'),loadTimeout:100}); await assert.rejects(()=>crash.run({code:'ok'})); assert(!crash.ready);
assert.equal((await loadTests({tests:[{id:'x',expected:'1',files:{'24.txt':{path:'tests/input.txt'}}}]},new URL('https://example.com/data/'),async url=>({ok:url.href.endsWith('tests/input.txt'),text:async()=> 'A'})))[0].files['24.txt'],'A');
await assert.rejects(()=>loadTests({tests:[{id:'x',expected:'1',files:{'../a':{text:'a'}}}]},new URL('file:///tmp/')));
await assert.rejects(()=>loadTests({tests:[{id:'x',expected:'1',files:{'a':{path:'tests/../a'}}}]},new URL('file:///tmp/')));
await assert.rejects(()=>loadTests({tests:[]},new URL('file:///tmp/')));
const catalog=JSON.parse(await readFile(new URL('../data/catalog.json',import.meta.url),'utf8'));
let count=0, declared=0; for(const t of catalog.tasks) for(const m of t.templates){ const url=new URL(`../data/${m.path}/config.json`,import.meta.url);const config=JSON.parse(await readFile(url,'utf8'));declared+=config.tests.length;count+=(await loadTests(config,new URL('.',url),async path=>({ok:true,text:()=>readFile(path,'utf8')}))).length; }
assert.equal(count,declared);
console.log(`OK: проверка результатов, загрузка данных, тайм-аут и перезапуск, ошибки загрузки и выполнения (имитация Worker); ${count} тестов прочитаны`);

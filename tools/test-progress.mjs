import assert from 'node:assert/strict';
import {createProgressStore, getStatus, recommend, PROGRESS_PREFIX} from '../js/progress.js';
class MemoryStorage {
  data = new Map();
  get length(){return this.data.size;}
  key(i){return [...this.data.keys()][i]??null;}
  getItem(k){return this.data.get(k)??null;}
  setItem(k,v){this.data.set(k,String(v));}
  removeItem(k){this.data.delete(k);}
}
const storage = new MemoryStorage();
const store = createProgressStore(()=>storage,'codege:/Repo/:');
const other = createProgressStore(()=>storage,'codege:/Other/:');
let id='24-02';
const result=(level, usedHints=false, overrides={})=>({id,level,usedHints,hintCount:usedHints?1:0,passed:8,total:8,...overrides});
const state=()=>getStatus(store.read(id)).key;
const rec=()=>recommend(store.read(id));
assert.equal(state(),'new'); assert.equal(rec(),15);
assert.throws(()=>store.save(result(15,false,{passed:7}))); assert.equal(storage.length,0);
assert.throws(()=>store.save(result(15,false,{total:0,passed:0})));
assert.throws(()=>store.save(result(15,false,{hintCount:1})));
assert.throws(()=>store.save(result(20)));
store.save(result(30,true)); assert.equal(state(),'learning'); assert.equal(rec(),30); assert.deepEqual(store.read(id).passedLevels,[30]);
store.save(result(30)); assert.equal(rec(),50);
store.save(result(100,true)); assert.equal(state(),'learning'); assert.equal(rec(),100);
store.save(result(100)); assert.equal(state(),'consolidating'); assert.equal(rec(),100);
store.save(result(100,true)); assert.equal(store.read(id).independent100,1);
store.save(result(100)); assert.equal(state(),'consolidating'); assert.equal(rec(),100);
store.save(result(100)); assert.equal(state(),'mastered'); assert.equal(rec(),null);
store.save(result(100)); store.save(result(15,true)); assert.equal(store.read(id).independent100,3); assert.equal(state(),'mastered'); assert.deepEqual(store.read(id).passedLevels,[15,30,100]);
assert.deepEqual(createProgressStore(()=>storage,'codege:/Repo/:').read(id),store.read(id));
store.save(result(75,false,{id:'13-01'})); other.save(result(50)); storage.setItem('unrelated','safe');
store.reset(id); assert.equal(state(),'new'); assert.deepEqual(store.read('13-01').passedLevels,[75]); assert.deepEqual(other.read(id).passedLevels,[50]);
store.save(result(15)); store.resetAll(); assert.equal(store.hasAny(),false); assert.equal(other.hasAny(),true); assert.equal(storage.getItem('unrelated'),'safe');
storage.setItem('codege:/Repo/:24-02','broken'); assert.throws(()=>store.read(id)); assert.throws(()=>store.save(result(100))); assert.equal(storage.getItem('codege:/Repo/:24-02'),'broken'); store.resetAll(); assert.equal(state(),'new');
const unavailable=createProgressStore(()=>{throw Error('Blocked')}); assert.throws(()=>unavailable.read(id)); assert.throws(()=>unavailable.save(result(100)));
const full = new MemoryStorage(); full.setItem=()=>{throw Error('Quota exceeded')}; assert.throws(()=>createProgressStore(()=>full).save(result(100))); assert.equal(full.length,0);
console.log('OK: statuses, recommendations, actual levels, three independent successes, failure validation, persistence, scoped resets, damaged/blocked/full storage.');

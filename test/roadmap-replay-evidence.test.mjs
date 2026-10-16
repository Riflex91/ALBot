import test from 'node:test';
import assert from 'node:assert/strict';
import {extractReplayEpisodes,compareReplayReports} from '../src/world/replay-evidence.mjs';
import {createTestReport} from '../src/core/test-report.mjs';

const origin=Date.parse('2026-10-15T10:00:00Z');
function sample(n,extras={}){
 return {seq:n+1,type:'sample',time:new Date(origin+n*5000).toISOString(),
  running:true,rip:false,inventoryBlocked:false,valueActionPending:false,
  task:'farm',farmArea:'goo:main:spawn1',
  farmContext:'same-team-gear-and-monster-schema',map:'main',
  level:63,xp:1000+n*30,gold:10000+n*5,
  hpPotions:3000-n,mpPotions:3000-n,...extras};
}
function report(extras={}){
 return {format:'albot-test-report',formatVersion:1,character:'Ranger',
  realm:'USIV',gameVersion:'2026.10.16',environment:'browser',
  dropped:0,events:Array.from({length:17},(_,i)=>sample(i)),...extras};
}
test('replay derives XP and net stock deltas only within a stable same-gear farm area',()=>{
 const x=extractReplayEpisodes(report());
 assert.equal(x.valid,true);
 assert.equal(x.episodes.length,1);
 const e=x.episodes[0];
 assert.equal(e.durationMs,80000);
 assert.equal(e.xpDelta,480);
 assert.equal(e.goldNetDelta,80);
 assert.equal(e.hpPotionsNetDelta,-16);
 assert.equal(e.deathEvidence,'not-observable-between-samples');
 assert.equal(x.authority,'none');
});
test('replay refuses dropped report chunks and disorder; no source is inferred',()=>{
 assert.equal(extractReplayEpisodes(report({dropped:1})).valid,false);
 const repeated=report();repeated.events[8].time=repeated.events[7].time;
 assert.equal(extractReplayEpisodes(repeated).reason,'unordered-or-invalid-observation-time');
 assert.equal(extractReplayEpisodes(report({events:[]})).episodes.length,0);
});
test('journal, dying, leveling, map or gear changes interrupt comparable episode',()=>{
 for(const [at,change] of [
  [8,{valueActionPending:true}],[8,{inventoryBlocked:true}],
  [8,{rip:true}],[8,{level:64}],[8,{map:'bank'}],
  [8,{farmContext:'changed-gear'}],[8,{task:'supply'}]
 ]){
  const r=report();r.events[at]={...r.events[at],...change};
  const x=extractReplayEpisodes(r);
  assert.equal(x.valid,true);
  assert.equal(x.episodes.length,0,JSON.stringify(change));
 }
});
test('same browser/headless context is comparable in shadow but never an action permission',()=>{
 const b=report(),h=report({environment:'headless',events:Array.from({length:17},
   (_,i)=>sample(i,{xp:1000+i*40}))});
 const r=compareReplayReports([b],[h],{minimumEpisodes:1,minExposureMs:60000});
 assert.equal(r.valid,true);
 assert.equal(r.quality,'comparable-observation');
 assert.ok(r.delta.xpPerHour>0);
 assert.equal(r.decision,'no-automatic-policy-change');
 assert.equal(r.executable,false);
 assert.equal(r.confidence,'unverified-causality');
});
test('different team, game version, realm, area or gear context cannot be compared',()=>{
 const a=report();
 for(const other of [
  report({realm:'EU2'}),
  report({character:'Priest'}),
  report({gameVersion:'2026.10.17'}),
  report({events:Array.from({length:17},(_,i)=>sample(i,{farmContext:'different'}))}),
  report({events:Array.from({length:17},(_,i)=>sample(i,{farmArea:'bee:main:spawn'}))})
 ]){
  assert.equal(compareReplayReports([a],[other]).reason,
   'incomparable-team-gear-realm-or-spawn');
 }
});
test('low exposure and zero proof never become reliable learning results',()=>{
 const r=compareReplayReports([report()],[report()]);
 assert.equal(r.valid,true);
 assert.equal(r.quality,'insufficient-exposure');
 assert.equal(compareReplayReports([report({dropped:4})],[report()]).valid,false);
});
test('runtime test report samples include XP/level and net potion stocks as observations',()=>{
 const p={c:{name:'Ranger',map:'main',items:[{name:'hpot0',q:240},
  {name:'mpot0',q:150}],xp:10350,level:47,hp:100,mp:60,
  gold:5000,rip:false},headless:true,G:{version:'test'},realm:()=> 'USIV'};
 const rpt=createTestReport(p,'test');
 rpt.sample({running:true,reason:'farm',task:'farm',
  farmArea:'goo:main:spawn1',farmContext:'semantic-gear-hash',
  inventoryBlocked:false,valueActionPending:false});
 const row=rpt.document().events.find(e=>e.type==='sample');
 assert.equal(row.xp,10350);
 assert.equal(row.level,47);
 assert.equal(row.hpPotions,240);
 assert.equal(row.mpPotions,150);
 assert.equal(row.farmContext,'semantic-gear-hash');
});

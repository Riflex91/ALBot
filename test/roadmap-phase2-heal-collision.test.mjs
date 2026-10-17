import test from 'node:test';
import assert from 'node:assert/strict';
import {healCollisionDecision} from '../src/combat/impact-coordination.mjs';
import {createImpactIntents} from '../src/combat/impact-intents.mjs';
import {createSkills} from '../src/combat/skills.mjs';

const realm='USIV';
const current=()=>Date.now();
const target=(hp=780)=>({name:'Ranger',type:'character',map:'main',
 in:'main',x:10,y:0,hp,max_hp:1000,rip:false,mp:200,max_mp:300});
function peer(now=Date.now(),change={}){
 return {name:'OtherPriest',running:true,rip:false,
  session:'p2',realm,received:now-100,
  impactIntents:[{kind:'heal',action:'heal',session:'p2',realm,
   at:now-150,expires:now+1100,targets:['Ranger']}],...change};
}
const roster=new Set(['Priest','OtherPriest','Ranger']);
function decision(hp=780,peers=[peer()],now=current()){
 return healCollisionDecision({target:target(hp),now,sources:peers,
  realm,roster});
}
test('only noncritical fresh covered player heal is deferred',()=>{
 assert.equal(decision(780).defer,true);
 assert.equal(decision(780).reason,'fresh-team-heal-pending');
 assert.equal(decision(640).defer,false,'low HP rescue always proceeds');
 assert.equal(decision(849).defer,true);
 assert.equal(decision(850).defer,false,'no heal indicated above ordinary threshold');
 assert.equal(decision(780,[]).defer,false);
 assert.equal(decision(780,[peer(Date.now(),{realm:'EU2'})]).defer,false);
 assert.equal(decision(780,[peer(Date.now(),{session:'restarted'})]).defer,false);
});
test('stale, offline, future, or wrong-target heal intents cannot suppress healing',()=>{
 const now=current();
 for(const p of [
  peer(now,{received:now-5000}),
  peer(now,{received:now+20}),
  peer(now,{running:false}),
  peer(now,{rip:true}),
  peer(now,{impactIntents:[{...peer(now).impactIntents[0],expires:now-1}]}),
  peer(now,{impactIntents:[{...peer(now).impactIntents[0],targets:['Other']}]})
 ]){
  assert.equal(decision(750,[p],now).defer,false);
 }
 assert.equal(healCollisionDecision({target:{...target(750),max_hp:0},
  sources:[peer(now)],now,realm,roster}).defer,false);
});
test('rejected, timed-out, and successful heal confirmations unblock next cast',()=>{
 let t=1000;const ledger=createImpactIntents({name:'OtherPriest',session:'p2',
  realm,now:()=>t,ttlMs:1200});
 const one=ledger.launched('heal',['Ranger'],{kind:'heal'});
 const p=()=>({name:'OtherPriest',running:true,rip:false,
  realm,session:'p2',received:t,impactIntents:ledger.heartbeat()});
 const choose=()=>healCollisionDecision({target:target(750),now:t,
  sources:[p()],roster,realm});
 assert.equal(choose().defer,true);
 assert.equal(ledger.settle(one,'rejected'),true);
 assert.equal(choose().defer,false);
 const two=ledger.launched('heal',['Ranger'],{kind:'heal'});
 assert.equal(choose().defer,true);
 assert.equal(ledger.observe({id:'server-h1',actor:'OtherPriest',target:'Ranger',heal:120}),true);
 assert.equal(choose().defer,false);
 const three=ledger.launched('heal',['Ranger'],{kind:'heal'});
 assert.equal(choose().defer,true);
 t+=1201;
 assert.equal(ledger.snapshot().expired,1);
 assert.equal(choose().defer,false);
 assert.equal(ledger.settle(three,'rejected'),false);
});
function skillsFixture({hp=780,pending=true,stale=false}={}){
 const now=Date.now(),friend=target(hp),cast=[];
 const c={name:'Priest',ctype:'priest',map:'main',in:'main',x:0,y:0,
  hp:1000,max_hp:1000,mp:300,max_mp:400,level:60,
  attack:100,range:120,slots:{},s:{}};
 const cfg={general:{testLogging:true},
  party:{enabled:true,healing:true,aoeMaxTargets:5,buffs:false,revive:false,
   advancedSkills:false},skills:[],farming:{maxAggro:3,pvp:false}};
 const a=peer(now,{received:stale?now-6000:now-100});
 const bot={p:{c,G:{skills:{heal:{class:['priest'],level:1,mp:20,
  target:'player',range:100}},items:{},maps:{main:{}}},realm:()=>realm,
  parent:{is_pvp:false},
  call:(id)=>id==='is_on_cooldown'?false:true},
  me:{name:'Priest',role:'farmer'},cfg,farmers:['Priest','Ranger','OtherPriest'],
  transport:{fresh:n=>n==='OtherPriest'&&pending?a:null},
  teamNames:['Priest','Ranger','OtherPriest'],allies:()=>[friend],
  exec:{run:(key,resources,guard,invoke)=>{if(!guard())return false;
   cast.push(key);return true;}},count:()=>0,event:()=>{},
  logistics:{reserved:false},canConsumeImplicit:()=>true};
 return {bot,friend,cast,skills:createSkills(bot)};
}
test('real automatic heal support defers duplication but never emergency healing',()=>{
 const covered=skillsFixture({hp:780});
 assert.equal(covered.skills.support(),false);
 assert.deepEqual(covered.cast,[]);
 const emergency=skillsFixture({hp:500});
 assert.equal(emergency.skills.support(),true);
 assert.deepEqual(emergency.cast,['skill:heal']);
 const old=skillsFixture({hp:780,stale:true});
 assert.equal(old.skills.support(),true);
 assert.deepEqual(old.cast,['skill:heal']);
});
test('explicit user-authored heal bypasses noncritical deconfliction',()=>{
 const f=skillsFixture();
 assert.equal(f.skills.use('heal',f.friend,.05,250,5,true),true);
 assert.deepEqual(f.cast,['skill:heal']);
});
test('observed server hit/heal counts and latency cannot imply actual HP restoration',()=>{
 let t=1000;
 const l=createImpactIntents({name:'Priest',session:'p1',realm,now:()=>t,
  ttlMs:2500});
 l.launched('heal',['Ranger'],{kind:'heal'});
 t+=350;
 assert.equal(l.observe({id:'h1',actor:'Priest',target:'Ranger',heal:90,
  realm}),true);
 assert.equal(l.observe({id:'h1',actor:'Priest',target:'Ranger',heal:90,
  realm}),false);
 l.launched('attack',['mob-1'],{kind:'damage'});
 t+=140;
 assert.equal(l.observe({id:'d1',actor:'Priest',target:{id:'mob-1'},
  damage:41,realm:'EU2'}),false);
 assert.equal(l.observe({id:'mix',actor:'Priest',target:'mob-1',
  damage:41,heal:20}),false);
 assert.equal(l.observe({id:'d1',actor:'Priest',target:{id:'mob-1'},
  damage:41,realm}),true);
 const result=l.snapshot();
 assert.equal(result.observedHealing,90);
 assert.equal(result.observedDamage,41);
 assert.equal(result.confirmed,1);
 assert.equal(result.confirmedHeals,1);
 assert.equal(result.observedLatencySamples,2);
 assert.equal(result.observedLatencyP95Ms,350);
 assert.equal(result.mode,'shadow-only');
 l.close();assert.equal(l.snapshot().observedLatencySamples,0);
});

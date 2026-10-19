import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecovery,unchangedPurchaseJournal} from '../src/core/recovery.mjs';
import {identity,fingerprint} from '../src/core/policy.mjs';
import {createSkills} from '../src/combat/skills.mjs';
import {createEncounter} from '../src/combat/encounter.mjs';
import {createAccount} from '../src/party/account.mjs';
import {neutralPullReadiness} from '../src/combat/team-readiness.mjs';

function purchase(){
 const inventory=[{name:'poison',q:7},...Array(41).fill(null)],store=new Map(),events=[];
 const journal={kind:'ponty.buy',item:'poison',quantity:3,before:7,cost:3600,loss:0,slots:[],at:1000,
  evidence:{realm:'EUII',gold:200000,inventory:inventory.map(i=>i?fingerprint(i):null)}};
 const bot={journal,inventoryBlocked:true,me:{name:'M',role:'merchant'},cfg:{party:{merchant:'M'},general:{}},
  p:{c:{name:'M',items:inventory,gold:200000,isize:42,q:{}},G:{},realm:()=>'EUII',read:k=>store.get(k),write:(k,v)=>{store.set(k,v);return true;}},
  exec:{pending:new Map()},logistics:{reserved:false},gold:{reserved:false},
  checkpoint:{durable:true,clear:()=>true},endValue:result=>{assert.equal(result,'confirmed');bot.journal=null;},
  event:(type,data)=>events.push({type,data})};
 return {bot,journal,store,events};
}
test('captured legacy Ponty journal recovers only after two unchanged full snapshots; original evidence is archived',()=>{
 const old=Date.now;let now=122000;Date.now=()=>now;
 try{const {bot,store}=purchase(),recovery=createRecovery(bot);
  assert.equal(recovery.reconcile(),false);assert.ok(bot.journal);
  now+=2001;assert.equal(recovery.reconcile(),true);
  assert.equal(bot.journal,null);assert.equal(bot.inventoryBlocked,false);
  const archived=store.get('albot:purchase-recovery:M')[0];
  assert.equal(archived.journal.kind,'ponty.buy');assert.equal(archived.replayed,false);
 }finally{Date.now=old;}
});
test('purchase recovery keeps locks on partial, changed, pending, foreign or non-durable evidence',()=>{
 for(const alter of [b=>b.p.c.gold--,b=>b.p.c.items[0].q++,b=>b.p.c.items.pop(),
  b=>b.p.c.items[1]={name:'placeholder'},b=>b.checkpoint.durable=false,
  b=>b.exec.pending.set('ponty.buy',{}),b=>b.journal.evidence.realm='USIV',
  b=>b.journal.kind='send',b=>b.logistics.reserved=true]){
  const {bot}=purchase();alter(bot);assert.equal(unchangedPurchaseJournal(bot,122000),false);
 }
 const {bot}=purchase();assert.equal(unchangedPurchaseJournal(bot,120000),false);
});
test('late exact purchase observation is retried instead of permanently caching the first inconclusive check',()=>{
 const {bot,journal}=purchase();journal.variant=identity({name:'poison'});journal.at=Date.now();
 const recovery=createRecovery(bot);assert.equal(recovery.reconcile(),false);
 bot.p.c.items[0].q=10;bot.p.c.gold=196400;
 assert.equal(recovery.reconcile(),true);assert.equal(bot.journal,null);
});
test('archive or checkpoint storage failure never releases a purchase lock',()=>{
 const old=Date.now;let now=122000;Date.now=()=>now;
 try{for(const stage of ['archive','clear']){const {bot}=purchase();
  if(stage==='archive')bot.p.write=()=>false;else bot.checkpoint.clear=()=>false;
  const recovery=createRecovery(bot);recovery.reconcile();now+=2001;
  assert.equal(recovery.reconcile(),false);assert.ok(bot.journal);assert.equal(bot.inventoryBlocked,true);
 }}finally{Date.now=old;}
});
function archer(){
 const calls=[],mobs=[0,1,2].map(i=>({id:'rat'+i,type:'monster',mtype:'rat',hp:1000,max_hp:1000,
  map:'main',in:'main',x:20+i,y:0,target:i<2?'R':null,armor:0,resistance:0}));
 const c={name:'R',ctype:'ranger',level:61,attack:377,frequency:1,hp:4000,max_hp:4499,mp:800,max_mp:905,
  range:150,map:'main',in:'main',x:0,y:0,slots:{},s:{},items:[]};
 const bot={me:{name:'R',role:'farmer'},running:true,leader:'R',farmers:['R'],teamNames:['R'],
  cfg:{general:{testLogging:true},world:{risk:'aggressive'},farming:{maxAggro:12,pullHp:.75,pullMp:.3},party:{enabled:false,aoe:true,aoeMaxTargets:5},skills:[]},
  p:{c,parent:{},G:{items:{},maps:{main:{}},monsters:{rat:{hp:1000,attack:10,frequency:1}},skills:{'3shot':{class:['ranger'],level:60,damage_multiplier:.7,mp:200,range:150,hostile:true}}},
   read:()=>null,write:()=>true,call:(method,...args)=>{if(method==='use_skill')calls.push(args);return method==='is_on_cooldown'?false:true;}},
  monsters:()=>mobs,entity:id=>mobs.find(m=>m.id===id),allowed:m=>!!m?.target,
  strategy:{safeTarget:()=>true},teamPlan:{target:()=>'rat',wantsCombat:()=>true,roles:()=>({})},
  capabilities:{snapshot:()=>({ready:[],sustainable:['3shot'],aoe:[]})},
  gear:{snapshot:()=>({class:'ranger',level:61,slots:{mainhand:{name:'bow',level:5}},stats:{attack:c.attack}})},
  transport:{fresh:()=>null},allies:()=>[],count:()=>0,event:()=>{},
  exec:{run:(_k,_r,guard,fn)=>{if(!guard())return false;fn();return true;}}};
 return {bot,mobs,calls};
}
test('two engaged rats receive a beneficial 3shot without dragging in a third neutral or foreign rat',()=>{
 const {bot,mobs,calls}=archer();const skills=createSkills(bot);skills.rotation(mobs[0]);
 assert.equal(calls[0][0],'3shot');assert.deepEqual(calls[0][1].map(m=>m.id),['rat0','rat1']);
 mobs[2].target='Foreign';calls.length=0;createSkills(bot).rotation(mobs[0]);
 assert.deepEqual(calls[0][1].map(m=>m.id),['rat0','rat1']);
});
test('two-target 3shot needs a verified damage benefit and still respects explicit mana rules',()=>{
 const {bot,mobs,calls}=archer();bot.p.G.skills['3shot'].damage_multiplier=.4;
 createSkills(bot).rotation(mobs[0]);assert.equal(calls.length,0);
 bot.p.G.skills['3shot'].damage_multiplier=.7;
 bot.cfg.skills=[{skill:'3shot',class:'ranger',enabled:true,minMp:.9,everyMs:100,maxTargets:3,conditions:[],target:'enemy'}];
 bot.measure=()=>({});createSkills(bot).rotation(mobs[0]);assert.equal(calls.length,0);
});
test('encounter capacity no longer collapses on shared attack cooldown or temporary gear telemetry loss',()=>{
 const {bot}=archer();
 let advertised=true;bot.farmers=['R','P'];bot.teamNames=['R','P'];
 bot.transport.fresh=()=>({name:'P',class:'priest',level:48,running:true,hp:3300,max_hp:3405,mp:1400,max_mp:1710,
  ...(advertised?{gear:{class:'priest',level:48,slots:{mainhand:{name:'staff',level:3}},stats:{attack:145}}}:{})});
 const encounter=createEncounter(bot);encounter.tick();const context=encounter.status().context;assert.equal(encounter.status().capacity,3);
 advertised=false;bot.p.c.attack=400;encounter.tick();assert.equal(encounter.status().context,context);assert.equal(encounter.status().capacity,3);
 bot.p.G.skills['3shot'].damage_multiplier=.7;
 assert.equal(bot.capabilities.snapshot().aoe.length,0);
});
test('rotation drain blocks new pulls and preserves defense against already engaged monsters',()=>{
 const {bot}=archer();bot.account={rotationPending:()=>true};
 assert.equal(neutralPullReadiness(bot).reason,'account-rotation-draining');
});
test('aggressive probe admits two in range without approving a distant third and retains known failure vetoes',()=>{
 const {bot,mobs}=archer();mobs[2].x=500;
 let encounter=createEncounter(bot);encounter.tick();
 assert.equal(encounter.status().capacity,2);
 const context=encounter.status().context;
 bot.p.read=()=>({[context+':2']:{samples:1,failures:1}});
 encounter=createEncounter(bot);encounter.tick();assert.equal(encounter.status().capacity,1);
});
test('Merchant value quarantine does not hide eligible catch-up; live combat drains before browser switch',()=>{
 const old=Date.now;let now=10000;Date.now=()=>now;
 try{const peers={R:{name:'R',class:'ranger',level:61,running:true,hp:4000,max_hp:4500,realm:'EUII',session:'r',threats:1,browserSwitch:{supported:true},stats:{attack:377}},
  P:{name:'P',class:'priest',level:48,running:true,hp:3300,max_hp:3405,realm:'EUII',session:'p',stats:{attack:145}}};
  const bot={me:{name:'M',role:'merchant'},running:true,inventoryBlocked:true,journal:{kind:'ponty.buy'},leader:'R',farmers:['R','P'],
   cfg:{general:{messageTtlMs:10000},production:{},party:{merchant:'M',leader:'',selection:'adaptive',maxFarmers:2,rotationCooldownMs:1000,balanceFarmers:true,balanceHoldMs:5000,balanceLevelGap:2},
    characters:['R','P','Weak'].map(name=>({name,enabled:true,role:'farmer',rotation:true,class:name==='P'?'priest':'ranger'}))},
   p:{headless:false,c:{name:'M'},G:{},realm:()=>'EUII',read:()=>null,write:()=>true},
   transport:{fresh:n=>peers[n],ownCharacters:()=>[{name:'Weak',class:'ranger',level:12}],send:()=>true},
   exec:{pending:new Map()},logistics:{},monsters:()=>[],event:()=>{},report:()=>{}};
  const account=createAccount(bot);now+=6000;account.tick();
  assert.equal(bot.accountChoice.catchUp.in,'Weak');assert.equal(account.rotationPending(),true);
  assert.match(bot.accountChoice.waiting,/draining/);assert.equal(account.status().transition,null);
  peers.R.threats=0;now+=1000;account.tick();assert.equal(account.status().transition.in,'Weak');
 }finally{Date.now=old;}
});

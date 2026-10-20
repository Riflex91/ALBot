import test from 'node:test';
import assert from 'node:assert/strict';
import {Executor} from '../src/core/executor.mjs';
import {createCaveTeamCoordination}
 from '../src/world/cave-team-coordination.mjs';
import {caveCriticalHealTriage,createCaveCriticalHealTriage}
 from '../src/world/cave-critical-heal-triage.mjs';
import {cavePriestHealPreflight,createCavePriestHealing}
 from '../src/world/cave-priest-healing.mjs';
import {createFarmer} from '../src/combat/farmer.mjs';

const when=1770000000000,run='a'.repeat(24),
 map=`zone_${run}_1`;
function fixture(){
 const calls=[],events=[],state={now:when,cooldown:false,canHeal:true};
 const c={name:'P',ctype:'priest',type:'character',
  map,in:map,cave:{run},rip:false,x:0,y:0,
  hp:100,max_hp:100,mp:240,max_mp:300,mp_cost:20};
 const peers={
  R1:{name:'R1',class:'ranger',map,in:map,x:40,y:0,
   hp:38,max_hp:100,threats:1,received:when,running:true,realm:'EUI'},
  R2:{name:'R2',class:'ranger',map,in:map,x:50,y:0,
   hp:62,max_hp:100,threats:1,received:when,running:true,realm:'EUI'}
 };
 const shown={
  R1:{...peers.R1,type:'character',visible:true},
  R2:{...peers.R2,type:'character',visible:true}
 };
 const spider=(id,mtype,target,x)=>({
  id,type:'monster',mtype,target,map,in:map,x,y:0,
  hp:80,dead:false
 });
 const m1=spider('a','small','R1',55),
  m2=spider('b','large','R2',65);
 state.monsters=[m1,m2];
 const names=['P','R1','R2'];
 const p={c,G:{
  skills:{heal:{mp:20}},
  monsters:{small:{attack:1,frequency:1},
   large:{attack:12,frequency:1},
   giant:{attack:30,frequency:1}}
 },realm:()=> 'EUI',
 has:name=>['heal','can_heal','is_on_cooldown'].includes(name),
 call:(action,...args)=>{
  calls.push([action,...args]);
  if(action==='can_heal')return state.canHeal;
  if(action==='is_on_cooldown')return state.cooldown;
  if(action==='heal')return Promise.resolve({success:true});
  throw Error('unsupported native '+action);
 }};
 const bot={p,me:{name:'P',role:'farmer'},running:true,
  session:'own',farmers:names,leader:'R1',target:null,
  cfg:{party:{enabled:true,waitForTeam:true,healing:true},
   farming:{enabled:true,hpBelow:.3,mpBelow:.3,restBelow:.2,
    resumeAbove:.9,potions:false}},
  transport:{fresh:n=>peers[n]},
  entity:n=>shown[n]??null,
  monsters:()=>state.monsters,
  cave:{status:()=>({realm:'EUI',live:{
   run,floor:1,map,serverTime:when,paused:false,
   roster:names.map(name=>({name,left:false,disconnected:false}))
  }})},
  caveLifecycle:{status:()=>({state:'live-observed',
   journal:{phase:'observed-run',name:'P',realm:'EUI',
    observed:{run,floor:1,map,at:when}}})},
  bank:{pending:false},logistics:{reserved:false,handoffActive:false},
  gold:{reserved:false},
  event:(...a)=>events.push(a)
 };
 bot.exec=new Executor({now:()=>state.now,active:()=>bot.running,
  limit:4,admit:()=>true,onEvent:()=>{},onError:()=>{}});
 bot.caveTeam=createCaveTeamCoordination(bot,{now:()=>state.now});
 bot.caveCriticalTriage=createCaveCriticalHealTriage(bot,{now:()=>state.now});
 bot.cavePriest=createCavePriestHealing(bot,{now:()=>state.now});
 return {bot,p,c,peers,shown,m1,m2,state,calls,events,names};
}
const heals=f=>f.calls.filter(([name])=>name==='heal');

test('N12 Priest heals higher immediate damage pressure before weaker lower-HP target',()=>{
 const f=fixture(),team=f.bot.caveTeam.healStatus();
 assert.equal(team.ready,true);
 const risk=caveCriticalHealTriage(f.bot,{team,now:when});
 assert.equal(risk.ready,true,risk.reason);
 assert.equal(risk.attackerCount,2);
 assert.equal(risk.preferred,'R2','four-second risk outranks lower 38% HP');
 assert.equal(risk.canHeal,false,'read-only triage cannot grant heal');
 assert.equal(risk.canMove,false);
 const pre=cavePriestHealPreflight(f.bot,{now:when});
 assert.equal(pre.ready,true,pre.reason);
 assert.equal(pre.triageMode,'verified-multi-aggro');
 assert.equal(pre.targetName,'R2');
 assert.ok(pre.triageSignature?.includes('b:R2:large'));
 assert.equal(f.bot.cavePriest.tick(),true);
 assert.equal(heals(f).length,1);
 assert.equal(heals(f)[0][1],f.shown.R2);
 assert.equal(f.bot.cavePriest.status().target,undefined);
});

test('N12 critical self-healing overrides the team threat order',()=>{
 const f=fixture();f.c.hp=30;
 const plan=f.bot.caveCriticalTriage.status();
 assert.equal(plan.ready,true);
 assert.equal(plan.preferred,'P');
 const heal=cavePriestHealPreflight(f.bot,{now:when});
 assert.equal(heal.targetName,'P');
 assert.equal(f.bot.cavePriest.tick(),true);
 assert.equal(heals(f)[0][1],f.c);
});

test('N12 triage status remains read-only and never leaks mutable entities',()=>{
 const f=fixture(),s=f.bot.caveCriticalTriage.status();
 assert.equal(s.ready,true);
 assert.equal(s.preferred,'R2');
 assert.ok(s.ranked.some(x=>x.name==='R1'));
 assert.equal(s.target,undefined);
 assert.equal(s.monster,undefined);
 assert.deepEqual(f.calls,[]);
 assert.deepEqual(f.events,[]);
});

test('N12 incomplete aggro evidence does not grant new action; original single-heal remains',()=>{
 const edits=[
  f=>{f.peers.R2.threats=0},
  f=>{delete f.peers.R2.threats},
  f=>{f.peers.R1.received=when-3100},
  f=>{f.peers.R2.map='main'},
  f=>{f.shown.R2.visible=false},
  f=>{f.shown.R2.x+=9},
  f=>{f.shown.R2.hp=40},
  f=>{f.m2.id='a'},
  f=>{f.m2.map='main'},
  f=>{f.m2.hp=null},
  f=>{f.m2.type='character'},
  f=>{f.m2.mtype='unknown'},
  f=>{f.p.G.monsters.large.attack=NaN},
  f=>{f.p.G.monsters.large.frequency=0},
  f=>{f.state.monsters=null},
  f=>{f.state.monsters=[f.m1,f.m2,{...f.m2,id:'c',target:'R2'} ,
   {...f.m2,id:'d',target:'R2'}]}
 ];
 for(let i=0;i<edits.length;i++){
  const f=fixture();edits[i](f);
  const triage=f.bot.caveCriticalTriage.status();
  assert.equal(triage.ready,false,'variant '+i+': '+triage.reason);
  const p=cavePriestHealPreflight(f.bot,{now:when});
  if(p.ready){
   assert.equal(p.triageMode,'legacy-single-heal');
   assert.equal(p.triageSignature,null);
  }
  assert.equal(heals(f).length,0,'triage is never a game action');
 }
});

test('N12 missing multi-aggro cannot suppress existing life-saving single heal',()=>{
 const f=fixture();
 f.state.monsters=[f.m1];f.peers.R2.threats=0;
 assert.equal(f.bot.caveCriticalTriage.status().ready,false);
 const p=cavePriestHealPreflight(f.bot,{now:when});
 assert.equal(p.ready,true,p.reason);
 assert.equal(p.triageMode,'legacy-single-heal');
 assert.equal(p.targetName,'R1','legacy lowest-HP heal retained');
 assert.equal(f.bot.cavePriest.tick(),true);
 assert.equal(heals(f)[0][1],f.shown.R1);
});

test('N12 three attacked enemies still choose the most urgent wounded member',()=>{
 const f=fixture();
 f.state.monsters.push({...f.m2,id:'c',target:'R1',
  mtype:'small',x:68});
 f.peers.R1.threats=2;
 const p=f.bot.caveCriticalTriage.status();
 assert.equal(p.ready,true,p.reason);
 assert.equal(p.attackerCount,3);
 assert.equal(p.preferred,'R2');
 assert.equal(cavePriestHealPreflight(f.bot,{now:when}).targetName,'R2');
});

test('N12 dynamic changes to any secondary enemy or risk cancel queued heal',()=>{
 const edits=[
  f=>{f.m1.hp--},
  f=>{f.m1.x+=2},
  f=>{f.m1.mtype='large'},
  f=>{f.m2.target='P';f.peers.R2.threats=0},
  f=>{f.p.G.monsters.small.attack+=1},
  f=>{f.p.G.monsters.large.frequency+=1},
  f=>{f.peers.R1.hp-=1;f.shown.R1.hp-=1},
  f=>{f.peers.R2.hp-=1;f.shown.R2.hp-=1},
  f=>{f.peers.R2.x+=2;f.shown.R2.x+=2},
  f=>{f.shown.R1.x+=2},
  f=>{f.c.hp-=1},
  f=>{f.c.map='main';f.c.in='main'},
  f=>{f.state.now+=3100},
  f=>{f.state.monsters.push({...f.m1,id:'new',target:'R1'})},
  f=>{f.bot.journal={kind:'value'}}
 ];
 for(let i=0;i<edits.length;i++){
  const f=fixture();f.bot.exec.beginFrame();
  assert.equal(f.bot.cavePriest.tick(),true,'initial allowed '+i);
  assert.equal(heals(f).length,0);
  edits[i](f);
  f.bot.exec.flush();
  assert.equal(heals(f).length,0,'stale critical heal must abort '+i);
 }
});

test('N12 final network-boundary recheck cancels changed risk after scheduler accepted',()=>{
 const f=fixture(),original=f.bot.monsters;let reads=0;
 f.bot.monsters=()=>{
  reads++;
  if(reads===3)f.m2.x+=6;
  return original();
 };
 assert.equal(f.bot.cavePriest.tick(),true);
 assert.equal(heals(f).length,0,'network call cannot use old aggro geometry');
});

test('N12 Cave farmer executes prioritized native single heal, no farm rotation or movement',()=>{
 const f=fixture();
 f.bot.skills={rotation:()=>{throw Error('no overworld skill')}};
 f.bot.movement={order:null,go:()=>{throw Error('no Cave route')}};
 createFarmer(f.bot).tick();
 assert.equal(heals(f).length,1);
 assert.equal(heals(f)[0][1],f.shown.R2);
 assert.equal(f.bot.reason,'Cave: gezielte Priest-Heilung angefordert');
 assert.equal(f.calls.some(([name])=>name==='smart_move'),false);
 assert.equal(f.calls.some(([name])=>name==='attack'),false);
});

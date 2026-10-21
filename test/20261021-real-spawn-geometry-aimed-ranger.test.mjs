import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 combatPosition,verifiedFarmSpawnRectangle,distanceFromFarmRectangle,
 sharedSpawnPositionEvidence,assessFollowerSharedSpawn,
 verifiedLowThreatAimedSet
} from '../src/combat/team-readiness.mjs';
import {createEncounter} from '../src/combat/encounter.mjs';
import {createSkills} from '../src/combat/skills.mjs';

// Exact snake source bounds and approx. character positions are taken from
// the 2026-10-20 0.21 live diagnostic (halloween:snake:2:1af13363).
// Transient game monsters in the logs do not include all raw/real fields;
// explicitly model each coordinate representation without inventing
// unattested historical raw entity positions.
const now=Date.now();
const plan={id:'leader:snake:real-spawn',target:'snake',
 map:'halloween',in:'halloween',realm:'EUII',
 x:-569,y:-511.5,bounds:['halloween',-720,-820,-418,-203],
 expires:now+60000};
const actor={name:'My_Ranger2',ctype:'ranger',
 map:'halloween',in:'halloween',x:-548,y:-455,
 hp:4600,max_hp:4800,mp:1300,max_mp:1600,
 attack:380,frequency:1.1,range:300,level:55,
 slots:{mainhand:{name:'bow'},offhand:{name:'quiver'}}};
const leader={name:'My_Ranger1',realm:'EUII',running:true,
 rip:false,received:now,map:'halloween',in:'halloween',
 x:-541,y:-473,hp:4500,max_hp:4800,mp:1300,max_mp:1600,
 farmPlan:{...plan},target:'other-snake',stats:{
 attack:380,frequency:1.1,range:300,heal:0}};
const priest={name:'My_Priest',realm:'EUII',running:true,
 rip:false,received:now,map:'halloween',in:'halloween',
 x:-523,y:-542,hp:3100,max_hp:3300,mp:1900,max_mp:2100,
 class:'priest',stats:{attack:150,frequency:1.0,range:200,heal:300}};
const mobs=n=>Array.from({length:n},(_,i)=>({
 id:String(70000+i),type:'monster',mtype:'snake',
 map:'halloween',in:'halloween',x:-510+i*12,
 y:-470+i*4,hp:250,max_hp:250,target:null
}));
const game={maps:{halloween:{pvp:false}},
 monsters:{snake:{hp:250,attack:14,frequency:1,
  armor:0,resistance:0,avoidance:0,evasion:0,reflection:0}},
 skills:{
  '3shot':{hostile:true,damage_multiplier:.95,range:300,mp:80,
    class:['ranger'],level:1,share:'attack'},
  '5shot':{hostile:true,damage_multiplier:.7,range:300,mp:110,
    class:['ranger'],level:1,share:'attack'}
 },
 items:{bow:{wtype:'bow'},quiver:{wtype:'bow'}}};
const options={plan,leader,realm:'EUII',game,now};

test('replay halloween snake: inside verified rectangle, not hard-coded centroid circle',()=>{
 const r=assessFollowerSharedSpawn(actor,mobs(1)[0],options);
 assert.equal(r.allowed,true,JSON.stringify(r));
 const far={...mobs(1)[0],x:-425,y:-790};
 assert.ok(Math.hypot(far.x-plan.x,far.y-plan.y)>190);
 assert.equal(assessFollowerSharedSpawn(actor,far,options).allowed,true);
 const rect=verifiedFarmSpawnRectangle(plan);
 assert.equal(distanceFromFarmRectangle({x:-425,y:-790},rect),0);
});

test('one complete real position pair preferred, with finite raw fallback and diagnostics',()=>{
 const a={...actor,x:-3000,y:-3000,real_x:-548,real_y:-455};
 const m={...mobs(1)[0],x:null,y:null,real_x:-510,real_y:-470};
 assert.deepEqual(combatPosition(m),{x:-510,y:-470,source:'real'});
 assert.equal(assessFollowerSharedSpawn(a,m,options).allowed,true);
 const r=assessFollowerSharedSpawn(a,{...m,real_x:null},options);
 assert.equal(r.reason,'missing-physical-position');
 assert.equal(r.monster?.source,undefined);
 assert.deepEqual(r.monsterRaw,[null,null]);
 const fallback={...m,real_x:Infinity,real_y:0,x:-510,y:-470};
 assert.equal(combatPosition(fallback).source,'raw');
 assert.equal(assessFollowerSharedSpawn(actor,fallback,options).allowed,true);
});

test('separate precise denials for actor, monster, leader, mutual gap, and invalid rectangle',()=>{
 const m=mobs(1)[0];
 assert.equal(assessFollowerSharedSpawn({...actor,x:-1000},m,options).reason,'actor-outside-spawn');
 assert.equal(assessFollowerSharedSpawn(actor,{...m,x:-1000},options).reason,'target-outside-spawn');
 assert.equal(assessFollowerSharedSpawn(actor,m,{...options,
  leader:{...leader,x:-1000}}).reason,'leader-outside-spawn');
 const wide={...plan,bounds:['halloween',-720,-820,0,-203]};
 assert.equal(assessFollowerSharedSpawn({...actor,x:-700,y:-800},
  {...m,x:-10,y:-280},{...options,plan:wide,leader:{...leader,
  x:-541,y:-473,farmPlan:wide}}).reason,'team-support-gap');
 assert.equal(assessFollowerSharedSpawn(actor,m,{...options,
  plan:{...plan,bounds:['main',-720,-820,-418,-203]}}).reason,
  'invalid-spawn-rectangle');
});

test('3shot (2/3) and 5shot (4/5) have distinct ID and conservative combined safety budgets',()=>{
 const sk3=game.skills['3shot'],sk5=game.skills['5shot'];
 for(const [id,count,skill] of [['3shot',2,sk3],['3shot',3,sk3],
   ['5shot',4,sk5],['5shot',5,sk5]]){
  const proof=verifiedLowThreatAimedSet(actor,mobs(count),{
   ...options,skillId:id,skill});
  assert.equal(proof.allowed,true,JSON.stringify(proof));
  assert.equal(proof.targets,count);
 }
 assert.equal(verifiedLowThreatAimedSet(actor,mobs(3),{
  ...options,skillId:'5shot',skill:sk5}).allowed,false);
 assert.equal(verifiedLowThreatAimedSet(actor,[mobs(2)[0],mobs(2)[0]],{
  ...options,skillId:'3shot',skill:sk3}).reason,'duplicate-or-missing-aimed-id');
 const strong={...game,monsters:{snake:{...game.monsters.snake,attack:700}}};
 assert.equal(verifiedLowThreatAimedSet(actor,mobs(5),{
  ...options,game:strong,skillId:'5shot',skill:sk5}).allowed,false);
 assert.equal(verifiedLowThreatAimedSet(actor,[...mobs(2),{...mobs(1)[0],id:'unsafe',mtype:'rat'}],{
  ...options,skillId:'3shot',skill:sk3}).allowed,false);
});

function runtime({character=actor,targets=mobs(5),leaderName='My_Ranger1',
 peerLeader=leader,peerPriest=priest,deferDispatch=false}={}){
 const started=[],events=[],pending=[],
  roster=['My_Ranger1','My_Ranger2','My_Priest'];
 let live=targets;
 const p={c:character,G:game,root:{},parent:{},
  realm:()=> 'EUII',read:()=>({}),write:()=>{},
  call:(method,...args)=>{
   if(method==='is_on_cooldown')return false;
   if(method==='use_skill'){started.push({id:args[0],
     ids:args[1]?.map?.(e=>String(e.id))??[]});return {success:true};}
   return true;
  }};
 const cfg={general:{testLogging:true},party:{
  enabled:true,waitForTeam:true,aoeMaxTargets:5,
  healing:true,focusFire:true},farming:{
  freeSlots:3,maxAggro:12,pullHp:.75,pullMp:.5,restBelow:.4,
  pvp:false},skills:[],world:{excludedMaps:[]}};
 const bot={p,me:{name:character.name,role:'farmer'},
  leader:leaderName,teamNames:roster,farmers:roster,
  running:true,recovering:false,inventoryBlocked:false,
  journal:null,logistics:{reserved:false},cfg,events,
  monsters:()=>live,entity:id=>live.find(m=>String(m.id)===String(id))??null,
  free:()=>30,event:(type,data)=>events.push({type,...data}),
  strategy:{busy:false,safeTarget:()=>true},
  teamPlan:{heartbeat:()=>plan,target:()=>plan.target,
   wantsCombat:()=>true,roles:()=>({})},
  transport:{fresh:n=>n===leader.name?peerLeader:n===priest.name?
    peerPriest:{...actor,name:'My_Ranger2',realm:'EUII',
    running:true,received:now,
    stats:{attack:actor.attack,frequency:actor.frequency,range:actor.range}}},
  exec:{run:(key,resources,guard,invoke,opts)=>{
    if(!guard())return false;
    if(deferDispatch){pending.push({guard,invoke,opts});return true;}
    const result=invoke();opts?.onSettle?.('returned',result);
    return true;}},
  skillWakeups:null};
 bot.combatAssessment={emergency:()=>({active:false})};
 bot.encounter=createEncounter(bot);
 bot.allowed=(m,admission)=>!!m&&!m.target&&
  m.mtype===plan.target&&m.map===character.map&&
  (bot.encounter.permit(m)||
   admission?.independentAimedSpawnSkill&&
   bot.encounter.aimedSpawnAssessment(m).allowed);
 bot.skills=createSkills(bot);
 return {bot,started,events,setLive:next=>{live=next;},
  dispatchPending:()=>{
    const q=pending.shift();
    if(!q||!q.guard())return false;
    const result=q.invoke();q.opts?.onSettle?.('returned',result);
    return true;
  }};
}

test('full Ranger2 workflow: 5shot dispatches EXACT five vetted live IDs',()=>{
 const {bot,started,events}=runtime();
 assert.equal(bot.encounter.approveAimedSpawnPull(
  bot.monsters(),'5shot',game.skills['5shot']).safe,true);
 assert.equal(bot.skills.independentOneShotAoE(),true);
 assert.equal(started.length,1);
 assert.equal(started[0].id,'5shot');
 assert.deepEqual(started[0].ids,mobs(5).map(x=>x.id));
 assert.ok(events.some(e=>e.type==='combat.independentSharedSpawnAoE'&&
  e.skill==='5shot'));
});

test('full Ranger2 workflow: 3shot dispatches two when 5shot lacks legal target count',()=>{
 const {bot,started}=runtime({targets:mobs(2)});
 assert.equal(bot.skills.independentOneShotAoE(),true);
 assert.equal(started[0].id,'3shot');
 assert.equal(started[0].ids.length,2);
});

test('full leader Ranger workflow authorizes independently aimed AoE, but blocks stale or wounded party',()=>{
 const leadActor={...actor,name:'My_Ranger1'};
 const r=runtime({character:leadActor,leaderName:'My_Ranger1'});
 assert.equal(r.bot.skills.independentOneShotAoE(),true);
 assert.equal(r.started[0].id,'5shot');
 const q=runtime({peerPriest:{...priest,received:now-10000}});
 assert.equal(q.bot.skills.independentOneShotAoE(),false);
 assert.equal(q.started.length,0);
});

test('network-dispatch guard refuses vanished monsters between selection and call',()=>{
 const {bot,started,setLive}=runtime();
 const skill=game.skills['5shot'];
 assert.equal(bot.encounter.approveAimedSpawnPull(
  bot.monsters(),'5shot',skill).safe,true);
 setLive(mobs(5).slice(1));
 assert.equal(bot.encounter.approveAimedSpawnPull(
  [mobs(5)[0],...bot.monsters()],'5shot',skill).safe,false);
 assert.equal(started.length,0);
});

test('actual runtime layer routes only explicit skill admission via per-target verifier',()=>{
 const main=readFileSync(new URL('../src/main.mjs',import.meta.url),'utf8');
 const skills=readFileSync(new URL('../src/combat/skills.mjs',import.meta.url),'utf8');
 assert.match(main,/independentAimedSpawnSkill/);
 assert.match(main,/aimedSpawnAssessment/);
 assert.match(skills,/approveAimedSpawnPull\?\.\(selected,id,s\)/);
 assert.match(skills,/bot\.encounter\.approveAimedSpawnPull\(selected,id,skill\)/);
});

test('late execution refuses all five shots if one native ID vanishes after admission',()=>{
 const r=runtime({deferDispatch:true});
 assert.equal(r.bot.skills.independentOneShotAoE(),true,
  'candidate was approved and the executor action queued');
 assert.equal(r.started.length,0);
 r.setLive(mobs(5).slice(1));
 assert.equal(r.dispatchPending(),false,'live dispatch guard must abort');
 assert.equal(r.started.length,0,'no skill may hit stale game objects');
});

test('shared core coordinate contract never combines real X and old raw Y',async()=>{
 const {xy,distance}=await import('../src/core/policy.mjs');
 const a={x:-548,y:-455,real_x:-900,real_y:undefined};
 assert.deepEqual(xy(a),{x:-548,y:-455});
 assert.equal(distance(a,{x:-548,y:-455}),0);
 assert.equal(distance({real_x:42,real_y:undefined},{x:42,y:17}),Infinity);
});

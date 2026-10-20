import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessFollowerSharedSpawn} from '../src/combat/team-readiness.mjs';
import {createEncounter} from '../src/combat/encounter.mjs';

const now=Date.now();
const plan={id:'leader:bee:spawn',realm:'EUII',
 map:'main',in:'main',x:546,y:1059,target:'bee',
 expires:now+30000};
const ranger2={name:'My_Ranger2',ctype:'ranger',map:'main',in:'main',
 x:591,y:1087,hp:4300,max_hp:4500,mp:716,max_mp:2000,
 attack:55,frequency:1.2,range:290};
const leader={name:'My_Ranger1',running:true,rip:false,realm:'EUII',
 map:'main',in:'main',x:588,y:1088,received:now,
 farmPlan:{...plan},target:'other-bee'};
const bee={id:'bee-neighbor',type:'monster',mtype:'bee',map:'main',in:'main',
 x:570,y:1082,hp:300,max_hp:300,target:null,dead:false};
const beeMeta={hp:300,attack:24,frequency:1,armor:0,resistance:0};
const options={plan,leader,realm:'EUII',
 game:{monsters:{bee:beeMeta}},now};
const admits=(actor=ranger2,m=bee,o=options)=>
 assessFollowerSharedSpawn(actor,m,o);

test('reproduced bee spawn: follower can independently select a low-threat monster even without an exact one-shot',()=>{
 const result=admits();
 assert.equal(result.allowed,true,JSON.stringify(result));
 assert.equal(result.planId,plan.id);
 assert.ok(result.exposure>0);
});

test('nearby Priest also has autonomous low-threat spawn permission',()=>{
 const priest={...ranger2,name:'My_Priest',ctype:'priest',
  x:587,y:1086,attack:46,hp:3200,max_hp:3300,
  mp:1502,max_mp:2400};
 assert.equal(admits(priest).allowed,true);
});

test('plan and live game identity are strict but not an arbitrary 85-unit anchor rule',()=>{
 assert.equal(admits({...ranger2,x:650,y:1110}).allowed,true);
 assert.equal(admits({...ranger2,x:820,y:1110}).reason,'outside-assembled-spawn');
 assert.equal(admits(ranger2,{...bee,mtype:'rat'}).reason,'no-valid-shared-spawn');
 assert.equal(admits(ranger2,bee,{...options,plan:{...plan,expires:now-1}}).reason,'no-valid-shared-spawn');
 assert.equal(admits(ranger2,bee,{...options,leader:{...leader,received:now-8000}}).reason,'leader-or-spawn-proof-stale');
 assert.equal(admits(ranger2,bee,{...options,leader:{...leader,march:{plan:'stale'},farmPlan:null}}).reason,'leader-or-spawn-proof-stale');
});

test('weak spawn admission forbids unsafe personal health, high creature damage and hard monster mechanics',()=>{
 assert.equal(admits({...ranger2,hp:1500}).reason,'actor-not-combat-ready');
 assert.equal(admits(ranger2,{...bee,target:'Other'}).reason,'not-neutral-live-monster');
 assert.equal(admits(ranger2,{...bee,hp:20000}).reason,'unbounded-health-or-guard');
 assert.equal(admits(ranger2,bee,{...options,game:{monsters:{bee:{...beeMeta,attack:1800}}}}).reason,'bounded-personal-survival-failed');
 assert.equal(admits(ranger2,bee,{...options,game:{monsters:{bee:{...beeMeta,boss:true}}}}).reason,'monster-mechanics-unverified');
 assert.equal(admits(ranger2,bee,{...options,game:{monsters:{bee:{...beeMeta,abilities:{stun:{}}}}}}).reason,'monster-mechanics-unverified');
});

function mockEncounter({
 actor=ranger2,live=[bee],leaderState=leader,
 safe=true,emergency=false,planState=plan
}={}){
 const farmers=['My_Ranger1','My_Ranger2','My_Priest'];
 const bot={
  me:{name:actor.name,role:'farmer'},leader:'My_Ranger1',
  running:true,recovering:false,inventoryBlocked:false,journal:null,
  p:{c:actor,G:{...options.game,maps:{main:{pvp:false}}},
   realm:()=> 'EUII',read:()=>({}),parent:{}},
  cfg:{party:{enabled:true,healing:true},farming:{freeSlots:3,maxAggro:12}},
  teamNames:farmers,farmers,
  monsters:()=>live,free:()=>30,
  strategy:{busy:false,safeTarget:()=>safe},
  teamPlan:{heartbeat:()=>planState,target:()=>planState?.target,wantsCombat:()=>true},
  transport:{fresh:n=>n==='My_Ranger1'?leaderState:{
    name:'My_Priest',running:true,received:now,realm:'EUII',
    map:'main',in:'main',hp:3200,max_hp:3300,mp:1800,max_mp:2000,
    x:587,y:1086}},
  combatAssessment:{emergency:()=>({active:emergency})}
 };
 return createEncounter(bot);
}
test('end-to-end encounter permission is now truly independent of leader target and one-hit damage',()=>{
 const encounter=mockEncounter();
 assert.equal(encounter.soloOneShot(bee),null);
 assert.equal(encounter.soloBoundedSpawn(bee),null);
 assert.equal(encounter.sharedSpawnAssessment(bee).reason,'verified-low-threat-spawn');
 assert.equal(encounter.permit(bee),true);
});

test('leader may already be fighting another monster while a follower takes its own spawn target',()=>{
 const m={...bee,id:'leader-monster',target:'My_Ranger1'};
 const encounter=mockEncounter({live:[m,bee]});
 assert.equal(encounter.permit(bee),true);
});

test('one foe per follower, fixed concurrent monster limit, actual strategy and emergency gates',()=>{
 const own={...bee,id:'r2-aggro',target:'My_Ranger2'};
 assert.equal(mockEncounter({live:[own,bee]}).sharedSpawnAssessment(bee).reason,'follower-already-under-attack');
 const threats=['My_Ranger1','My_Priest','My_Ranger1'].map((name,i)=>({
  ...bee,id:'engaged-'+i,target:name}));
 assert.equal(mockEncounter({live:[...threats,bee]}).sharedSpawnAssessment(bee).reason,'team-threat-capacity-reached');
 assert.equal(mockEncounter({safe:false}).sharedSpawnAssessment(bee).reason,'strategy-declines-monster');
 assert.equal(mockEncounter({emergency:true}).sharedSpawnAssessment(bee).reason,'follower-operational-hold');
});

test('combat tick genuinely calls shared-spawn permission and includes denial diagnostics',()=>{
 const farmer=readFileSync(new URL('../src/combat/farmer.mjs',import.meta.url),'utf8');
 const skills=readFileSync(new URL('../src/combat/skills.mjs',import.meta.url),'utf8');
 assert.match(farmer,/bot\.encounter\?\.soloSharedSpawn\?\.\(m\)/);
 assert.match(farmer,/combat\.independentSharedSpawn/);
 assert.match(farmer,/combat\.followerSpawnAudit/);
 assert.match(skills,/bot\.encounter\?\.soloSharedSpawn\?\.\(m\)/);
 assert.match(skills,/combat\.independentSharedSpawnAoE/);
});

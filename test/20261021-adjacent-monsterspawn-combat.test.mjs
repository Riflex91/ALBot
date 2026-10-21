import test from 'node:test';
import assert from 'node:assert/strict';
import {
 verifiedAdjacentFarmSpawns,sharedSpawnPositionEvidence,
 assessFollowerSharedSpawn,verifiedLowThreatAimedSet
} from '../src/combat/team-readiness.mjs';
import {createEncounter} from '../src/combat/encounter.mjs';

// Shape and location of the two adjacent bee rectangles are taken from the
// Oct 21 ALBot 0.26 in-game report/video. Other species use constructed,
// equally valid official G.maps layouts: the algorithm must not special-case
// bees, map=main or these exact coordinates.
const now=Date.now();
const beeA=['main',448,694,592,812],
 beeB=['main',678,676,796,764];
const snakeA=['halloween',-720,-820,-418,-203],
 snakeB=['halloween',-335,-800,-155,-330],
 ratA=['mansion',-408,-102,-158,27],
 ratB=['mansion',-95,-100,55,45];
const G={maps:{
 main:{pvp:false,monsters:[
  {type:'bee',count:3,boundaries:[beeA,beeB]},
  {type:'goo',count:3,boundaries:[['main',900,680,1020,780]]}
 ]},
 halloween:{pvp:false,monsters:[
  {type:'snake',count:6,boundaries:[snakeA,snakeB]}]},
 mansion:{pvp:false,monsters:[
  {type:'rat',count:3,boundaries:[ratA,ratB]}]},
 fortress:{pvp:true,monsters:[
  {type:'bee',count:1,boundaries:[['fortress',0,0,80,80]]}]},
 crypt:{instance:true,monsters:[
  {type:'bee',count:1,boundaries:[['crypt',0,0,80,80]]}]}
 },monsters:{
 bee:{hp:300,attack:24,frequency:1,armor:0,resistance:0},
 snake:{hp:250,attack:18,frequency:1,armor:0,resistance:0},
 rat:{hp:290,attack:20,frequency:1,armor:0,resistance:0},
 goo:{hp:100,attack:10,frequency:1,armor:0,resistance:0}
 }};
const createState=(target,map,a,b,player,leaderPos)=>{
 const bounds=a,id='farm-'+map+'-'+target;
 const plan={id,target,map,in:map,realm:'EUII',
  bounds,x:(a[1]+a[3])/2,y:(a[2]+a[4])/2,expires:now+30000};
 const actor={name:'My_Ranger2',ctype:'ranger',map,in:map,
  x:player[0],y:player[1],hp:4300,max_hp:4500,mp:1000,max_mp:1400,
  attack:300,frequency:1.2,range:235};
 const leader={name:'My_Ranger1',realm:'EUII',running:true,rip:false,
  map,in:map,x:leaderPos[0],y:leaderPos[1],
  received:now,farmPlan:plan,target:'other-monster'};
 const monster=(x,y,id='side-monster')=>({
  id,type:'monster',mtype:target,map,in:map,x,y,hp:220,max_hp:220,
  target:null,dead:false});
 return {plan,actor,leader,monster,
  assess:m=>assessFollowerSharedSpawn(actor,m,{
   plan,leader,realm:'EUII',game:G,now})};
};

test('real bee spawn A+B: right bees are valid adjacent official targets, even >65 beyond plan',()=>{
 const st=createState('bee','main',beeA,beeB,[558,750],[545,751]);
 const bee=st.monster(708,741);
 const oldGap=708-592;
 assert.ok(oldGap>65);
 const candidates=verifiedAdjacentFarmSpawns(st.plan,G);
 assert.equal(candidates.length,1);
 assert.deepEqual(candidates[0].rect,
  {map:'main',minX:678,minY:676,maxX:796,maxY:764});
 const assessment=st.assess(bee);
 assert.equal(assessment.allowed,true,JSON.stringify(assessment));
 assert.equal(assessment.position.areaKind,'adjacent');
 assert.equal(assessment.position.primaryTargetGap,oldGap);
 assert.equal(assessment.position.targetGap,0);
});

test('same generic spatial evidence works for snake on halloween and rat in mansion',()=>{
 for(const [type,map,a,b,person,lead,mob] of [
  ['snake','halloween',snakeA,snakeB,[-432,-550],[-439,-551],[-321,-555]],
  ['rat','mansion',ratA,ratB,[-175,-25],[-182,-25],[-72,-20]]
 ]){
  const st=createState(type,map,a,b,person,lead);
  assert.ok(verifiedAdjacentFarmSpawns(st.plan,G).length>0);
  const result=st.assess(st.monster(...mob));
  assert.equal(result.allowed,true,type+':'+JSON.stringify(result));
  assert.equal(result.position.areaKind,'adjacent');
 }
});

test('cannot invent an unofficial farm rectangle or authorize same-type roamers across the map',()=>{
 const st=createState('bee','main',beeA,beeB,[558,750],[545,751]);
 assert.equal(st.assess(st.monster(1100,735)).allowed,false);
 const unauthorized={...st.plan,bounds:['main',-200,600,-100,800],x:-150,y:700};
 assert.deepEqual(verifiedAdjacentFarmSpawns(unauthorized,G),[]);
 assert.equal(verifiedAdjacentFarmSpawns(st.plan,{...G,
  maps:{main:{monsters:[{type:'bee',boundaries:[beeB]}]}}}).length,0);
 const outOfRange=st.monster(790,739);
 assert.equal(st.assess(outOfRange).reason,
  'target-outside-verified-nearby-spawns');
});

test('never extends an officially selected spawn into different species, realm, instance or PvP',()=>{
 const st=createState('bee','main',beeA,beeB,[558,750],[545,751]);
 const bee=st.monster(708,741);
 assert.equal(st.assess({...bee,mtype:'goo'}).allowed,false);
 assert.equal(st.assess({...bee,target:'My_Ranger1'}).allowed,false);
 assert.equal(assessFollowerSharedSpawn(st.actor,bee,{
  plan:st.plan,leader:st.leader,realm:'EUUS',game:G,now}).allowed,false);
 const pvp=createState('bee','fortress',['fortress',0,0,80,80],
  ['fortress',90,0,170,80],[40,40],[40,41]);
 assert.deepEqual(verifiedAdjacentFarmSpawns(pvp.plan,G),[]);
 const cave=createState('bee','crypt',['crypt',0,0,80,80],
  ['crypt',90,0,170,80],[40,40],[40,41]);
 assert.deepEqual(verifiedAdjacentFarmSpawns(cave.plan,G),[]);
});

test('high-damage or boss species remains rejected even inside adjacent official region',()=>{
 const st=createState('bee','main',beeA,beeB,[558,750],[545,751]);
 const bee=st.monster(708,741);
 assert.equal(st.assess(bee).allowed,true);
 const boss={...G,monsters:{...G.monsters,
  bee:{...G.monsters.bee,boss:true}}};
 const result=assessFollowerSharedSpawn(st.actor,bee,{
  plan:st.plan,leader:st.leader,realm:'EUII',game:boss,now});
 assert.equal(result.reason,'monster-mechanics-unverified');
 const dangerous={...G,monsters:{...G.monsters,
  bee:{...G.monsters.bee,attack:1800}}};
 const second=assessFollowerSharedSpawn(st.actor,bee,{
  plan:st.plan,leader:st.leader,realm:'EUII',game:dangerous,now});
 assert.equal(second.reason,'bounded-personal-survival-failed');
});

test('adjacent spawn approval carries through the existing encounter permit gate',()=>{
 const st=createState('bee','main',beeA,beeB,[558,750],[545,751]);
 const bee=st.monster(708,741);
 const bot={
  me:{name:st.actor.name,role:'farmer'},
  leader:'My_Ranger1',running:true,recovering:false,journal:null,
  inventoryBlocked:false,logistics:{reserved:false},
  p:{c:st.actor,G,realm:()=> 'EUII',parent:{}},
  cfg:{party:{enabled:true},farming:{freeSlots:3,maxAggro:12}},
  teamNames:['My_Ranger1','My_Ranger2','My_Priest'],
  monsters:()=>[bee],free:()=>30,
  teamPlan:{heartbeat:()=>st.plan,target:()=>st.plan.target,
   wantsCombat:()=>true},
  strategy:{busy:false,safeTarget:()=>true},
  transport:{fresh:()=>st.leader},
  combatAssessment:{emergency:()=>({active:false})}
 };
 const encounter=createEncounter(bot);
 assert.equal(encounter.sharedSpawnAssessment(bee).allowed,true);
 assert.equal(encounter.permit(bee),true);
});

test('conservative ranged 3shot/5shot aggregate proof handles adjacent official spawn, not generic unlimited AoE',()=>{
 const st=createState('bee','main',beeA,beeB,[558,750],[545,751]);
 const targets=[0,1,2,3,4].map(i=>st.monster(688+i*8,720,'n-'+i));
 for(const [skillId,count] of [['3shot',2],['3shot',3],['5shot',4],['5shot',5]]){
  const skill={hostile:true,damage_multiplier:.7};
  const result=verifiedLowThreatAimedSet(st.actor,targets.slice(0,count),{
   plan:st.plan,leader:st.leader,realm:'EUII',game:G,now,skillId,skill});
  assert.equal(result.allowed,true,skillId+':'+JSON.stringify(result));
 }
 const different=[...targets.slice(0,2),{...targets[2],id:'goo',mtype:'goo'}];
 assert.equal(verifiedLowThreatAimedSet(st.actor,different,{
  plan:st.plan,leader:st.leader,realm:'EUII',game:G,now,
  skillId:'3shot',skill:{hostile:true,damage_multiplier:.7}}).allowed,false);
});

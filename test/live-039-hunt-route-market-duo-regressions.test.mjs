import test from 'node:test';
import assert from 'node:assert/strict';
import {createMovement} from '../src/core/movement.mjs';
import {assessQuestDetachment} from '../src/combat/quest-detachment.mjs';
import {neutralPullReadiness} from '../src/combat/team-readiness.mjs';
import {createMarket} from '../src/merchant/market.mjs';
import {fitHeartbeat,compactFarmPlan} from '../src/party/transport.mjs';

const dest={map:'main',in:'main',x:-35,y:-162,radius:60};
test('Monsterhunt faster Town retries after interrupt before walking; max three attempts',()=>{
 const clock=Date.now;let now=40000;Date.now=()=>now;
 try{
  const events=[],runs=[],c={name:'My_Ranger2',map:'main',in:'main',
   x:1500,y:0,speed:50,c:{},moving:false,rip:false,stand:false};
  const bot={running:true,me:{name:c.name,role:'farmer'},
   cfg:{world:{excludedMaps:[]},farming:{pvp:false},
    merchant:{townMinSavingsMs:3000}},
   p:{c,G:{maps:{main:{spawns:[[0,0]]}}},root:{},parent:{},
    has:()=>true,call:()=>Promise.resolve()},
   teamNames:['My_Ranger1','My_Ranger2','My_Priest'],
   monsters:()=>[],lootDeparture:{beforeDeparture:()=>true},
   event:(type,data)=>events.push({type,data}),session:'r2',
   exec:{pending:new Map(),busy:()=>false,cancelResource:()=>{},
    run:(key,resources,guard,invoke,options)=>{
     if(!guard())return false;
     runs.push({key,options});if(key==='travel.town')invoke();
     return true;
    }}};
  const m=createMovement(bot);
  const casts=()=>runs.filter(r=>r.key==='travel.town');
  m.go(dest,'quest');assert.equal(casts().length,1);
  casts().at(-1).options.onSettle('rejected',{reason:'interrupted'});
  assert.equal(m.go(dest,'quest'),false,'pending retry cannot turn into footwalk');
  assert.equal(m.order,null);
  now+=4001;m.go(dest,'quest');assert.equal(casts().length,2);
  casts().at(-1).options.onSettle('rejected',{reason:'interrupted'});
  now+=4001;m.go(dest,'quest');assert.equal(casts().length,3);
  casts().at(-1).options.onSettle('rejected',{reason:'interrupted'});
  assert.equal(m.go(dest,'quest'),false);
  assert.equal(casts().length,3,'bounded attempts must not spam game channel');
  assert.equal(m.order?.mode,'smart_move','after three failures ordinary navigation is allowed');
  assert.equal(events.filter(e=>e.type==='travel.townRetry').length,3);
  m.stop();
 }finally{Date.now=clock;}
});

function duo(self='My_Priest'){
 const names=['My_Ranger1','My_Ranger2','My_Priest'];
 const peers=Object.fromEntries(names.map((name,i)=>[name,{
  name,realm:'EUII',running:true,rip:false,map:'main',in:'main',
  x:105+i*5,y:105,hp:100,max_hp:100,mp:100,max_mp:100,
  class:name==='My_Priest'?'priest':'ranger',threats:0,
  questVisit:name==='My_Ranger2',received:Date.now()
 }]));
 const plan={id:'r1:plan:1',kind:'farm',target:'bee',map:'main',in:'main',
  x:100,y:100,key:'bee:main:1',leader:'My_Ranger1',objective:null,
  realm:'EUII',expires:Date.now()+30000};
 peers.My_Ranger1.farmPlan=plan;
 const bot={running:true,me:{name:self,role:'farmer'},
  leader:'My_Ranger1',farmers:names,teamNames:names,
  cfg:{party:{enabled:true,waitForTeam:true,followDistance:180},
   farming:{pullHp:.75,pullMp:.5}},
  p:{c:{...peers[self],s:{}},realm:()=> 'EUII',G:{skills:{},monsters:{bee:{hp:10,attack:1}}}},
  transport:{fresh:name=>name===self?null:peers[name]},
  teamPlan:{heartbeat:()=>null,valid:()=>true},
  strategy:{busy:false},monsters:()=>[],account:{rotationPending:()=>false}};
 return {bot,peers,plan};
}
test('remote Ranger2 quest leaves Ranger1 and Priest with verifiable 2-person farm anchor',()=>{
 const {bot}=duo('My_Priest');
 assert.deepEqual(assessQuestDetachment(bot)?.active,['My_Ranger1','My_Priest']);
 assert.equal(assessQuestDetachment(bot)?.puller,'My_Ranger1');
 assert.equal(neutralPullReadiness(bot).reason,'follower-cannot-pull');
 const leader=duo('My_Ranger1');
 leader.bot.teamPlan.heartbeat=()=>leader.plan;
 assert.equal(neutralPullReadiness(leader.bot).reason,'two-farmer-conservative');
});
test('fallback leader anchor cannot bypass risk, stale data, mismatch or detached actor danger',()=>{
 const {bot,peers}=duo();
 bot.teamPlan.valid=()=>false;
 assert.equal(assessQuestDetachment(bot),null);
 bot.teamPlan.valid=()=>true;
 peers.My_Ranger1.farmPlan.leader='Foreign';
 assert.equal(assessQuestDetachment(bot),null);
 peers.My_Ranger1.farmPlan.leader='My_Ranger1';
 peers.My_Ranger1.farmPlan.kind='hunt';
 assert.equal(assessQuestDetachment(bot),null);
 peers.My_Ranger1.farmPlan.kind='farm';
 peers.My_Ranger1.farmPlan.expires=Date.now()-1;
 assert.equal(assessQuestDetachment(bot),null);
 peers.My_Ranger1.farmPlan.expires=Date.now()+30000;
 peers.My_Ranger1.threats=2;
 assert.equal(assessQuestDetachment(bot),null);
 peers.My_Ranger1.threats=0;
 peers.My_Ranger1.x=500;
 assert.equal(assessQuestDetachment(bot),null);
});
test('idle merchant must not visit Ponty when no currently authorized market acquisition exists',()=>{
 const travel=[],marketBot={
  p:{c:{name:'My_Merchant',items:[],slots:{},gold:1000},
   entities:{},read:()=>null},
  me:{name:'My_Merchant'},exec:{},
  cfg:{merchant:{ponty:true,giveaways:false,marketHistory:false},
   items:[]},event(){},running:true
 };
 marketBot.economy={destination:()=>{travel.push('destination');return {map:'main',x:100,y:0};}};
 const market=createMarket(marketBot);
 assert.equal(market.background(),false);
 assert.deepEqual(travel,['destination'],'nonbuy market survey no longer travels');
 marketBot.cfg.items=[{enabled:true,item:'poison',action:'marketBuy'}];
 marketBot.economy.remaining=()=>true;
 marketBot.economy.npcTravel=()=>{travel.push('npcTravel');return false;};
 assert.equal(market.background(),true,'explicit desired market demand still permitted');
 assert.ok(travel.includes('npcTravel'));
});

test('compact leader march anchor survives ordinary farmPlan shedding and restores Priest duo proof',()=>{
 const {bot,peers,plan}=duo();
 peers.My_Ranger1.farmPlan=null;
 peers.My_Ranger1.march={plan:plan.id,realm:'EUII',
  anchor:compactFarmPlan(plan)};
 assert.deepEqual(assessQuestDetachment(bot)?.active,
  ['My_Ranger1','My_Priest']);
 const status=fitHeartbeat({
  name:'My_Ranger1',running:true,items:[],materials:[],
  march:peers.My_Ranger1.march,farmPlan:compactFarmPlan(plan),
  stock:'x'.repeat(2400),performance:'y'.repeat(1400),
  gearOrders:'z'.repeat(900)
 },4200);
 assert.ok(status,'trimmed status must still be deliverable');
 assert.equal(status.farmPlan,undefined,'bulky optional farmPlan may be shed');
 assert.equal(status.march?.anchor?.id,plan.id,
  'compact validated anchor is transport-critical during a quest');
 peers.My_Ranger1.march.anchor.expires=Date.now()-1;
 assert.equal(assessQuestDetachment(bot),null,
  'expired compact anchor cannot authorize a pull');
});

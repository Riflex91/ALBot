import test from 'node:test';
import assert from 'node:assert/strict';
import {farmingStoragePressure,defensiveFarmTarget}
 from '../src/combat/storage-backpressure.mjs';
import {createFarmer} from '../src/combat/farmer.mjs';
import {createLootBacklog} from '../src/items/loot-departure.mjs';
import {fitHeartbeat} from '../src/party/transport.mjs';

const online={running:true,rip:false,realm:'EUII',storagePressure:true};
test('exact Farmer loot reserve suppresses new combat; hysteresis releases above the reserve',()=>{
 assert.equal(farmingStoragePressure({free:4,reserve:4}), 'FARMER_RESERVE');
 assert.equal(farmingStoragePressure({free:3,reserve:4}), 'FARMER_RESERVE');
 assert.equal(farmingStoragePressure({free:5,reserve:4}), null);
 assert.equal(farmingStoragePressure({free:0,reserve:0}), 'FARMER_RESERVE');
 assert.equal(farmingStoragePressure({free:NaN,reserve:4}), 'FARMER_RESERVE');
});
test('only a running same-realm Merchant heartbeat can pause optional Farmer pulls',()=>{
 assert.equal(farmingStoragePressure({free:20,reserve:4,merchant:online,realm:'EUII'}),
   'MERCHANT_CAPACITY');
 for(const merchant of [null,{...online,running:false},{...online,rip:true},
   {...online,realm:'USIV'},{...online,storagePressure:false},
   {...online,storagePressure:undefined}]){
  assert.equal(farmingStoragePressure({free:20,reserve:4,merchant,realm:'EUII'}),null);
 }
});
test('pressure pause permits only monsters already engaged with this team',()=>{
 const team=['Mage','Ranger'];
 assert.equal(defensiveFarmTarget({target:'Mage'},team),true);
 assert.equal(defensiveFarmTarget({target:'Ranger'},team),true);
 assert.equal(defensiveFarmTarget({target:null},team),false);
 assert.equal(defensiveFarmTarget({target:'Other'},team),false);
 assert.equal(defensiveFarmTarget(null,team),false);
});
test('compact team heartbeat preserves essential Merchant pressure after optional telemetry shedding',()=>{
 const padded=fitHeartbeat({name:'Merchant',running:true,realm:'EUII',
  storagePressure:true,items:[],materials:[],performance:'x'.repeat(3500),
  adaptive:'y'.repeat(3500),stock:'z'.repeat(3500)},4200);
 assert.equal(padded.storagePressure,true);
 assert.equal(padded.performance,undefined);
 assert.ok(JSON.stringify(padded).length<=4200);
});
function farmerFixture({free=10,signal=null,engaged=false,monsters=true}={}){
 const items=Array.from({length:42},(_,idx)=>idx<42-free?{name:'material',q:1}:null);
 const c={name:'Farmer',map:'main',in:'main',x:0,y:0,ctype:'ranger',
  hp:100,max_hp:100,mp:100,max_mp:100,rip:false,
  range:110,speed:20,items,slots:{mainhand:{name:'bow'}}};
 const foe={id:'mob1',type:'monster',mtype:'goo',hp:100,max_hp:100,
  map:'main',in:'main',x:15,y:0,target:engaged?'Farmer':null};
 const attacks=[],skills=[],moves=[],pulls=[];
 const cfg={farming:{enabled:true,loot:true,freeSlots:4,
  lootEveryMs:1000,pvp:false,hpBelow:.5,mpBelow:.4,restBelow:.2,
  resumeAbove:.9,deathWindowMs:60000,rangeBuffer:5,
  autoTravel:false,kiting:false},merchant:{enabled:true},
  party:{merchant:'Merchant',enabled:false},production:{gear:false},
  world:{excludedMaps:[]}};
 const bot={cfg,me:{name:'Farmer',role:'farmer'},
  p:{c,G:{maps:{main:{pvp:false}},items:{}},parent:{is_pvp:false},
   realm:()=> 'EUII',has:name=>name==='loot',
   call:(method)=>method==='is_on_cooldown'?false:
     method==='can_attack'?true:method==='can_move_to'?true:null},
  running:true,reason:'',target:null,teamNames:['Farmer'],
  farmers:['Farmer'],leader:'Farmer',
  monsters:()=>monsters?[foe]:[],
  allowed:()=>true,
  entity:id=>id==='mob1'?foe:null,
  targets:()=>['goo'],
  free:()=>c.items.filter(i=>!i).length,
  count:()=>0,consumable:()=>false,
  strategy:{busy:false,travel:()=>false,safeTarget:()=>true},
  skills:{rotation:target=>skills.push(target?.id??null)},
  movement:{order:null,stop(){moves.push('stop');this.order=null;},
   go:()=>{moves.push('go');return true;}},
  exec:{run(name,locks,guard){
   if(guard?.()!==false)attacks.push(name);return true;
  }},
  transport:{fresh:name=>name==='Merchant'?signal:null},
  logistics:{handoffActive:false,reserved:false},
  gold:{reserved:false},
  encounter:{status:()=>({phase:'IDLE'}),pull:()=>{pulls.push(1);return false;}},
  event:()=>{},pause:()=>{}};
 bot.farmer=createFarmer(bot);
 return {bot,c,foe,attacks,skills,moves,pulls};
}
test('Farmer stops optional pulls exactly at its free-slot reserve, preventing unlootable kills',()=>{
 const f=farmerFixture({free:4});
 f.bot.movement.order={owner:'combat'};
 f.bot.farmer.tick();
 assert.equal(f.bot.target,null);
 assert.equal(f.bot.reason.includes('Inventarreserve erreicht'),true);
 assert.deepEqual(f.attacks,[]);
 assert.deepEqual(f.pulls,[]);
 assert.ok(f.moves.includes('stop'));
});
test('fresh Merchant pressure pauses new passive-mob combat despite ample Farmer capacity',()=>{
 const f=farmerFixture({free:15,signal:online});
 f.bot.farmer.tick();
 assert.equal(f.bot.target,null);
 assert.equal(f.bot.reason.includes('Merchant'),true);
 assert.deepEqual(f.attacks.filter(x=>x==='attack'),[]);
 assert.deepEqual(f.pulls,[]);
});
test('existing allied combat remains eligible for defensive damage while Merchant is pressured',()=>{
 const f=farmerFixture({free:15,signal:online,engaged:true});
 f.bot.farmer.tick();
 assert.equal(f.bot.target?.id,'mob1');
 assert.ok(f.attacks.includes('attack'),'finishing a real team fight must remain possible');
 assert.deepEqual(f.pulls,[],'never initiate a multi-pull during pressure');
});
test('new pulls automatically resume when a fresh Merchant heartbeat clears its hysteretic pressure',()=>{
 let state={...online};
 const f=farmerFixture({free:15});
 f.bot.transport.fresh=()=>state;
 // Collection is deliberately owned by the scheduler, not farmer.tick().
 f.bot.lootBacklog=createLootBacklog(f.bot);
 f.bot.lootBacklog.tick();
 f.bot.farmer.tick();
 assert.deepEqual(f.attacks.filter(x=>x==='attack'),[],
  'pressure blocks NEW attacks but not collecting already dropped loot');
 assert.ok(f.attacks.includes('loot'),
  'pending loot collection remains available during Merchant pressure');
 state={...state,storagePressure:false};
 f.bot.farmer.tick();
 assert.equal(f.bot.target?.id,'mob1');
 assert.ok(f.attacks.includes('attack'));
});
test('absent Merchant heartbeat does not freeze an independent Farmer',()=>{
 const f=farmerFixture({free:15,signal:null});
 f.bot.farmer.tick();
 assert.equal(f.bot.target?.id,'mob1');
 assert.ok(f.attacks.includes('attack'));
});

test('live march regression: Merchant pressure never freezes follower escort',()=>{
 const f=farmerFixture({free:15,signal:online,monsters:false});
 f.bot.cfg.party.enabled=true;f.bot.cfg.party.waitForTeam=true;
 f.bot.farmers=['Farmer','Leader'];f.bot.teamNames=['Farmer','Leader'];
 f.bot.leader='Leader';
 const leader={name:'Leader',running:true,rip:false,realm:'EUII',
  map:'main',in:'main',x:120,y:0,hp:1000,max_hp:1000,
  farmPlan:{map:'main',in:'main',x:520,y:753}};
 f.bot.transport.fresh=n=>n==='Merchant'?online:n==='Leader'?leader:null;
 f.bot.farmer.tick();
 assert.equal(f.bot.reason,'Gruppenmarsch trotz Lagerdruck: Folge Leader');
 assert.ok(f.moves.includes('go'),'Escorting must continue under inventory pressure');
 assert.deepEqual(f.pulls,[],'The escort never grants permission to pull');
});
test('live march regression: Leader can reach an authorized farm before storage pressure blocks neutral pulls',()=>{
 const f=farmerFixture({free:15,signal:online,monsters:false});
 f.bot.cfg.party.enabled=true;f.bot.cfg.party.waitForTeam=true;
 f.bot.farmers=['Farmer'];f.bot.leader='Farmer';
 f.bot.teamPlan={heartbeat:()=>({map:'main',in:'main',x:520,y:753})};
 let travels=0;f.bot.strategy.travel=()=>{travels++;return true;};
 f.bot.farmer.tick();
 assert.equal(travels,1);
 assert.deepEqual(f.pulls,[]);
});
test('live march regression: Priest transit heal takes priority over Merchant capacity stall',()=>{
 const f=farmerFixture({free:15,signal:online,monsters:false});
 f.c.ctype='priest';f.bot.cfg.party.enabled=true;
 f.bot.cfg.party.healing=true;f.bot.farmers=['Farmer','Leader'];
 f.bot.leader='Leader';
 f.bot.teamPlan={heartbeat:()=>({map:'main',in:'main',x:520,y:753})};
 const patient={name:'Leader',running:true,rip:false,realm:'EUII',
  received:Date.now()-1000,map:'main',in:'main',x:55,y:0,
  hp:400,max_hp:1000};
 f.bot.p.G.skills={heal:{range:140}};
 f.bot.transport.fresh=n=>n==='Merchant'?online:n==='Leader'?patient:null;
 f.bot.entity=n=>n==='Leader'?patient:null;
 let rescued=0;f.bot.skills.rescue=()=>{rescued++;return true;};
 f.bot.farmer.tick();
 assert.equal(rescued,1);
 assert.match(f.bot.reason,/Notfallheilung/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {measuredSlotUtilityPriority} from '../src/production/gear-fairness.mjs';
import {createGear} from '../src/production/gear.mjs';

const now=Date.now();
const slots=['mainhand','offhand','helmet','chest','pants','shoes',
 'gloves','amulet','belt','cape','ring1','ring2','earring1','earring2','orb'];
const profile=(at=now)=>({complete:true,realm:'EUI',class:'merchant',
 level:70,at,slots:Object.fromEntries(slots.map(slot=>[slot,null]))});
const goal=(character,slot,utility,rest={})=>({
 character,slot,utility,chance:1,estimatedCost:10,enabled:true,...rest
});

test('W05/W08 measured role utility orders distinct slots only within the recipient',()=>{
 const high=goal('Merchant','shoes',200);
 const low=goal('Merchant','belt',20);
 const other=goal('Priest','mainhand',1e7);
 const options={profile:profile(),now};
 assert.equal(measuredSlotUtilityPriority(high,[high,low,other],options),12);
 assert.equal(measuredSlotUtilityPriority(low,[high,low,other],options),0);
 assert.equal(measuredSlotUtilityPriority(other,[high,low,other],options),0,
  'a goal must have the current recipient profile');
 assert.equal(measuredSlotUtilityPriority(high,[other,low,high],options),12,
  'cohort order is irrelevant');
});

test('W05/W08 no invented gain for ties, sole goal, or duplicate slots',()=>{
 const a=goal('M','helmet',30),b=goal('M','chest',30);
 const options={profile:profile(),now};
 assert.equal(measuredSlotUtilityPriority(a,[a,b],options),0);
 assert.equal(measuredSlotUtilityPriority(a,[a],options),0);
 assert.equal(measuredSlotUtilityPriority(a,[{...a}],options),0,
  'not a stored verified optimizer candidate');
 assert.equal(measuredSlotUtilityPriority(a,[a,goal('M','helmet',12)],options),0);
 assert.equal(measuredSlotUtilityPriority(a,[a,goal('Other','chest',400)],options),0);
});

test('W05/W08 stale and malformed measured evidence has no scheduling credit',()=>{
 const a=goal('M','shoes',100),b=goal('M','belt',3);
 for(const invalid of [
  {profile:profile(now-8*86400000),now},
  {profile:profile(now+100),now},
  {profile:{...profile(),complete:false},now},
  {profile:{...profile(),realm:null},now}
 ])assert.equal(measuredSlotUtilityPriority(a,[a,b],invalid),0);
 for(const change of [
  {utility:NaN},{utility:Infinity},{utility:-1},{utility:0},
  {chance:0},{chance:2},{chance:NaN},
  {estimatedCost:-1},{estimatedCost:Infinity},{slot:'trade1'}
 ]){
  const invalid={...a,...change};
  assert.equal(measuredSlotUtilityPriority(invalid,[invalid,b],
   {profile:profile(),now}),0,JSON.stringify(change));
 }
 const outsider=goal('M','gloves',1000,{chance:NaN});
 assert.equal(measuredSlotUtilityPriority(a,[a,b,outsider],
  {profile:profile(),now}),12,
  'invalid alternatives never establish a comparator');
});

test('W05/W08 integration adds measured improvement only to optimizer goals',()=>{
 const optimized=[
  {name:'fast shoes',item:'boots',level:0,character:'M',slot:'shoes',
   priority:25,enabled:true,utility:100,chance:1,estimatedCost:200},
  {name:'minor belt',item:'belt',level:0,character:'M',slot:'belt',
   priority:25,enabled:true,utility:10,chance:1,estimatedCost:100}
 ];
 const manual={name:'Manual gloves',enabled:true,character:'M',
  slot:'gloves',item:'gloves',level:0,priority:64};
 const bot={
  me:{name:'M',role:'merchant',gearRole:'economy',merchantMobility:'mobile'},
  session:'m1',teamNames:['M'],farmers:[],
  cfg:{characters:[{name:'M',enabled:true,role:'merchant',gearRole:'economy'}],
   production:{gear:true,autoGear:false,offlineProfiles:false,
    minImprovement:0.1,gearTargets:[manual]},
   party:{merchant:'M',selection:'fixed'},items:[]},
  p:{c:{ctype:'merchant',level:70,slots:{},items:[]},
   realm:()=> 'EUI',G:{items:{boots:{type:'shoes'},belt:{type:'belt'},
    gloves:{type:'gloves'}}},
   call:(method,item)=>{
    assert.equal(method,'item_properties');
    return {speed:item.name==='boots'?20:item.name==='belt'?3:4};
   }},
  intelligence:{targets:()=>optimized},
  allocation:{status:()=>[]},transport:{fresh:()=>null},
  economy:{safe:()=>true}
 };
 const before=optimized.map(g=>({...g}));
 // Sample evaluation time after simulated native profile observation.
 // Otherwise Date.now() may advance between the plan clock and snapshot
 // on slower CI hosts, incorrectly marking a fresh snapshot as "future".
 // All observations and the evaluation deadline must share one fixed tick.
 // Sampling Date.now() independently even with +1000ms can cross an OS clock
 // boundary between evaluatedAt and snapshot(), invalidating fresh evidence.
 const fixedNow=Date.now()+1000;
 const goals=createGear(bot,{now:()=>fixedNow}).goals();
 const shoe=goals.find(g=>g.item==='boots'),
  belt=goals.find(g=>g.item==='belt'),
  gloves=goals.find(g=>g.item==='gloves');
 assert.equal(shoe.priority,37);
 assert.equal(belt.priority,25);
 assert.equal(gloves.priority,64,'manually configured goal is unchanged');
 assert.deepEqual(optimized,before,'optimizer measurements are immutable inputs');
});

test('W05/W08 optimizer fairness reads one stable team profile and one receipt ledger per ranking pass',()=>{
 let reads=0,receiptReads=0;
 const bot={
  me:{name:'M',role:'merchant'},session:'m-live',
  teamNames:['M'],farmers:[],
  cfg:{characters:[{name:'M',role:'merchant',enabled:true,
   gearRole:'economy'}],
   production:{gear:true,offlineProfiles:false,autoGear:false,
    gearTargets:[],minImprovement:.05},party:{selection:'fixed'}},
  p:{c:{ctype:'merchant',level:60,items:[],
   get slots(){reads++;return {};}},
   realm:()=> 'EUI',G:{items:{boots:{type:'shoes'},belt:{type:'belt'}}},
   call:()=>({speed:12})},
  economy:{safe:()=>true},transport:{fresh:()=>null},
  allocation:{status:()=>{receiptReads++;return [];}},
  intelligence:{targets:()=>[
   {name:'shoes',enabled:true,character:'M',slot:'shoes',
    item:'boots',level:0,priority:10,utility:100,chance:1,estimatedCost:50},
   {name:'belt',enabled:true,character:'M',slot:'belt',
    item:'belt',level:0,priority:10,utility:10,chance:1,estimatedCost:50}
  ]}
 };
 const gear=createGear(bot,{now:()=>Date.now()});
 const results=gear.goals();
 assert.equal(results.length,2);
 assert.equal(reads,3,'one ranking snapshot plus one equip suitability read per goal');
 assert.equal(receiptReads,1,'one receipt ledger for both competing targets');
 assert.equal(results.find(g=>g.slot==='shoes').priority,22);
 assert.equal(results.find(g=>g.slot==='belt').priority,10);
});

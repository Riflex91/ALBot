import test from 'node:test';
import assert from 'node:assert/strict';
import {warriorEmergencyInterceptPoint} from '../src/combat/farmer.mjs';
import {bestVerifiedAcquisitionRoute} from '../src/production/production.mjs';
import {createEconomicIntelligence} from '../src/production/intelligence.mjs';

const c={name:'My_Warrior',ctype:'warrior',hp:850,max_hp:1000,
 map:'main',in:'main',x:0,y:0,range:35};
const m={id:'greenjr-1',type:'monster',mtype:'greenjr',
 target:'My_Ranger2',hp:20000,map:'main',in:'main',x:200,y:0};
const victim={name:'My_Ranger2',hp:500,max_hp:1000,
 map:'main',in:'main',x:195,y:0};
test('greenjr live attack admits bounded warrior intercept without a neutral pull',()=>{
 const point=warriorEmergencyInterceptPoint(c,m,victim,50,()=>true);
 assert.ok(point);
 assert.equal(point.map,'main');
 assert.ok(Math.hypot(point.x,point.y)<=65);
 assert.ok(Math.hypot(point.x-m.x,point.y-m.y)<200);
 assert.equal(warriorEmergencyInterceptPoint(c,{...m,target:null},victim,50,()=>true),null);
 assert.equal(warriorEmergencyInterceptPoint(c,{...m,target:'outsider'},victim,50,()=>true),null);
 assert.equal(warriorEmergencyInterceptPoint({...c,hp:500},m,victim,50,()=>true),null);
 assert.equal(warriorEmergencyInterceptPoint(c,{...m,x:500},victim,50,()=>true),null);
 assert.equal(warriorEmergencyInterceptPoint(c,m,{...victim,map:'other'},50,()=>true),null);
 assert.equal(warriorEmergencyInterceptPoint(c,m,victim,50,()=>false),null);
});
test('merchant acquisition quote excludes speculative, negative and over-horizon paths',()=>{
 const rows=[{kind:'marketBuy',gold:1,hours:0,score:1,speculative:true},
  {kind:'buy',gold:100,hours:2,score:2},
  {kind:'farm',gold:100,hours:.2,score:20},
  {kind:'craft',gold:20,hours:.1,score:15},
  {kind:'exchange',gold:0,hours:Infinity,score:0},
  {kind:'stock',gold:0,hours:0,score:0}];
 assert.equal(bestVerifiedAcquisitionRoute(rows,1).kind,'craft');
 assert.equal(bestVerifiedAcquisitionRoute(rows,5).kind,'buy');
 assert.equal(bestVerifiedAcquisitionRoute(rows.filter(r=>r.speculative||r.kind==='stock'),1),null);
 assert.equal(bestVerifiedAcquisitionRoute([{kind:'farm',gold:-1,hours:0,score:0}],1),null);
});
const slots=['mainhand','offhand','helmet','chest','pants','shoes',
 'gloves','amulet','belt','cape','ring1','ring2','earring1','earring2','orb'];
function optimizer({online=true,route=true}={}){
 const profile={class:'ranger',level:61,realm:'EUII',session:'r1',
  complete:true,at:Date.now(),slots:Object.fromEntries(slots.map(s=>[s,null]))};
 const peer={session:'r1',running:online,rip:false,realm:'EUII',received:Date.now()};
 const cfg={general:{testLogging:true,planningTickMs:5000},
  characters:[
   {name:'Ranger',enabled:true,role:'farmer',gearRole:'auto'},
   {name:'Merchant',enabled:true,role:'merchant',gearRole:'auto'}
  ],
  merchant:{budgetMode:'bounded'},
  production:{autoGear:true,gear:true,optimizeGear:true,
   autoGearItems:[],gearTargets:[],autoGearBudget:100000,
   autoGearMaxLevel:7,minImprovement:.05,minChance:.65,
   maxFarmHours:1,goldPerHour:10000,craft:false,autonomy:true,
   acquireBy:['farm','npc']}};
 const G={version:1,items:{silkcape:{type:'cape',g:200},
  dexearring:{type:'earring',g:200}},
  classes:{ranger:{mainhand:{bow:{}},doublehand:{},offhand:{}}}};
 const bot={cfg,me:cfg.characters[1],farmers:['Ranger'],p:{G,
  c:{items:[],ctype:'merchant'},realm:()=> 'EUII',
  call:(name,item)=>name==='item_properties'?
   {dex:item?.name==='dexearring'?8:0,
    attack:item?.name==='silkcape'?20:0}:0},
  gear:{profile:n=>n==='Ranger'?profile:null,snapshot:()=>null},
  transport:{peers:new Map(),fresh:n=>n==='Ranger'?peer:null},
  economy:{safe:()=>true,explicit:()=>null,npcFor:()=>null},
  production:{estimateAcquisition:name=>route?
   {kind:'farm',gold:100,hours:.01,score:200,speculative:false}:null}};
 return {bot,profile,peer};
}
test('active verified ranger receives immediate base accessory goals over speculative upgrades',()=>{
 const {bot}=optimizer(),intel=createEconomicIntelligence(bot);
 const g=intel.targets().filter(x=>x.character==='Ranger');
 assert.deepEqual(g.map(x=>x.slot).sort(),['cape','earring1','earring2']);
 assert.ok(g.every(x=>x.level===0&&x.priority>=100));
 assert.equal(intel.status().accessoryVacancies.length,3);
});
test('offline roster and unproved route cannot create merchant accessory demand',()=>{
 const offline=optimizer({online:false});
 assert.deepEqual(createEconomicIntelligence(offline.bot).targets(),[]);
 const absent=optimizer({route:false});
 assert.deepEqual(createEconomicIntelligence(absent.bot).targets(),[]);
});

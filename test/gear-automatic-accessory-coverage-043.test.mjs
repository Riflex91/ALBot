import test from 'node:test';
import assert from 'node:assert/strict';
import {vacantAccessoryCandidates,createEconomicIntelligence} from '../src/production/intelligence.mjs';

const SLOTS=['mainhand','offhand','helmet','chest','pants','shoes','gloves',
 'amulet','belt','cape','ring1','ring2','earring1','earring2','orb'];
const slots=()=>Object.fromEntries(SLOTS.map(s=>[s,null]));
const items={
 dexearring:{type:'earring',g:150},nocostearring:{type:'earring',g:2000},
 silvercape:{type:'cape',g:300},priestonly:{type:'earring',g:30,class:['priest']},
 bow:{type:'weapon',wtype:'bow',g:1000}
};
function fixture({route=true,shop=true,session='session-r',cap=1000}={}){
 const now=Date.now(),profile={class:'ranger',level:65,complete:true,
  at:now,realm:'EUII',session:'session-r',slots:slots()};
 const peer={running:true,rip:false,realm:'EUII',session,gear:profile};
 const G={version:1,items:structuredClone(items),classes:{ranger:{
  mainhand:{bow:{}},doublehand:{},offhand:{}}}};
 const cfg={general:{testLogging:true,planningTickMs:10000},
  merchant:{budgetMode:'bounded'},characters:[
   {name:'Ranger',enabled:true,role:'farmer',gearRole:'auto',class:'ranger'},
   {name:'Merchant',enabled:true,role:'merchant',gearRole:'auto',class:'merchant'}
  ],production:{autoGear:true,gear:true,optimizeGear:true,autoGearItems:[],
   gearTargets:[],autoGearBudget:cap,autoGearMaxLevel:0,minImprovement:0.05,
   minChance:.65,craft:false,autonomy:true,acquireBy:['buy','farm'],
   maxFarmHours:10,goldPerHour:100000}};
 const bot={me:{name:'Merchant',role:'merchant'},farmers:['Ranger'],
  cfg,p:{G,c:{items:Array(42).fill(null)},realm:()=> 'EUII',
   call:(method,item)=>method==='item_properties'?{
    dex:item?.name==='dexearring'?7:0,attack:item?.name==='silvercape'?20:0
   }:0},
  transport:{peers:new Map(),fresh:()=>peer},
  gear:{profile:()=>profile,snapshot:()=>null},
  bank:{packs:()=>[]},economy:{safe:i=>!!i,explicit:()=>null,
   npcFor:name=>shop&&name==='dexearring'?{map:'main',x:0,y:0}:null},
  production:{estimateAcquisition:name=>route&&name==='silvercape'?
   {kind:'farm',gold:100,hours:0.1,speculative:false}:null}};
 return {bot,G,cfg,profile,peer};
}
test('native catalog expands both missing earring slots and cape, but only compatible class',()=>{
 const {G,profile}=fixture();
 assert.deepEqual(vacantAccessoryCandidates(G,profile,'earring1'),
  ['dexearring','nocostearring']);
 assert.deepEqual(vacantAccessoryCandidates(G,profile,'earring2'),
  ['dexearring','nocostearring']);
 assert.deepEqual(vacantAccessoryCandidates(G,profile,'cape'),['silvercape']);
 assert.deepEqual(vacantAccessoryCandidates(G,profile,'mainhand'),[]);
 profile.slots.earring1={name:'dexearring',level:0};
 assert.deepEqual(vacantAccessoryCandidates(G,profile,'earring1'),[]);
});
test('merchant creates earring1, earring2 and cape goals without hard-coded item IDs',()=>{
 const {bot}=fixture();
 const intel=createEconomicIntelligence(bot);
 const goals=intel.targets();
 assert.deepEqual(goals.filter(g=>g.character==='Ranger'&&
  ['earring1','earring2','cape'].includes(g.slot)).map(g=>g.slot).sort(),
  ['cape','earring1','earring2']);
 assert.equal(goals.find(g=>g.slot==='earring1').item,'dexearring');
 assert.equal(goals.find(g=>g.slot==='cape').item,'silvercape');
 const diag=intel.status().accessoryVacancies;
 assert.equal(diag.length,3);
 assert.equal(diag.find(x=>x.slot==='cape').selected,'silvercape');
});
test('unknown routes, protected explicit rules and stale gear evidence never authorize new goals',()=>{
 const none=fixture({route:false,shop:false});
 let intel=createEconomicIntelligence(none.bot);
 assert.equal(intel.targets().filter(g=>['earring1','earring2','cape'].includes(g.slot)).length,0);
 assert.ok(intel.status().accessoryVacancies.some(x=>x.unprovenRoutes>0));
 const keep=fixture();keep.bot.economy.explicit=i=>i.name==='dexearring'?{action:'keep'}:null;
 intel=createEconomicIntelligence(keep.bot);
 assert.equal(intel.targets().some(g=>g.slot==='earring1'),false);
 const stale=fixture({session:'other-session'});
 intel=createEconomicIntelligence(stale.bot);
 assert.equal(intel.targets().filter(g=>['earring1','earring2','cape'].includes(g.slot)).length,0);
});
test('bounded budget and disabled optimizer still override accessory discovery',()=>{
 const costly=fixture({cap:100});
 const intel=createEconomicIntelligence(costly.bot);
 assert.equal(intel.targets().filter(g=>['earring1','earring2','cape'].includes(g.slot)).length,0);
 const disabled=fixture();disabled.cfg.production.autoGear=false;
 assert.deepEqual(createEconomicIntelligence(disabled.bot).targets(),[]);
});

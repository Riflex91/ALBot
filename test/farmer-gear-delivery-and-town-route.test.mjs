import test from 'node:test';
import assert from 'node:assert/strict';
import {finishedGearDeliveryStock,pendingDeliveryRuleNeeds} from '../src/production/production.mjs';
import {townShortcutOwnerAllowed,townShortcutRetryReady,townChannelTeamThreat,
 createMovement} from '../src/core/movement.mjs';

const skull={name:'skullamulet',level:2,stat_type:'',p:'',title:''};
const goal=(to,priority)=>({name:'Gear: '+to+' amulet',enabled:true,
 item:'skullamulet',level:2,gearSlot:'amulet',recipient:to,
 quantity:1,priority});
test('one carried skullamulet +2 is allocated to ONE farmer, not all competing wishes',()=>{
 const items=[skull],goals=[goal('Ranger1',60),goal('Ranger2',50),
  {...goal('Merchant',20),recipient:''}];
 const physical=g=>finishedGearDeliveryStock(items,g);
 const candidates=pendingDeliveryRuleNeeds(goals,()=>0,'Merchant',physical);
 assert.deepEqual(candidates.map(g=>[g.recipient,g.quantity]),[['Ranger1',1]]);
 const next=pendingDeliveryRuleNeeds(goals,g=>g.recipient==='Ranger1'?1:0,
  'Merchant',physical);
 assert.deepEqual(next.map(g=>g.recipient),['Ranger2']);
});
test('physical gear allocation respects explicit keep, other-recipient send, variant and locked stock',()=>{
 const g=goal('Ranger1',50);
 assert.equal(finishedGearDeliveryStock([skull],g,()=>({action:'keep'})),0);
 assert.equal(finishedGearDeliveryStock([skull],g,()=>({action:'send',recipient:'Ranger2'})),0);
 assert.equal(finishedGearDeliveryStock([skull],g,()=>({action:'send',recipient:'Ranger1'})),1);
 assert.equal(finishedGearDeliveryStock([{...skull,l:true}],g),0);
 assert.equal(finishedGearDeliveryStock([{...skull,b:true}],g),0);
 assert.equal(finishedGearDeliveryStock([{...skull,level:1}],g),0);
 assert.equal(finishedGearDeliveryStock([{...skull,q:0}],g),0);
 assert.equal(finishedGearDeliveryStock([{...skull,q:1.5}],g),0);
 assert.equal(finishedGearDeliveryStock([skull],{...g,variant:{stat_type:'str'}}),0);
 assert.equal(finishedGearDeliveryStock([skull],{...g,variant:{stat_type:''}}),1);
});
test('two genuinely carried gear copies support two farmer shipments',()=>{
 const items=[{...skull},{...skull}];
 const selected=pendingDeliveryRuleNeeds([goal('Ranger1',60),goal('Ranger2',50)],
  ()=>0,'Merchant',g=>finishedGearDeliveryStock(items,g));
 assert.deepEqual(selected.map(g=>g.recipient),['Ranger1','Ranger2']);
});
test('farmer quest, farm and current group-follow routes use measured Town shortcut',()=>{
 for(const owner of ['quest','quest-escort','farm','follow','regroup'])
  assert.equal(townShortcutOwnerAllowed('farmer',owner),true);
 for(const owner of ['combat','kite','cohesion','scout','cave','gold','logistics'])
  assert.equal(townShortcutOwnerAllowed('farmer',owner),false);
 assert.equal(townShortcutOwnerAllowed('merchant','economy',false),false);
 assert.equal(townShortcutOwnerAllowed('merchant','economy',true),true);
});
test('failed Town attempt permits bounded retry but a successful cast retains 30s hold',()=>{
 const now=1800000000000;
 assert.equal(townShortcutRetryReady(now,now-31000,now-4100),true);
 assert.equal(townShortcutRetryReady(now,now-31000,now-3900),false);
 assert.equal(townShortcutRetryReady(now,now-29999,now-5000),false);
});
test('no Town channel starts while an engaged team member is threatened nearby',()=>{
 const me={name:'Ranger1',map:'main',in:'main',x:0,y:0};
 assert.equal(townChannelTeamThreat(me,[{target:'Ranger2',hp:10,map:'main',in:'main',x:25,y:20}],['Ranger1','Ranger2']),true);
 assert.equal(townChannelTeamThreat(me,[{target:'Ranger2',hp:10,map:'main',in:'main',x:500,y:0}],['Ranger1','Ranger2']),false);
 assert.equal(townChannelTeamThreat(me,[{target:'Other',hp:10,map:'main',in:'main',x:25,y:0}],['Ranger1','Ranger2']),false);
});
test('interrupted fast travel does not get marked as confirmed and does not retry immediately',()=>{
 const events=[],runs=[];
 const c={name:'Ranger1',map:'main',in:'main',x:920,y:0,speed:40,
  c:{},moving:false,rip:false,stand:false};
 const exec={pending:new Map(),busy:()=>false,run:(key,resources,guard,invoke,opts)=>{
  if(!guard())return false;
  runs.push({key,opts});
  if(key==='travel.town')invoke();
  return true;
 },cancelResource:()=>{}};
 const bot={running:true,me:{role:'farmer'},teamNames:['Ranger1','Ranger2'],
  cfg:{world:{excludedMaps:[]},farming:{pvp:false},merchant:{townMinSavingsMs:3000}},
  p:{c,G:{maps:{main:{spawns:[[0,0]]}}},has:ability=>ability==='town',
   call:action=>{if(action==='town')return {success:false,reason:'interrupted'};return true;}},
  exec,monsters:()=>[],event:(type,detail)=>events.push({type,detail}),
  lootDeparture:{beforeDeparture:()=>true},free:()=>20};
 const move=createMovement(bot);
 const dest={map:'main',in:'main',x:40,y:0,radius:20};
 assert.equal(move.go(dest,'quest'),false);
 assert.equal(runs.filter(x=>x.key==='travel.town').length,1);
 runs[0].opts.onSettle('rejected',{reason:'interrupted'});
 assert.equal(move.go(dest,'quest'),false);
 assert.equal(runs.filter(x=>x.key==='travel.town').length,1,
  'failed Town cast is safety-throttled, not immediately restarted');
 assert.equal(events.some(x=>x.type==='travel.townRetry'),true);
});

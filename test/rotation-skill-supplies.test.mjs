import test from 'node:test';
import assert from 'node:assert/strict';
import {plannedSkillReagents,createSupplies} from '../src/items/supplies.mjs';

// Consuming skills and unlocks from the supplied AdventureLand Live-G v17665.
// A skill's mere presence in G does not imply an enabled bot rotation.
const G={items:{
 poison:{type:'material'},shadowstone:{type:'material'},
 essenceofnature:{type:'material'},essenceoflife:{type:'material'},snowball:{type:'material'}
},skills:{
 poisonarrow:{class:['ranger'],consume:'poison'},
 pcoat:{class:['rogue'],consume:'poison'},
 shadowstrike:{class:['rogue'],level:70,consume:'shadowstone'},
 entangle:{class:['mage'],level:72,consume:'essenceofnature'},
 phaseout:{class:['priest'],level:64,consume:'shadowstone'},
 revive:{class:['priest'],consume:'essenceoflife'},
 snowball:{consume:'snowball'}
}};
const me=(name='F')=>({name,role:'farmer'});
const cfg=()=>({skills:[],party:{enabled:true,revive:true},
 production:{skillSupplies:true,skillSupplyCount:20,helperMaxPrice:200000}});

test('normal ranger and rogue rotations request poison without manual skill rules',()=>{
 const settings=cfg();
 assert.deepEqual(plannedSkillReagents(G,{ctype:'ranger',level:60},settings,me()),['poison']);
 assert.deepEqual(plannedSkillReagents(G,{ctype:'rogue',level:60},settings,me()),['poison']);
 assert.deepEqual(plannedSkillReagents(G,{ctype:'rogue',level:80},settings,me()),['poison']);
});
test('mage and priest reagent requests follow real unlocks and configured revive',()=>{
 const settings=cfg();
 assert.deepEqual(plannedSkillReagents(G,{ctype:'mage',level:71},settings,me()),[]);
 assert.deepEqual(plannedSkillReagents(G,{ctype:'mage',level:72},settings,me()),['essenceofnature']);
 assert.deepEqual(plannedSkillReagents(G,{ctype:'priest',level:63},settings,me()),['essenceoflife']);
 assert.deepEqual(plannedSkillReagents(G,{ctype:'priest',level:64},settings,me()),['shadowstone','essenceoflife']);
 settings.party.revive=false;
 assert.deepEqual(plannedSkillReagents(G,{ctype:'priest',level:64},settings,me()),['shadowstone']);
});
test('unrelated skills, inactive custom rules and wrong character/class never reserve items',()=>{
 const settings=cfg();
 settings.skills=[
  {enabled:false,skill:'snowball',class:'auto',character:''},
  {enabled:true,skill:'shadowstrike',class:'rogue',character:'Other'},
  {enabled:true,skill:'shadowstrike',class:'ranger',character:''}
 ];
 assert.deepEqual(plannedSkillReagents(G,{ctype:'ranger',level:80},settings,me('F')),['poison']);
 assert.deepEqual(plannedSkillReagents(G,{ctype:'rogue',level:69},settings,me('F')),['poison']);
 settings.skills[1].character='';
 assert.deepEqual(plannedSkillReagents(G,{ctype:'rogue',level:70},settings,me('F')),['poison','shadowstone']);
});
test('finite rotation-generated supply request creates a real recipient-bound Merchant goal',()=>{
 const settings=cfg(),now=Date.now(),inventory={poison:0},stored=new Map();
 const ranger={p:{G,c:{ctype:'ranger',level:65,rip:false},
  read:k=>stored.get(k),write:(k,v)=>{stored.set(k,v);return true;}},
  cfg:settings,me:me('R'),running:true,count:item=>inventory[item]??0,
  economy:{explicit:()=>null}};
 const supply=createSupplies(ranger);
 const first=supply.request();
 assert.deepEqual(first.map(x=>[x.item,x.quantity]),[['poison',100]]);
 assert.equal(first[0].cycle>=now,true);
 assert.equal(supply.request()[0].cycle,first[0].cycle,'polling cannot duplicate an order');
 const merchant={p:{G,c:{ctype:'merchant',level:80,rip:false},
   realm:()=> 'EUII',read:()=>null,write:()=>true},
  cfg:settings,me:{name:'M',role:'merchant'},running:true,
  farmers:['R'],transport:{fresh:name=>name==='R'?{
    running:true,rip:false,realm:'EUII',class:'ranger',supplies:first}:null},
  economy:{explicit:()=>null}};
 const plans=createSupplies(merchant).goals();
 assert.equal(plans.length,1);
 assert.deepEqual([plans[0].item,plans[0].quantity,plans[0].recipient],['poison',100,'R']);
 assert.equal(plans[0].enabled,true);
 inventory.poison=100;
 // Force the bounded 5 s recalculation without timers or changing bot internals.
 const realNow=Date.now;
 try{Date.now=()=>realNow()+6000;assert.deepEqual(supply.request(),[]);}finally{Date.now=realNow;}
});
test('merchant refuses mismatched class or stale reagent heartbeat requests',()=>{
 const settings=cfg(),now=Date.now();
 const bot={p:{G,c:{ctype:'merchant',level:80,rip:false},realm:()=> 'EUII',
 read:()=>null,write:()=>true},cfg:settings,me:{name:'M',role:'merchant'},
 running:true,farmers:['R'],economy:{explicit:()=>null},
 transport:{fresh:()=>({running:true,rip:false,realm:'EUII',class:'mage',
 supplies:[{item:'poison',quantity:20,cycle:now}]})}};
 assert.deepEqual(createSupplies(bot).goals(),[]);
 bot.transport.fresh=()=>({running:true,rip:false,realm:'EUII',class:'ranger',
  supplies:[{item:'poison',quantity:20,cycle:now-3600001}]});
 assert.deepEqual(createSupplies(bot).goals(),[]);
});

test('Ranger poison requests begin at 20 and refill only to 100',()=>{
 const inventory={poison:21},persisted=new Map(),settings=cfg();
 const ranger={p:{G,c:{ctype:'ranger',level:60,rip:false},
  read:k=>persisted.get(k),write:(k,v)=>{persisted.set(k,v);return true;}},
  cfg:settings,me:me('Ranger'),running:true,count:item=>inventory[item]??0,
  economy:{explicit:()=>null}};
 const supply=createSupplies(ranger);
 assert.deepEqual(supply.request(),[]);
 const realNow=Date.now;
 try{
  inventory.poison=20;Date.now=()=>realNow()+6000;
  assert.equal(supply.request()[0].quantity,80);
  inventory.poison=40;Date.now=()=>realNow()+12000;
  assert.equal(supply.request()[0].quantity,60,'outstanding order tracks actual deficit');
  inventory.poison=100;Date.now=()=>realNow()+18000;
  assert.deepEqual(supply.request(),[]);
 }finally{Date.now=realNow;}
});

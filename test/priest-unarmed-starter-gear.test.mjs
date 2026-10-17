import test from 'node:test';
import assert from 'node:assert/strict';
import {createGear} from '../src/production/gear.mjs';

const gearSlots=['mainhand','offhand','helmet','chest','pants','shoes','gloves','amulet','belt','cape','ring1','ring2','earring1','earring2','orb'];
function fixture(ctype='priest',mainhand=null){
 const profile={class:ctype,level:32,slots:Object.fromEntries(gearSlots.map(slot=>[slot,slot==='mainhand'?mainhand:null])),at:Date.now(),complete:true};
 const p={c:{name:'My_Merchant',ctype:'merchant',level:58,slots:{},items:[]},
  G:{items:{staff:{type:'weapon',wtype:'staff',upgrade:true,level:1}},
   classes:{priest:{mainhand:{staff:true}},mage:{mainhand:{staff:true}},
    ranger:{mainhand:{bow:true}}}},
  read:()=>({'My_Caster':profile}),
  call:(name,item)=>{assert.equal(name,'item_properties');return {attack:10,int:8,mp:15,speed:1};}};
 const cfg={production:{gear:true,gearTargets:[],autoGear:false,autoGearBudget:100000,autoGearMaxLevel:5,minImprovement:.1},
   characters:[{name:'My_Caster',class:ctype,role:'farmer',enabled:true,gearRole:'auto'}],
   party:{selection:'adaptive'}};
 const bot={p,cfg,me:{name:'My_Merchant',role:'merchant'},
  teamNames:['My_Merchant','My_Caster'],
  economy:{},transport:{fresh:()=>null},
  intelligence:{targets:()=>[{name:'Optimiertes Gear My_Caster mainhand',
   character:'My_Caster',slot:'mainhand',item:'staff',level:3,enabled:true,priority:31,budget:100000}]}};
 return createGear(bot);
}

for(const ctype of ['mage','priest']){
 test('unarmed '+ctype+' gets immediate +0 staff ahead of speculative +3 optimizer',()=>{
  const g=fixture(ctype),goals=g.goals();
  const starter=goals.find(x=>x.name==='Gear: Startwaffe My_Caster');
  assert.ok(starter,'priority starter must exist alongside optimized target');
  assert.equal(starter.level,0);
  assert.equal(starter.item,'staff');
  assert.equal(starter.gearSlot,'mainhand');
  assert.equal(starter.recipient,'My_Caster');
  assert.equal(starter.priority,1000);
  assert.ok(goals.some(x=>x.level===3));
  assert.equal(g.status().find(x=>x.name==='Startwaffe My_Caster').state,'requested');
 });
 test('already armed '+ctype+' gets no duplicate starter shipment',()=>{
  const goals=fixture(ctype,{name:'staff',level:0}).goals();
  assert.ok(!goals.some(g=>g.name==='Gear: Startwaffe My_Caster'));
 });
}
test('Rangers do not receive an incompatible caster staff',()=>{
 const g=fixture('ranger');
 assert.ok(!g.goals().some(g=>g.name==='Gear: Startwaffe My_Caster'));
});

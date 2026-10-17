import test from 'node:test';
import assert from 'node:assert/strict';
import {createGear} from '../src/production/gear.mjs';

const gearSlots=['mainhand','offhand','helmet','chest','pants','shoes','gloves','amulet','belt','cape','ring1','ring2','earring1','earring2','orb'];
function fixture(ctype='priest',mainhand=null,items=[],explicit=()=>null){
 const profile={class:ctype,level:32,slots:Object.fromEntries(gearSlots.map(slot=>[slot,slot==='mainhand'?mainhand:null])),at:Date.now(),complete:true};
 const p={c:{name:'My_Merchant',ctype:'merchant',level:58,slots:{},items},
  G:{items:{staff:{type:'weapon',wtype:'staff',upgrade:true,level:1}},
   classes:{priest:{mainhand:{staff:true}},mage:{mainhand:{staff:true}},
    ranger:{mainhand:{bow:true}}}},
  read:()=>({'My_Caster':profile}),
  call:(name,item)=>{assert.equal(name,'item_properties');return {attack:10,int:8,mp:15,speed:1};}};
 const cfg={production:{gear:true,offlineProfiles:true,gearTargets:[],autoGear:false,autoGearBudget:100000,autoGearMaxLevel:5,minImprovement:.1},
   characters:[{name:'My_Caster',class:ctype,role:'farmer',enabled:true,gearRole:'auto'}],
   party:{selection:'adaptive'}};
 const bot={p,cfg,me:{name:'My_Merchant',role:'merchant'},
  teamNames:['My_Merchant','My_Caster'],
  economy:{safe:i=>!!i&&!i.l&&!i.b,explicit},transport:{fresh:()=>null},
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

for(const ctype of ['mage','priest']){
 test('available verified +3 is promoted instead of buying or delivering starter +0 for '+ctype,()=>{
  const stock=[{name:'staff',level:3},{name:'staff',level:0},{name:'staff',level:3}];
  const gear=fixture(ctype,null,stock),goals=gear.goals();
  assert.equal(goals.filter(x=>x.gearSlot==='mainhand').length,1,
   'the existing optimized +3 goal must be promoted, not duplicated');
  assert.equal(goals[0].name,'Gear: Optimiertes Gear My_Caster mainhand');
  assert.equal(goals[0].level,3);
  assert.equal(goals[0].priority,1000);
  assert.equal(goals[0].urgentStarter,true);
  assert.ok(!goals.some(x=>x.name.includes('Startwaffe')));
 });
}
test('explicitly kept or protected +3 cannot authorize stock-derived starter',()=>{
 const hidden={name:'staff',level:3};
 const kept=fixture('priest',null,[hidden],()=>({action:'keep'})).goals();
 assert.ok(kept.some(x=>x.item==='staff'&&x.level===0&&x.urgentStarter));
 assert.ok(!kept.some(x=>x.item==='staff'&&x.level===3&&x.urgentStarter));
 const locked=fixture('priest',null,[{...hidden,l:true}]).goals();
 assert.ok(locked.some(x=>x.item==='staff'&&x.level===0&&x.urgentStarter));
});
test('an available compatible non-optimized weapon can be sent as a priority-1000 gear goal',()=>{
 // No optimizer result for the physically ready item.
 const gear=fixture('priest',null,[{name:'staff',level:2}]);
 const goals=gear.goals();
 assert.ok(goals.some(x=>x.name==='Gear: Vorratswaffe My_Caster'&&
  x.item==='staff'&&x.level===2&&x.priority===1000));
 assert.ok(!goals.some(x=>x.name==='Gear: Startwaffe My_Caster'));
});

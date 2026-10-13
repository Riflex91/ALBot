import test from 'node:test';
import assert from 'node:assert/strict';
import {createMerchant} from '../src/merchant/controller.mjs';
import {autoGearTargetLevel,gearSlotPriority} from '../src/production/gear.mjs';
import {mutationRiskLimit,mutationRiskAllowed,MUTATION_RISK_WINDOW_MS} from '../src/merchant/mutation-risk.mjs';

function fixture(free=4){
 const items=Array.from({length:42},(_,i)=>i<42-free?{name:'protected',q:1}:null);
 const actions=[],events=[];
 const bot={
  p:{c:{name:'My_Merchant',map:'bank',items},read:()=>null,G:{items:{}}},
  cfg:{merchant:{enabled:true,minFreeSlots:4,bankWorkspace:2,taskHoldMs:30000,starvationMs:120000,
   supply:false,bank:false},party:{merchant:'My_Merchant'},production:{enabled:true}},
  me:{name:'My_Merchant',role:'merchant'},running:true,recovering:false,
  journal:null,inventoryBlocked:false,reason:'',free:()=>items.filter(i=>!i).length,
  exec:{busy:()=>false},bank:{pending:false,consolidateInventory:()=>false,consolidate:()=>false},
  movement:{order:null},gold:{reserved:false},logistics:{reserved:false,
   travel(){actions.push('pickup');bot.movement.order={owner:'logistics'};}},
  services:{interrupt(){},restore(){}},
  production:{activeGoal:{name:'Gear: Startwaffe My_Mage'},
   tick(){actions.push('buy:staff');return true;}},
  economy:{safe:()=>true,rules:()=>null,remaining:()=>true,
   spare:()=>0,npcSell:()=>false,value:()=>1},
  event:(name,data)=>events.push({name,...data})
 };
 return {bot,actions,events};
}
test('exactly four free slots no longer starve the depot preflight',()=>{
 const f=fixture(4);createMerchant(f.bot).tick();
 assert.deepEqual(f.actions,['pickup']);
});
test('one below minimum reserve still blocks outbound work',()=>{
 const f=fixture(3);createMerchant(f.bot).tick();
 assert.deepEqual(f.actions,[]);
});
test('starter staff acquisition outranks routine pickup when safe capacity exists',()=>{
 const f=fixture(5);createMerchant(f.bot).tick();
 assert.deepEqual(f.actions,['buy:staff']);
});
test('upgrade caps honor the user limit and the recipient character, not the Merchant',()=>{
 assert.equal(autoGearTargetLevel(5,60,'mainhand'),5);
 assert.equal(autoGearTargetLevel(8,40,'chest'),7);
 assert.equal(autoGearTargetLevel(8,50,'mainhand'),8);
 assert.equal(autoGearTargetLevel(8,20,'mainhand'),5);
 assert.equal(autoGearTargetLevel(8,50,'helmet'),7);
 assert.ok(gearSlotPriority('mainhand','mage')>gearSlotPriority('amulet','mage'));
});
test('autonomous 24-hour worst-case mutation exposure is item-specific',()=>{
 assert.equal(MUTATION_RISK_WINDOW_MS,24*60*60*1000);
 assert.equal(mutationRiskLimit({name:'ring'}, {type:'ring'},250000),20000);
 assert.equal(mutationRiskLimit({name:'staff'}, {type:'weapon',wtype:'staff'},250000),100000);
 assert.equal(mutationRiskLimit({name:'coat'}, {type:'chest'},250000),50000);
 assert.equal(mutationRiskLimit({name:'coat'}, {type:'chest'},12000),12000);
 const already={'["ring",0]':12000};
 assert.equal(mutationRiskAllowed(already,'["ring",0]',8000,20000),true);
 assert.equal(mutationRiskAllowed(already,'["ring",0]',8001,20000),false);
 assert.equal(mutationRiskAllowed(already,'["ring",1]',8001,20000),true);
 assert.equal(mutationRiskAllowed(already,'',1,20000),false);
 assert.equal(mutationRiskAllowed(already,'["ring",0]',Infinity,20000),false);
});

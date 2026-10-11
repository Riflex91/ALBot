import test from 'node:test';
import assert from 'node:assert/strict';
import {createMerchant,canOpenMerchantStand} from '../src/merchant/controller.mjs';
import {createMovement} from '../src/core/movement.mjs';
import {Executor} from '../src/core/executor.mjs';

function fixture(){
 const calls=[],cfg={merchant:{enabled:true,stand:true,mluck:false,bankReclaim:false,minFreeSlots:1,taskHoldMs:30000,starvationMs:120000,position:{enabled:false}},
  items:[],general:{},production:{enabled:true},world:{excludedMaps:[]},farming:{pvp:false}};
 const c={name:'M',map:'main',in:'main',x:0,y:0,moving:false,items:[{name:'computer'}],rip:false};
 const p={c,G:{items:{computer:{stand:true}},skills:{},maps:{main:{},tunnel:{}}},parent:{},root:{},realm:()=> 'EUII',
  has:()=>true,call(name,...args){calls.push(name);if(name==='open_stand'){c.stand={};return Promise.resolve();}
  if(name==='close_stand'){c.stand=null;return Promise.resolve();}
  if(name==='can_move_to')return false;
  if(name==='smart_move')return new Promise(()=>{});return Promise.resolve();}};
 const bot={running:true,me:{name:'M',role:'merchant'},p,cfg,journal:null,inventoryBlocked:false,reason:'',free:()=>20,
  event(){},monsters:()=>[],logistics:{reserved:false,travel(){}},production:{planGoals(){},tick:()=>false,status:()=>({blocked:null})},
  bank:{pending:false,gold:()=>false,consolidate:()=>false},market:{background:()=>false},
  services:{active:false,waiting:false,tick:()=>false,interrupt(){},restore:()=>false},
  strategy:{status:()=>({manual:null})},gold:{travel:()=>false},
  economy:{safe:()=>false,remaining:()=>false},farmers:[],transport:{fresh:()=>null}};
 bot.exec=new Executor({now:Date.now,active:()=>bot.running,limit:5,onError(){}});
 bot.movement=createMovement(bot);
 return {bot,c,calls,p};
}
test('stand cannot open during smart path search even when character.moving is false',()=>{
 const {bot,p}=fixture();
 assert.equal(canOpenMerchantStand(bot),true);
 p.parent.smart={searching:true};
 assert.equal(canOpenMerchantStand(bot),false);
 p.parent.smart=null;
 bot.movement.go({map:'tunnel',in:'tunnel',x:200,y:0},'economy');
 assert.equal(bot.movement.order?.mode,'smart_move');
 assert.equal(canOpenMerchantStand(bot),false);
 bot.movement.stop();
});
test('merchant planner never schedules stand in a frame that starts movement',()=>{
 const {bot,c,calls}=fixture();
 const merchant=createMerchant(bot);
 bot.services.tick=()=>{bot.movement.go({map:'tunnel',in:'tunnel',x:200,y:0},'economy');return true;};
 bot.exec.beginFrame();merchant.tick();bot.exec.flush();
 assert.equal(bot.movement.order?.mode,'smart_move');
 assert.equal(bot.exec.pending.has('stand'),false);
 assert.equal(c.stand,undefined);
 assert.ok(calls.includes('smart_move'));
 bot.movement.stop();
});
test('merchant opens stand only after ten seconds of uninterrupted idle time',()=>{
 const old=Date.now;let clock=100000;Date.now=()=>clock;
 try{
  const {bot,c,calls}=fixture(),merchant=createMerchant(bot);
  bot.services.tick=()=>true;
  for(let i=0;i<4;i++){bot.exec.beginFrame();merchant.tick();bot.exec.flush();clock+=2000;}
  assert.equal(calls.filter(x=>x==='open_stand').length,0);
  clock+=3000;
  bot.exec.beginFrame();merchant.tick();bot.exec.flush();
  assert.equal(calls.filter(x=>x==='open_stand').length,1);
  assert.ok(c.stand);
  bot.movement.order={owner:'economy'};
  assert.equal(canOpenMerchantStand(bot),false);
  merchant.close();
 }finally{Date.now=old;}
});
test('in-flight open_stand blocks movement before stand becomes visible',()=>{
 const {bot,c}=fixture();let resolveOpen;
 bot.p.call=(name)=>{
  if(name==='open_stand')return new Promise(resolve=>{resolveOpen=resolve;});
  if(name==='can_move_to')return false;
  if(name==='smart_move')assert.fail('Movement should not start while opening stand');
  return Promise.resolve();
 };
 bot.exec.run('stand',['stand'],()=>true,()=>bot.p.call('open_stand'));
 assert.equal(c.stand,undefined);
 assert.equal(bot.exec.busy('stand'),true);
 bot.movement.go({map:'tunnel',in:'tunnel',x:100,y:0},'economy');
 assert.equal(bot.movement.order,null);
 resolveOpen();
 bot.movement.stop();
});

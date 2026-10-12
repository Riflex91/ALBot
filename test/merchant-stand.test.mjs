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
test('idle time never opens a stand without a concrete market order',()=>{
 const old=Date.now;let clock=100000;Date.now=()=>clock;
 try{
  const {bot,c,calls}=fixture(),merchant=createMerchant(bot);
  bot.services.tick=()=>true;
  bot.exec.beginFrame();merchant.tick();bot.exec.flush();
  assert.equal(calls.filter(x=>x==='open_stand').length,0);
  clock+=1999;
  bot.exec.beginFrame();merchant.tick();bot.exec.flush();
  assert.equal(calls.filter(x=>x==='open_stand').length,0);
  clock+=1;
  bot.exec.beginFrame();merchant.tick();bot.exec.flush();
  assert.equal(calls.filter(x=>x==='open_stand').length,0,
    'idle time no longer authorizes a stand');
  bot.exec.beginFrame();merchant.activateStand();bot.exec.flush();
  assert.equal(calls.filter(x=>x==='open_stand').length,0,
    'only an actual stand0 market item may be opened');
  c.moving=true;
  assert.equal(canOpenMerchantStand(bot),false);
  merchant.close();
 }finally{Date.now=old;}
});
test('movement interruption never triggers passive stand opening',()=>{
 const old=Date.now;let clock=100000;Date.now=()=>clock;
 try{
  const {bot,c,calls}=fixture(),merchant=createMerchant(bot);
  bot.services.tick=()=>true;
  const tick=()=>{bot.exec.beginFrame();merchant.tick();bot.exec.flush();};
  tick();clock+=1500;
  c.moving=true;tick();c.moving=false;clock+=100;
  tick();clock+=1999;tick();
  assert.equal(calls.filter(x=>x==='open_stand').length,0,'Movement must reset idle clock');
  clock+=1;tick();
  assert.equal(calls.filter(x=>x==='open_stand').length,0,
    'neither waiting nor resuming from movement opens a stand');
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

import test from 'node:test';
import assert from 'node:assert/strict';
import {Executor} from '../src/core/executor.mjs';
import {runtimeConditionGate,publicCallCost,createActionAdmission} from '../src/core/action-admission.mjs';
import {potionChannelPolicy,rankRecoveryPotion,beginCombatLife} from '../src/combat/recovery-policy.mjs';
import {observeActivity} from '../src/world/event-evidence.mjs';
import {gearCatchUpPriority} from '../src/production/gear-fairness.mjs';
const executor=(options={})=>new Executor({now:()=>100,active:()=>true,limit:8,onError:()=>{},...options});
test('denied final admission cannot invoke or start a value journal',()=>{
 let journal=0,events=0;
 const exec=executor({admit:()=>false,onEvent:()=>events++});
 exec.beginFrame();
 assert.equal(exec.run('upgrade',['inventory'],()=>true,()=>journal++,{value:true}),true);
 exec.flush();assert.equal(journal,0);assert.equal(exec.pending.size,0);
 // Selection diagnostics may exist; no action.start or owner may exist.
 assert.equal(events,1);
});
test('conditions changing between planning and flush block real dispatch',()=>{
 const c={s:{}},G={conditions:{new_blocker:{blocked:true}}};let invoked=0;
 const exec=executor({admit:(key,resources)=>runtimeConditionGate(c,G,key,resources).allowed});
 exec.beginFrame();exec.run('skill:heal',['attack','mana'],()=>true,()=>invoked++);
 c.s.new_blocker={ms:1000};exec.flush();assert.equal(invoked,0);
 assert.equal(runtimeConditionGate(c,G,'bank.store',['inventory']).allowed,true);
});
test('stoned blocks attack, movement, and skills even with missing G condition',()=>{
 for(const resources of [['attack'],['movement'],['mana']])
  assert.equal(runtimeConditionGate({s:{stoned:{ms:10}}},{},'action',resources).allowed,false);
 assert.equal(runtimeConditionGate({s:{stoned:{ms:0}}},{},'move',['movement']).allowed,true);
});
test('silence does not disable direct movement',()=>{
 const c={s:{silenced:{ms:2000}}};
 assert.equal(runtimeConditionGate(c,{},'move',['movement']).allowed,true);
 assert.equal(runtimeConditionGate(c,{},'skill:heal',['mana']).allowed,false);
});
test('observed costs plus newly sent calls reserve survival capacity and recover after aging',()=>{
 let at=100;const bot={cfg:{general:{}},p:{c:{cc:159},G:{}},event:()=>{}};
 const a=createActionAdmission(bot,{now:()=>at});
 assert.equal(a.allow('sell',['inventory']),true);
 a.record('equip',[0]);assert.equal(a.status().cost,163);
 assert.equal(a.allow('sell',['inventory']),false);
 assert.equal(a.allow('potion',['inventory']),true);
 at+=4001;assert.equal(a.allow('sell',['inventory']),true);
});
test('local call budget works when the host does not expose cc',()=>{
 const a=createActionAdmission({cfg:{general:{}},p:{c:{},G:{}},event:()=>{}},{now:()=>100});
 for(let n=0;n<41;n++)a.record('equip',[0]);
 assert.equal(a.allow('upgrade',['inventory']),false);
 assert.equal(a.allow('respawn',['lifecycle']),true);
 assert.equal(publicCallCost('item_properties',[{}]),0);
 assert.ok(publicCallCost('send_cm',[['A','B'],'x'.repeat(2000)])>publicCallCost('send_cm',['A',{}]));
});
test('normal channeling defers potions; only actual life danger breaks own channels',()=>{
 assert.equal(potionChannelPolicy({hp:800,max_hp:1000,c:{town:{}}}).allowed,false);
 assert.deepEqual(potionChannelPolicy({hp:200,max_hp:1000,c:{fishing:{}}},{threatened:true}).interrupt,['fishing']);
 assert.equal(potionChannelPolicy({hp:200,max_hp:1000,c:{mining:{}}}).allowed,false);
});
test('a dual potion wins when both resources need restoration without preferring wasted restoration',()=>{
 const c={hp:1000,max_hp:2000,mp:100,max_mp:1100};
 assert.ok(rankRecoveryPotion(c,[['hp',1000],['mp',1000]],'hp')>
  rankRecoveryPotion(c,[['hp',1000]],'hp'));
 assert.equal(rankRecoveryPotion(c,[['mp',1000]],'hp'),-Infinity);
});
test('death and revival clear stale combat owners without discarding value journals',()=>{
 let stopped=0;const bot={p:{c:{rip:false}},exec:executor(),
  movement:{stop:()=>stopped++},event:()=>{},target:{id:'old'}};
 beginCombatLife(bot);
 bot.exec.run('attack',['attack'],()=>true,()=>new Promise(()=>{}));
 bot.exec.run('bank.store',['inventory'],()=>true,()=>new Promise(()=>{}),{value:true});
 bot.p.c.rip=true;beginCombatLife(bot);
 assert.equal(bot.target,null);assert.equal(bot.exec.pending.has('attack'),false);
 assert.equal(bot.exec.pending.has('bank.store'),true);
 bot.p.c.rip=false;beginCombatLife(bot);assert.equal(bot.combatLife.generation,3);
 assert.equal(stopped,2);
});
test('unknown event has bounded grace; explicit end overrides grace immediately',()=>{
 const a={expires:10000};
 const unknown=observeActivity(a,null,false,1000);assert.equal(unknown.state,'unknown');
 const held={...a,missingSince:unknown.missingSince};
 assert.equal(observeActivity(held,null,false,3499).state,'unknown');
 assert.equal(observeActivity(held,null,false,3500).state,'ended');
 assert.equal(observeActivity(held,{live:false},true,1001).state,'ended');
 assert.equal(observeActivity(held,{live:true},false,1001).state,'present');
});
test('gear catchup compares observed same-class equipment and never invents offline strength',()=>{
 const weak={class:'ranger',complete:true,slots:{mainhand:{level:0},chest:null}},
  strong={class:'ranger',complete:true,slots:{mainhand:{level:5},chest:{level:5}}},
  mage={...strong,class:'mage'};
 assert.ok(gearCatchUpPriority(weak,[weak,strong])>0);
 assert.equal(gearCatchUpPriority(strong,[weak,strong]),0);
 assert.equal(gearCatchUpPriority(weak,[weak,mage,{...strong,complete:false}]),0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createBootResourceScope} from '../../src/runtime/boot-resource-scope.mjs';
import {createSkillWakeups} from '../../src/core/skill-wakeups.mjs';
import {createPriorityScheduler} from '../../src/core/priority.mjs';
import {createImpactIntents} from '../../src/combat/impact-intents.mjs';

test('actual skill cooldown controller is constructed under a scope and released on disposal',()=>{
 let time=1000;
 const owner=createBootResourceScope();
 const controller=owner.acquire('skill-wakeups',()=>createSkillWakeups({now:()=>time}));
 assert.equal(controller.observe('attack',1800),true);
 assert.equal(controller.status().active,1);
 assert.equal(owner.status().active,1);
 const result=owner.close();
 assert.deepEqual(result,{closed:true,reason:null,pending:0,failures:0});
 assert.equal(controller.status().active,0);
 assert.deepEqual(owner.status().releaseOrder,['skill-wakeups']);
 assert.equal(owner.status().safeToReconstruct,false);
 assert.equal(owner.status().applied,false);
 assert.deepEqual(owner.close(),result);
 assert.throws(()=>owner.add('after-close',()=>{}),/closed/);
 assert.throws(()=>owner.acquire('another',()=>createSkillWakeups()),/closed/);
});

test('real priority and impact controllers plus resources release LIFO on partial construction failure',()=>{
 const owner=createBootResourceScope(),order=[];
 const bot={running:true};
 const priority=owner.acquire('priority',()=>createPriorityScheduler(bot),{
  release:value=>{order.push('priority');value.close();}
 });
 priority.run([{id:'background',run:()=>true,priority:1}]);
 assert.equal(priority.status().waiting,1);
 const impacts=owner.acquire('impact-intents',()=>createImpactIntents({
  name:'MyFarmer',session:'session-1',realm:'EU1',now:()=>1000}),{
  release:value=>{order.push('impact');value.close();}
 });
 assert.ok(impacts.launched('attack',['target-1']));
 assert.equal(impacts.snapshot().active,1);
 owner.add('game-callback',()=>order.push('callback'));
 assert.throws(()=>owner.acquire('failed-factory',()=>{throw Error('boot fault');},
  {release:()=>order.push('should-not-run')}),/boot fault/);
 assert.equal(owner.status().active,3);
 assert.deepEqual(owner.close(),{closed:true,reason:null,pending:0,failures:0});
 assert.deepEqual(order,['callback','impact','priority']);
 assert.equal(priority.status().waiting,0);
 assert.equal(impacts.snapshot().active,0);
 assert.equal(owner.status().cleanupFailures,0);
});

test('one throwing cleanup cannot prevent cleanup of later resources',()=>{
 const owner=createBootResourceScope(),order=[];
 owner.add('first',()=>order.push('first'));
 owner.add('throws',()=>{order.push('throws');throw Error('cleanup failure');});
 owner.add('last',()=>order.push('last'));
 const done=owner.close();
 assert.deepEqual(order,['last','throws','first']);
 assert.deepEqual(done,{closed:false,reason:'cleanup-failed',pending:0,failures:1});
 assert.equal(owner.status().active,0);
 assert.equal(owner.status().cleanupFailures,1);
 assert.deepEqual(owner.close(),{closed:false,reason:'cleanup-failed',pending:0,failures:1});
 assert.equal(owner.status().transactionCommitted,false);
 assert.equal(owner.status().actualRollbackCertified,false);
});

test('close triggered during cleanup is contained without reentry or duplicate disposal',()=>{
 const owner=createBootResourceScope(),order=[];
 owner.add('outer',()=>order.push('outer'));
 owner.add('reentrant',()=>{
  assert.deepEqual(owner.close(),{
   closed:false,reason:'release-reentrancy',pending:1,failures:0
  });
  order.push('reentrant');
 });
 assert.equal(owner.close().closed,true);
 assert.deepEqual(order,['reentrant','outer']);
 assert.equal(owner.status().releaseOrder.length,2);
});

test('failed registration with owned real controller cleans it up immediately',()=>{
 const owner=createBootResourceScope();
 for(const name of ['','wrong name','name/invalid']){
  let releases=0;
  assert.throws(()=>owner.acquire(name,()=>createSkillWakeups(),{
   release:value=>{releases++;value.close();}
  }),/factory unavailable/);
  assert.equal(releases,0);
 }
 owner.close();
 let created=0;
 assert.throws(()=>owner.acquire('late',()=>{created++;return createSkillWakeups();}),
  /closed/);
 assert.equal(created,0);
});

test('real boot owns wrappers, hooks, event subscriptions and timer alongside skill lifecycle',async()=>{
 const source=await readFile(new URL('../../src/main.mjs',import.meta.url),'utf8');
 const begin=source.indexOf('const cleanup=createBootResourceScope()');
 const finish=source.indexOf('const api={',begin);
 assert.ok(begin>0&&finish>begin);
 const section=source.slice(begin,finish);
 assert.match(section,/cleanup\.acquire\('skill-wakeups',\(\)=>createSkillWakeups/);
 for(const resource of [
  'game-port-wrapper','chest-watcher','trade-watcher',
  'telemetry-and-staging'
 ])assert.ok(section.includes("cleanup.add('"+resource+"'"),resource);
 assert.match(section,/cleanup\.acquire\('game-'\+event/);
 assert.match(section,/cleanup\.acquire\('merchant-merrit'/);
 assert.match(section,/cleanup\.acquire\('window-'\+type/);
 assert.match(section,/if\(p\.call===recordingPortCall\)p\.call=originalPortCall/);
 assert.match(section,/cleanup\.initialize\(\(\)=>\{/);
 for(const name of ['party-invite','party-request','magiport'])
  assert.ok(section.includes("cleanup.attach('"+name+"'"),name);
 const dispose=source.slice(source.indexOf('dispose(){if(disposed)return;'));
 assert.match(dispose,/cleanup\.close\(\)/);
 assert.doesNotMatch(dispose,/cleanup\.splice\(0\)\.forEach/);
 assert.match(source,/cleanup\.add\('on-destroy-hook'/);
 assert.match(source,/cleanup\.add\('passive-gold-timer'/);
});

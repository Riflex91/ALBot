import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateCombatTimeline} from '../src/combat/combat-time.mjs';
import {assessCombat} from '../src/world/risk.mjs';
import {createRuntimeMetrics} from '../src/core/runtime-metrics.mjs';

const mob={hp:1200,attack:25,frequency:1,armor:10,resistance:200,damage_type:'physical'};
const ranger=(name,changes={})=>({
 name,ctype:'ranger',hp:4000,max_hp:4000,mp:400,max_mp:600,
 attack:200,frequency:2,crit:20,critdamage:50,...changes
});

test('shadow timeline shares certified damage curve but never credits lucky crits to its lower bound',()=>{
 const members=[ranger('R1'),ranger('R2')];
 const m=estimateCombatTimeline(mob,members,{uncertainty:.1});
 assert.equal(m.valid,true);
 assert.equal(m.mode,'shadow-only');
 assert.equal(m.healerBudget,null);
 assert.ok(m.seconds>0&&m.lowerBoundDps>0);
 assert.ok(m.expectedDps>m.lowerBoundDps,'crit only appears in scenario prediction');
 assert.ok(m.rows.every(r=>r.meanIntervalMs===500));
 const slow=estimateCombatTimeline(mob,members.map(r=>({...r,frequency:1})),{uncertainty:.1});
 assert.ok(slow.seconds>m.seconds);
 const uncertain=estimateCombatTimeline(mob,members,{uncertainty:.4});
 assert.ok(uncertain.seconds>m.seconds,'increased uncertainty reduces conservative DPS');
});

test('healer time and mana are shared with attacks, never double counted',()=>{
 const r=ranger('Ranger'),priest=ranger('Priest',{ctype:'priest',attack:100,
  heal:90,frequency:1,mp:220,max_mp:300,crit:0});
 const opts={healer:'Priest',healing:true,
  game:{skills:{heal:{mp:30,cooldown:500}}},
  incomingSeconds:30,uncertainty:.1};
 const both=estimateCombatTimeline(mob,[r,priest],opts);
 const raw=estimateCombatTimeline(mob,[r,priest],{uncertainty:.1});
 assert.equal(both.valid,true);
 assert.ok(both.healerBudget?.casts<=5);
 assert.ok(both.healerBudget.healerDuty>0);
 assert.ok(both.lowerBoundDps<raw.lowerBoundDps);
 assert.ok(both.seconds>raw.seconds);
 const missing=estimateCombatTimeline(mob,[r,priest],{
  healer:'Priest',healing:true,game:{skills:{}},uncertainty:.1
 });
 assert.equal(missing.healerBudget.reason,'heal-parameters-unverified');
 assert.ok(missing.lowerBoundDps<raw.lowerBoundDps);
});

test('unknown combat inputs fail closed in shadow without authorizing attacks',()=>{
 assert.equal(estimateCombatTimeline(mob,[],{}).valid,false);
 assert.equal(estimateCombatTimeline(mob,[ranger('R1',{frequency:0})]).valid,false);
 assert.equal(estimateCombatTimeline(mob,[ranger('R1',{crit:110})]).valid,false);
 assert.equal(estimateCombatTimeline(mob,[ranger('R1')],{uncertainty:-1}).valid,false);
 assert.equal(estimateCombatTimeline(mob,[ranger('R1')],{aggro:100}).valid,false);
});

test('old risk decision is unchanged with shadow telemetry enabled',()=>{
 const ally=ranger('R1',{attack:700,frequency:2,crit:0});
 const options={G:{skills:{heal:{mp:20}}},healing:false,leader:'R1',maxCombatSeconds:36};
 const safe=assessCombat({...mob,hp:100,attack:1},[ally],'balanced',1,options);
 assert.equal(safe.safe,true);
 assert.equal(safe.timelineShadow.authority,'none');
 assert.equal(safe.timelineShadow.valid,true);
 const dangerous=assessCombat({...mob,hp:150000,attack:5000},[ally],'balanced',1,options);
 assert.equal(dangerous.safe,false);
 assert.equal(dangerous.timelineShadow.authority,'none');
 const unknown=assessCombat({...mob,abilities:{explosion:{damage:500}}},[ally],
  'balanced',1,options);
 assert.equal(unknown.safe,false);
 assert.equal(unknown.mechanics,true);
});

test('runtime metrics bound frames, include p95/p99 and report dispatch rates',()=>{
 let clock=1000;const metrics=createRuntimeMetrics({now:()=>clock,capacity:8});
 metrics.measure('team-plan',()=>{clock+=5;});
 for(let i=0;i<30;i++)metrics.frame(i+1);
 const r=metrics.measure('farmer',()=>{clock+=2;return 'ok';});
 assert.equal(r,'ok');
 metrics.observe('action.start',{key:'skill:3shot'});
 metrics.observe('action.end',{key:'skill:3shot',result:'returned'});
 metrics.observe('action.start',{key:'gold.send'});
 metrics.observe('action.end',{key:'gold.send',result:'rejected'});
 const report=metrics.status();
 assert.equal(report.frames,30);
 assert.equal(report.maxFrameMs,30);
 assert.equal(report.modules.find(x=>x.name==='total-frame').p99Ms,30);
 assert.equal(report.modules.find(x=>x.name==='team-plan').calls,1);
 assert.equal(report.actions.find(x=>x.name==='skill').started,1);
 assert.equal(report.actions.find(x=>x.name==='gold.send').rejected,1);
 assert.ok(report.wallLoadProxy<=1);
});

test('runtime metrics do not skip profiling when a module throws and have no timers',()=>{
 let t=5;const metrics=createRuntimeMetrics({now:()=>t});
 assert.throws(()=>metrics.measure('bosses',()=>{t+=3;throw Error('boom');}));
 assert.equal(metrics.status().modules[0].p95Ms,3);
 assert.equal(metrics.status().frames,0);
});

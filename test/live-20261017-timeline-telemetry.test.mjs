import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestReport} from '../src/core/test-report.mjs';
import {createStrategy} from '../src/world/strategy.mjs';

test('live report retains bounded structured combat diagnostics without serializing arbitrary objects',()=>{
  const p={headless:false,c:{name:'Ranger'},G:{version:17665},realm:()=> 'USV',log(){}};
  const report=createTestReport(p,'0.10.8-candidate');
  report.event('strategy.riskRejected',{
    target:'snake',
    timelineShadow:{valid:true,projectedSeconds:3.5,attackIntervalsMs:[{name:'Ranger',intervalMs:500}],authority:'none'},
    damageShadow:{valid:true,damage:125},
    unrelated:{session:'private'}
  });
  const e=report.document().events.at(-1);
  assert.equal(JSON.parse(e.timelineShadow).projectedSeconds,3.5);
  assert.deepEqual(JSON.parse(e.timelineShadow).attackIntervalsMs,[{name:'Ranger',intervalMs:500}]);
  assert.equal(JSON.parse(e.damageShadow).damage,125);
  assert.equal(e.unrelated,'[object Object]');
  assert.equal(JSON.parse(e.timelineShadow).authority,'none');
});

test('risk shadow telemetry is throttled, diagnostic-only and preserves combat admission',()=>{
  const ev=[];
  const p={
    c:{name:'Ranger',ctype:'ranger',hp:4000,max_hp:4000,
      mp:1000,max_mp:1000,attack:500,frequency:2,
      crit:0,critdamage:0,armor:100,resistance:100,
      map:'main',in:'main',x:0,y:0,range:200},
    G:{monsters:{snake:{hp:100,attack:1,frequency:1,armor:0,resistance:0,
      damage_type:'physical'}},skills:{}},
    root:{},parent:{},realm:()=> 'USV',read:()=>null
  };
  const cfg={general:{testLogging:true},world:{risk:'balanced',excludedMaps:[]},
    farming:{maxAggro:1,maxCombatSeconds:25,targets:['snake']},
    party:{enabled:false,merchant:'Merchant',healing:false}};
  const bot={p,cfg,me:{name:'Ranger',role:'farmer',farmTargets:[]},
    leader:'Ranger',farmers:['Ranger'],event:(...args)=>ev.push(args)};
  const strategy=createStrategy(bot);
  const first=strategy.safeTarget('snake');
  const second=strategy.safeTarget('snake');
  assert.equal(first,second,'diagnostic path must not change admission');
  const samples=ev.filter(([event])=>event==='combat.timelineShadow');
  assert.equal(samples.length,1,'repeated per-tick risk evaluations must not flood the event ring');
  const shadow=samples[0][1];
  assert.equal(shadow.monster,'snake');
  assert.equal(shadow.authority,'none');
  assert.equal(shadow.safe,first);
  assert.ok(Number.isFinite(shadow.projectedSeconds));
  assert.deepEqual(JSON.parse(shadow.attackIntervalsMs),[{name:'Ranger',intervalMs:500}]);
});

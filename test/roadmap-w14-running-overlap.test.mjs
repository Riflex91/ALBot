import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {analyzeLiveTeam} from '../scripts/lib/live-team-audit.mjs';

const time=minute=>'2026-10-21T10:'+String(minute).padStart(2,'0')+':00Z';
const report=(character,changes={})=>({
 format:'albot-test-report',character,environment:'browser',realm:'EUI',
 version:'0.22.0-candidate',started:time(0),exported:time(20),
 counts:{},events:[
  {type:'sample',seq:1,time:time(7),running:true,rip:false,task:'farm'},
  {type:'sample',seq:2,time:time(8),running:true,rip:false,task:'farm'}],
 dropped:0,actionStats:{},...changes
});
const merchant=report('My_Merchant'),ranger=report('My_Ranger1');
const check=r=>analyzeLiveTeam([merchant,r],{
 minOverlapSeconds:600,requireObservedOverlap:true
});

test('W14 strict observed-overlap witness requires sequenced running samples per character',()=>{
 const result=check(ranger);
 assert.equal(result.accepted,true);
 assert.deepEqual(result.scope.observedOverlapEvidence,
  {required:true,checked:2,missing:[],incomplete:[]});
});

test('W14 metadata overlap without actually running samples is insufficient',()=>{
 for(const events of [
  [],[{type:'sample',seq:1,time:time(7),running:true,rip:false}],
  [{type:'sample',seq:1,time:time(7),running:true,rip:false},
   {type:'sample',seq:2,time:time(7),running:true,rip:false}],
  [{type:'sample',seq:1,time:time(7),running:true,rip:false},
   {type:'sample',seq:2,time:time(8),running:false,rip:false}],
  [{type:'sample',seq:1,time:time(7),running:true,rip:false},
   {type:'sample',seq:2,time:time(8),running:true,rip:true}],
  [{type:'sample',seq:1,time:time(21),running:true,rip:false},
   {type:'sample',seq:2,time:time(22),running:true,rip:false}],
  [{type:'sample',seq:1,time:time(7),running:true,rip:false},
   {type:'sample',seq:1,time:time(8),running:true,rip:false}]
 ]){
  const r=check(report('My_Ranger1',{events}));
  assert.equal(r.accepted,false);
  assert.ok(r.issues.some(x=>x.code==='MISSING_RUNNING_OVERLAP_SAMPLES'));
  assert.deepEqual(r.scope.observedOverlapEvidence.missing,['My_Ranger1']);
 }
 // Existing diagnostic callers must remain compatible by default.
 assert.equal(analyzeLiveTeam([merchant,report('My_Ranger1',{events:[]})]).accepted,true);
});

test('W14 incomplete reports and mixed environments cannot satisfy strict live overlap',()=>{
 const dropped=check(report('My_Ranger1',{dropped:1}));
 assert.equal(dropped.accepted,false);
 assert.ok(dropped.issues.some(x=>x.code==='INCOMPLETE_OVERLAP_EVENT_HISTORY'));
 assert.deepEqual(dropped.scope.observedOverlapEvidence.incomplete,['My_Ranger1']);
 const mixed=check(report('My_Ranger1',{environment:'headless'}));
 assert.equal(mixed.accepted,false);
 assert.ok(mixed.issues.some(x=>x.code==='MIXED_OR_UNKNOWN_ENVIRONMENT'));
});

test('W14 CLI opt-in requires observed activity and preserves legacy CLI',()=>{
 const dir=mkdtempSync(join(tmpdir(),'albot-w14-running-'));
 try{
  const m=join(dir,'merchant.json'),f=join(dir,'ranger.json');
  writeFileSync(m,JSON.stringify(merchant));
  writeFileSync(f,JSON.stringify(report('My_Ranger1',{events:[]})));
  const script=resolve('scripts/CHECK-LIVE-TEAM.mjs');
  const run=flag=>spawnSync(process.execPath,[script,
   '--min-overlap-seconds','600',...(flag?['--require-observed-overlap']:[]),
   m,f],{encoding:'utf8'});
  assert.equal(run(false).status,0);
  const strict=run(true);
  assert.equal(strict.status,1,strict.stderr);
  assert.ok(JSON.parse(strict.stdout).issues.some(
   x=>x.code==='MISSING_RUNNING_OVERLAP_SAMPLES'));
 }finally{rmSync(dir,{recursive:true,force:true});}
});

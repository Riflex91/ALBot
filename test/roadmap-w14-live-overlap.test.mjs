import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {analyzeLiveTeam} from '../scripts/lib/live-team-audit.mjs';

const report=(character,started,exported)=>({
 format:'albot-test-report',character,realm:'USV',
 version:'0.10.11-candidate',started,exported,events:[],counts:{},
 dropped:0,actionStats:{},inventory:[],equipment:{slots:{}}
});
const m=report('My_Merchant','2026-10-19T10:00:00Z','2026-10-19T10:10:00Z');
const f=report('My_Ranger1','2026-10-19T10:05:00Z','2026-10-19T10:15:00Z');

test('W14 same version/realm but disjoint characters are not accepted as a team run',()=>{
 const late=report('My_Ranger1','2026-10-19T10:11:00Z','2026-10-19T10:20:00Z');
 const result=analyzeLiveTeam([m,late]);
 assert.equal(result.accepted,false);
 assert.ok(result.issues.some(x=>x.code==='DISJOINT_OBSERVATION_WINDOWS'));
 assert.deepEqual(result.scope.sharedObservation,{
  from:null,until:null,seconds:0,sufficient:false
 });
});

test('W14 shared capture window is the intersection, not the union',()=>{
 const result=analyzeLiveTeam([m,f],{minOverlapSeconds:300});
 assert.equal(result.accepted,true);
 assert.deepEqual(result.scope.sharedObservation,{
  from:'2026-10-19T10:05:00.000Z',
  until:'2026-10-19T10:10:00.000Z',
  seconds:300,sufficient:true
 });
 assert.equal(analyzeLiveTeam([m,f],{minOverlapSeconds:301}).accepted,false);
 assert.ok(analyzeLiveTeam([m,f],{minOverlapSeconds:301}).issues.some(
  x=>x.code==='INSUFFICIENT_OBSERVATION_OVERLAP'));
});

test('W14 missing, malformed and reversed timestamps fail closed',()=>{
 for(const invalid of [
  {...f,started:'not-a-time'}, {...f,exported:'not-a-time'},
  {...f,exported:f.started}
 ]){
  const result=analyzeLiveTeam([m,invalid]);
  assert.equal(result.accepted,false);
  assert.ok(result.issues.some(x=>x.code==='INVALID_OBSERVATION_WINDOW'));
  assert.equal(result.scope.sharedObservation.sufficient,false);
 }
 assert.throws(()=>analyzeLiveTeam([m,f],{minOverlapSeconds:-1}),
  /Invalid minimum/);
});

test('W14 CLI --min-overlap-seconds is enforced on actual JSON reports',()=>{
 const dir=mkdtempSync(join(tmpdir(),'albot-overlap-'));
 try{
  const merchant=join(dir,'merchant.json'),farmer=join(dir,'farmer.json');
  writeFileSync(merchant,JSON.stringify(m));
  writeFileSync(farmer,JSON.stringify(f));
  const script=resolve('scripts/CHECK-LIVE-TEAM.mjs');
  const run=seconds=>spawnSync(process.execPath,[script,
   '--min-overlap-seconds',String(seconds),merchant,farmer],
   {encoding:'utf8'});
  const accepted=run(300);
  assert.equal(accepted.status,0,accepted.stderr);
  const refused=run(301);
  assert.equal(refused.status,1,refused.stderr);
  assert.ok(JSON.parse(refused.stdout).issues.some(
   x=>x.code==='INSUFFICIENT_OBSERVATION_OVERLAP'));
 }finally{rmSync(dir,{recursive:true,force:true});}
});

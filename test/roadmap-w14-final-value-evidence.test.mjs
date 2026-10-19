import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeLiveTeam} from '../scripts/lib/live-team-audit.mjs';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';

const report=(character,overrides={})=>({
 format:'albot-test-report',character,realm:'USV',
 version:'0.10.11-candidate',
 started:'2026-10-19T12:00:00Z',
 exported:'2026-10-19T12:15:00Z',
 events:[],counts:{},dropped:0,actionStats:{},
 status:{inventoryBlocked:false,journal:null},
 bankPartial:null,
 ...overrides
});
const merchant=report('My_Merchant'),farmer=report('My_Ranger1');
const verify=r=>analyzeLiveTeam([merchant,r],{requireSettledValueState:true});

test('W14 explicit final value evidence accepts only settled terminal checkpoints',()=>{
 const ok=verify(farmer);
 assert.equal(ok.accepted,true);
 assert.deepEqual(ok.scope.valueStateEvidence,{
  required:true,checked:2,missing:[],unresolved:[]
 });
});

test('W14 pending inventory, checkpoint or bank journal block acceptance without leaking journal contents',()=>{
 for(const changes of [
  {status:{inventoryBlocked:true,journal:null}},
  {status:{inventoryBlocked:false,journal:{kind:'send',secret:'private'}}},
  {bankPartial:{item:'ore',quantity:5}}
 ]){
  const result=verify(report('My_Ranger1',changes));
  assert.equal(result.accepted,false);
  assert.ok(result.issues.some(x=>x.code==='UNSETTLED_FINAL_VALUE_STATE'));
  assert.deepEqual(result.scope.valueStateEvidence.unresolved,['My_Ranger1']);
  assert.equal(JSON.stringify(result).includes('private'),false);
 }
});

test('W14 missing checkpoint fields are not interpreted as a clean value state',()=>{
 const candidates=[
  {status:null},{status:{inventoryBlocked:false}},
  {status:{inventoryBlocked:'false',journal:null}},
  {status:{inventoryBlocked:false,journal:undefined}}
 ];
 for(const x of candidates){
  const result=verify(report('My_Ranger1',x));
  assert.equal(result.accepted,false);
  assert.ok(result.issues.some(i=>i.code==='MISSING_FINAL_VALUE_EVIDENCE'||
    i.code==='UNSETTLED_FINAL_VALUE_STATE'));
 }
 const legacy=analyzeLiveTeam([merchant,report('My_Ranger1',{status:null})]);
 assert.equal(legacy.accepted,true,'read-only legacy diagnostics stay usable without W14 opt-in');
});

test('W14 strict CLI gate fails for an open final bank value journal',()=>{
 const dir=mkdtempSync(join(tmpdir(),'albot-w14-journal-'));
 try{
  const first=join(dir,'m.json'),second=join(dir,'f.json');
  writeFileSync(first,JSON.stringify(merchant));
  writeFileSync(second,JSON.stringify(report('My_Ranger1',{bankPartial:{item:'ore'}})));
  const run=spawnSync(process.execPath,[resolve('scripts/CHECK-LIVE-TEAM.mjs'),
   '--require-settled-value-state',first,second],{encoding:'utf8'});
  assert.equal(run.status,1,run.stderr);
  assert.ok(JSON.parse(run.stdout).issues.some(
   x=>x.code==='UNSETTLED_FINAL_VALUE_STATE'));
 }finally{rmSync(dir,{recursive:true,force:true});}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLiveReport,joinLiveReportParts} from '../scripts/lib/live-team-audit.mjs';

const a='2026-10-21T10:00:00Z',b='2026-10-21T10:10:00Z';
const e={type:'sample',seq:1,time:'2026-10-21T10:02:00Z',
 running:true,rip:false,task:'farm'};
const report=(events,extra={})=>({
 format:'albot-test-report',character:'My_Ranger1',started:a,
 exported:b,realm:'EUI',version:'0.22.0-candidate',
 environment:'browser',gameVersion:'2026.10',
 counts:{sample:1},events,dropped:0,actionStats:{},...extra
});
const jsonl=events=>[
 {type:'session',time:a,character:'My_Ranger1',version:'0.22.0-candidate'},
 ...events,
 {...report([]),type:'snapshot'}
].map(x=>JSON.stringify(x)).join('\n');

test('W14 identical overlapping JSONL sequence is deduplicated without double count',()=>{
 const parsed=parseLiveReport(jsonl([e,{...e}]));
 assert.equal(parsed.events.length,1);
 assert.equal(parsed.events[0].seq,1);
 assert.equal(parsed.dropped,0);
});

test('W14 conflicting duplicate sequence inside one JSONL file cannot overwrite evidence',()=>{
 for(const conflict of [
  {...e,type:'action.start',key:'attack'},
  {...e,time:'2026-10-21T10:04:00Z'},
  {...e,running:false}
 ]){
  assert.throws(()=>parseLiveReport(jsonl([e,conflict])),
   /Conflicting JSONL event sequence 1/);
 }
});

test('W14 identical replay across report parts is tolerated but not double-counted',()=>{
 const merged=joinLiveReportParts([
  report([e],{exported:'2026-10-21T10:05:00Z'}),
  report([{...e},{...e,seq:2,time:'2026-10-21T10:07:00Z'}])
 ]);
 assert.equal(merged.length,1);
 assert.deepEqual(merged[0].events.map(x=>x.seq),[1,2]);
});

test('W14 contradictory replay across parts is rejected before attribution',()=>{
 for(const changed of [
  {...e,time:'2026-10-21T10:05:00Z'},
  {...e,rip:true},
  {...e,type:'action.end',key:'upgrade'}
 ]){
  assert.throws(()=>joinLiveReportParts([report([e]),report([changed])]),
   /Conflicting event sequence/);
 }
});

test('W14 environment, game-version or process-start changes require separate sessions',()=>{
 for(const changes of [
  {environment:'headless'},
  {gameVersion:'2026.11'},
  {gameVersion:null},
  {started:'2026-10-21T10:01:00Z'}
 ]){
  assert.throws(()=>joinLiveReportParts([report([e]),report([e],changes)]),
   /Cannot join separate sessions/);
 }
});

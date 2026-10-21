import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLiveReport} from '../scripts/lib/live-team-audit.mjs';

const started='2026-10-21T10:00:00.000Z';
const snapshot=(extra={})=>({
 type:'snapshot',format:'albot-test-report',
 character:'My_Ranger1',version:'0.22.0-candidate',
 environment:'browser',gameVersion:'2026.10',
 realm:'EUI',started,exported:'2026-10-21T10:10:00.000Z',
 counts:{},events:[],dropped:0,actionStats:{},...extra
});
const header=(extra={})=>({type:'session',time:started,
 character:'My_Ranger1',version:'0.22.0-candidate',
 environment:'browser',...extra});
const event={type:'sample',seq:1,
 time:'2026-10-21T10:05:00.000Z',running:true,rip:false};
const decode=records=>parseLiveReport(records.map(x=>JSON.stringify(x)).join('\n'));
test('W14 consistent repeated JSONL session header and snapshots stay readable',()=>{
 const r=decode([header(),event,snapshot(),header(),
  snapshot({exported:'2026-10-21T10:12:00.000Z'})]);
 assert.equal(r.events.length,1);
 assert.equal(r.exported,'2026-10-21T10:12:00.000Z');
});
test('W14 different process start inside one JSONL stream is not one observation',()=>{
 assert.throws(()=>decode([header(),event,header({
  time:'2026-10-21T10:04:00.000Z'}),snapshot()]),
 /Conflicting JSONL session header/);
 assert.throws(()=>decode([header(),event,snapshot({
  started:'2026-10-21T10:01:00.000Z'})]),
 /Conflicting JSONL session start/);
});
test('W14 mismatched header actor, version or environment blocks merged event claims',()=>{
 for(const changes of [
  {character:'My_Ranger2'},
  {version:'0.23.0-candidate'},
  {environment:'headless'}
 ]){
  assert.throws(()=>decode([header(),event,header(changes),snapshot()]),
   /Conflicting JSONL session header/);
  assert.throws(()=>decode([header(changes),event,snapshot()]),
   /Conflicting JSONL header and snapshot/);
 }
});
test('W14 conflicting interim snapshots cannot be overwritten by newest record',()=>{
 for(const changes of [
  {character:'My_Ranger2'},
  {realm:'USI'},
  {gameVersion:'2026.11'},
  {version:'0.21.0-candidate'},
  {started:'2026-10-21T09:59:00.000Z'}
 ]){
  assert.throws(()=>decode([header(),snapshot(changes),event,snapshot()]),
   /Conflicting JSONL snapshot session/);
 }
});
test('W14 legacy JSONL with one partial header still reads if consistent',()=>{
 const r=decode([{type:'session',time:started},event,
  snapshot({environment:null,gameVersion:null})]);
 assert.equal(r.character,'My_Ranger1');
 assert.equal(r.events.length,1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {telemetrySummary} from '../public/telemetry-summary.mjs';
import {SNAPSHOT_FRESH_MS} from '../public/free-tier.mjs';
import {readFile} from 'node:fs/promises';

const now=1_790_000_000_000;
test('summaries classify timestamped observations without asserting online state',()=>{
 const summary=telemetrySummary({now,
  characters:[{observedAt:now-10_000},{observedAt:now-SNAPSHOT_FRESH_MS},
   {observedAt:now+1000},{observedAt:NaN},{}],
  bank:[{observedAt:now-2_000},{observedAt:now-600_000}]});
 assert.deepEqual(summary.characters,{available:true,total:5,recent:1,latest:now-10_000});
 assert.deepEqual(summary.bank,{available:true,total:2,recent:1,latest:now-2_000});
});
test('API failures mask stale cached counts instead of reporting zero or live data',()=>{
 const data=telemetrySummary({now,
  characters:[{observedAt:now-10}],bank:[{observedAt:now-10}],
  errors:{characters:'Worker failed',bank:'D1 unavailable'}});
 assert.deepEqual(data.characters,{available:false,total:null,recent:null,latest:null});
 assert.deepEqual(data.bank,{available:false,total:null,recent:null,latest:null});
});
test('missing observations do not imply an empty account inventory',()=>{
 const s=telemetrySummary({now,characters:[],bank:[]});
 assert.deepEqual(s.bank,{available:true,total:0,recent:0,latest:null});
});
test('dashboard and settings use the same conservative summary without asking for a token',async()=>{
 const app=await readFile(new URL('../public/app.mjs',import.meta.url),'utf8');
 assert.match(app,/telemetrySummary\(\{characters:state\.characters,bank:state\.bank/);
 assert.match(app,/Bankfächer frisch/);
 assert.match(app,/kein Verbindungsnachweis/);
 assert.match(app,/Die private ALBot-Telemetrie wird direkt aus Adventure Land übertragen/);
 assert.match(app,/noch nicht im Spiel angewendet/);
 assert.doesNotMatch(app,/Im Relay-Fenster zuerst Empfang aktivieren/);
 assert.doesNotMatch(app,/Die Character-\/Bank-Telemetrie ist erst nach Einrichtung/);
});

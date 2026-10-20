import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {storeTelemetry,MAX_STORED_CHARACTERS,MAX_STORED_BANK_PACKS,
 SNAPSHOT_READ_TTL_MS} from '../worker/telemetry-store.mjs';
import {TELEMETRY_MIN_INTERVAL_MS} from '../public/free-tier.mjs';
import {handleRequest} from '../worker/index.mjs';

function testDb(){
 const database=new DatabaseSync(':memory:');
 database.exec(`CREATE TABLE character_snapshots(
  name TEXT PRIMARY KEY NOT NULL,updated_at INTEGER NOT NULL,
  realm TEXT NOT NULL,map TEXT NOT NULL,payload TEXT NOT NULL);
 CREATE TABLE bank_snapshots(
  key TEXT PRIMARY KEY NOT NULL,updated_at INTEGER NOT NULL,
  realm TEXT NOT NULL,map TEXT NOT NULL,payload TEXT NOT NULL);
 CREATE INDEX idx_bank_updated ON bank_snapshots(updated_at);`);
 // D1-shaped adapter over real SQLite: tests execute production SQL.
 const DB={prepare(sql){const statement=database.prepare(sql);return {
  bind(...params){return {
   async run(){return {meta:{changes:statement.run(...params).changes}};},
   async all(){return {results:statement.all(...params)};}
  };}
 };}};
 return {database,DB};
}
const sampleCharacter=(name='My_Ranger1')=>({
 name,realm:'EUI',map:'main',level:71,hp:2340,mp:980,maxHp:2400,maxMp:1000,
 x:110,y:210,inventory:[{name:'beewings',q:12,level:0},null],
 expPerHour:0,goldPerHour:0,ratesMeasured:false
});
const sampleBank=pack=>({pack,realm:'EUI',map:'bank',slots:Array(42).fill(null)});

test('character updates obey atomic 120s D1 write throttle',async()=>{
 const {database,DB}=testDb();const character=sampleCharacter();
 const start=1760000000000;
 assert.equal((await storeTelemetry(DB,'character',character,start)).stored,true);
 assert.equal((await storeTelemetry(DB,'character',{...character,hp:100},start+1000)).stored,false);
 assert.equal(database.prepare('SELECT payload FROM character_snapshots').get().payload.includes('"hp":2340'),true);
 assert.equal((await storeTelemetry(DB,'character',{...character,hp:100},
  start+TELEMETRY_MIN_INTERVAL_MS)).stored,true);
 assert.equal(JSON.parse(database.prepare('SELECT payload FROM character_snapshots').get().payload).hp,100);
 database.close();
});

test('character hard cap bounds D1 storage while existing members remain writable',async()=>{
 const {database,DB}=testDb();const now=1760000000000;
 for(let i=0;i<MAX_STORED_CHARACTERS;i++)
  assert.equal((await storeTelemetry(DB,'character',sampleCharacter('Ranger'+i),now)).stored,true);
 assert.equal((await storeTelemetry(DB,'character',sampleCharacter('ExtraRanger'),now)).stored,false);
 assert.equal(database.prepare('SELECT count(*) AS n FROM character_snapshots').get().n,MAX_STORED_CHARACTERS);
 assert.equal((await storeTelemetry(DB,'character',sampleCharacter('Ranger0'),
  now+TELEMETRY_MIN_INTERVAL_MS)).stored,true);
 database.close();
});

test('bank throttle is global per interval, and storage remains capped at 24 packs',async()=>{
 const {database,DB}=testDb();const start=1760000000000;
 assert.equal((await storeTelemetry(DB,'bank',sampleBank('items0'),start)).stored,true);
 assert.equal((await storeTelemetry(DB,'bank',sampleBank('items1'),start+1000)).stored,false);
 assert.equal((await storeTelemetry(DB,'bank',sampleBank('items0'),start+1000)).stored,false);
 for(let n=1;n<MAX_STORED_BANK_PACKS;n++)
  assert.equal((await storeTelemetry(DB,'bank',sampleBank('items'+n),
   start+n*TELEMETRY_MIN_INTERVAL_MS)).stored,true);
 assert.equal((await storeTelemetry(DB,'bank',sampleBank('items24'),
  start+MAX_STORED_BANK_PACKS*TELEMETRY_MIN_INTERVAL_MS)).stored,false);
 assert.equal(database.prepare('SELECT count(*) AS n FROM bank_snapshots').get().n,MAX_STORED_BANK_PACKS);
 assert.equal((await storeTelemetry(DB,'bank',sampleBank('items0'),
  start+MAX_STORED_BANK_PACKS*TELEMETRY_MIN_INTERVAL_MS)).stored,true);
 database.close();
});

test('Worker responds 429 without writing a duplicated snapshot and keeps CORS',async()=>{
 const {database,DB}=testDb();
 const env={DB,INGEST_TOKEN:'X'.repeat(64)};
 const packet={version:1,kind:'character',data:sampleCharacter()};
 const upload=()=>handleRequest(new Request('https://albot.invalid/api/ingest',{
  method:'POST',headers:{origin:'https://adventure.land',
   authorization:'Bearer '+env.INGEST_TOKEN,'content-type':'application/json'},
  body:JSON.stringify(packet)}),env);
 const first=await upload();assert.equal(first.status,200);
 const second=await upload();assert.equal(second.status,429);
 assert.equal(second.headers.get('retry-after'),'120');
 assert.equal(second.headers.get('access-control-allow-origin'),'https://adventure.land');
 assert.equal(database.prepare('SELECT count(*) AS n FROM character_snapshots').get().n,1);
 database.close();
});

test('D1 confirmation failure is fail-closed, and expired rows are excluded on read',async()=>{
 const value=sampleCharacter();
 await assert.rejects(storeTelemetry({
  prepare(){return {bind(){return {run:async()=>({success:true})};}}}
 },'character',value,1760000000000),/confirmation unavailable/);
 const {database,DB}=testDb();const now=Date.now();
 await storeTelemetry(DB,'character',value,now-SNAPSHOT_READ_TTL_MS-1000);
 const result=await DB.prepare('SELECT updated_at,payload FROM character_snapshots WHERE updated_at >= ?')
  .bind(now-SNAPSHOT_READ_TTL_MS).all();
 assert.equal(result.results.length,0);
 database.close();
});

test('Free-only source avoids scheduled runtime uploads and paid Cloudflare services',async()=>{
 const runtime=await readFile(new URL('../../src/runtime/telemetry-snapshot.mjs',import.meta.url),'utf8');
 const worker=await readFile(new URL('../worker/index.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(runtime,/\bfetch\s*\(|INGEST_TOKEN|\bsetInterval\s*\(/);
 assert.match(worker,/storeTelemetry\(env\.DB,d\.kind,d\.data,now\)/);
 assert.match(worker,/telemetryLimits:/);
});

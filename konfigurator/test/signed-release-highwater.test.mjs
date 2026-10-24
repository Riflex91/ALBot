import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readSignedReleaseHighwater,recordSignedReleaseHighwater,
 SIGNED_RELEASE_HIGHWATER_FORMAT} from '../worker/signed-release-highwater.mjs';

const T='ALBot/TestAccount',K='a'.repeat(64),H='b'.repeat(64),SHA='c'.repeat(40);
const clock=1792600000000;
class MemoryD1{
 constructor(){this.rows=new Map();this.calls=[];this.race=null;this.missing=false;}
 prepare(sql){
  if(!sql.includes('signed_config_highwater'))throw Error('Unknown database table');
  if(this.missing)throw Error('no such table: signed_config_highwater');
  const db=this;return {
   bind(...args){
    const query={
     first:async()=>{
      db.calls.push({operation:'read',sql,args});
      return structuredClone(db.rows.get(args[0])??null);
     },
     run:async()=>{
      db.calls.push({operation:'write',sql,args});
      if(!sql.includes('ON CONFLICT(target) DO UPDATE')||
       !sql.includes('excluded.sequence>signed_config_highwater.sequence')||
       !sql.includes('signed_config_highwater.key_id=excluded.key_id'))
       throw Error('Missing atomic D1 CAS restriction');
      const [target,key_id,sequence,sha256,release_sha,updated_at]=args;
      if(db.race){const race=db.race;db.race=null;race(db);}
      const existing=db.rows.get(target);
      if(existing&&(existing.key_id!==key_id||sequence<=existing.sequence))
       return {meta:{changes:0}};
      db.rows.set(target,{key_id,sequence,sha256,release_sha,updated_at});
      return {meta:{changes:1}};
     }
    };
    return query;
   }
  };
 }
}
const input=(sequence=2)=>({target:T,keyId:K,sequence,sha256:H,
 releaseSha:SHA,now:clock});
test('additive D1 schema has one private signed publication anchor, no plaintext profile fields',async()=>{
 const sql=await readFile(new URL('../schema.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS signed_config_highwater/);
 assert.match(sql,/target TEXT PRIMARY KEY NOT NULL/);
 assert.match(sql,/sequence INTEGER NOT NULL CHECK\(sequence > 0\)/);
 assert.doesNotMatch(sql,/DROP TABLE|ALTER TABLE signed_config_highwater/i);
 const schema=sql.split('signed_config_highwater (')[1].split(');')[0];
 assert.doesNotMatch(schema,/profile|signature|password|token|character/i);
});
test('signed publisher high-water begins empty; appends verified monotonic state and nothing applied',async()=>{
 const db=new MemoryD1();
 let v=await readSignedReleaseHighwater(db,{target:T,keyId:K});
 assert.equal(v.anchored,false);
 assert.equal(v.anchor,null);
 const first=await recordSignedReleaseHighwater(db,input(2));
 assert.equal(first.format,SIGNED_RELEASE_HIGHWATER_FORMAT);
 assert.equal(first.anchored,true);
 assert.equal(first.anchor.sequence,2);
 assert.equal(first.anchor.sha256,H);
 assert.equal(first.anchor.releaseSha,SHA);
 assert.equal(first.changed,true);
 assert.equal(first.issuedOnly,true);
 assert.equal(first.applied,false);
 assert.equal(first.acknowledged,false);
 assert.equal(db.rows.size,1);
 const repeat=await recordSignedReleaseHighwater(db,input(2));
 assert.equal(repeat.idempotent,true);
 assert.equal(repeat.changed,false);
 assert.equal(db.calls.filter(x=>x.operation==='write').length,1);
 const next=await recordSignedReleaseHighwater(db,{
  ...input(3),sha256:'d'.repeat(64),releaseSha:'e'.repeat(40)});
 assert.equal(next.anchor.sequence,3);
 assert.equal(db.rows.size,1);
 assert.deepEqual([...db.rows.keys()],[T]);
});
test('same sequence different digest or Git blob is equivocation; downgrade blocked without D1 writes',async()=>{
 const db=new MemoryD1();await recordSignedReleaseHighwater(db,input(5));
 const before=structuredClone([...db.rows]);
 for(const bad of [
  input(4),{...input(5),sha256:'d'.repeat(64)},
  {...input(5),releaseSha:'f'.repeat(40)},
  {...input(5),keyId:'e'.repeat(64)}]){
  await assert.rejects(recordSignedReleaseHighwater(db,bad),
   /downgrade|equivocation|pin mismatch/);
  assert.deepEqual([...db.rows],before);
 }
 assert.equal(db.calls.filter(x=>x.operation==='write').length,1);
});
test('simultaneous conflicting commits fail closed with atomic SQL predicate',async()=>{
 const db=new MemoryD1();
 await recordSignedReleaseHighwater(db,input(2));
 db.race=x=>x.rows.set(T,{key_id:K,sequence:5,sha256:'e'.repeat(64),
  release_sha:'f'.repeat(40),updated_at:clock+1});
 await assert.rejects(recordSignedReleaseHighwater(db,input(4)),/conflicted/);
 assert.equal(db.rows.get(T).sequence,5);
 await assert.rejects(recordSignedReleaseHighwater(db,input(3)),/downgrade/);
});
test('missing migration, D1 failure, corrupted record or missing write confirmation is unavailable, not zero',async()=>{
 const db=new MemoryD1();db.missing=true;
 await assert.rejects(readSignedReleaseHighwater(db,{target:T,keyId:K}),/no such table/);
 db.missing=false;db.rows.set(T,{sequence:'4',key_id:K,sha256:H,
  release_sha:SHA,updated_at:clock});
 await assert.rejects(readSignedReleaseHighwater(db,{target:T,keyId:K}),/corrupted/);
 db.rows.clear();
 const dbUnknown={prepare:()=>({bind:()=>({
  first:async()=>null,run:async()=>({meta:{}})
 })})};
 await assert.rejects(recordSignedReleaseHighwater(dbUnknown,input(1)),/confirmation/);
 await assert.rejects(readSignedReleaseHighwater(null,{target:T,keyId:K}),/unavailable/);
});
test('strict trust fields and bounds reject attacker supplied target, digest or private signer',async()=>{
 const db=new MemoryD1();
 for(const bad of [
  {...input(1),target:'ALBot/Evil?'},
  {...input(1),sequence:0},
  {...input(1),sequence:Number.MAX_SAFE_INTEGER},
  {...input(1),sha256:'bad'},
  {...input(1),releaseSha:'a'.repeat(64)},
  {...input(1),keyId:'private-key'},
  {...input(1),now:NaN}
 ])await assert.rejects(recordSignedReleaseHighwater(db,bad),/Invalid/);
 assert.equal(db.rows.size,0);
});

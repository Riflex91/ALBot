import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {checkPackage,exportBundle,SLOT_LIMIT,BOOTSTRAP_RUNTIME_LIMIT} from '../editor/lib/contract.mjs';

// Remote signed runtime packages have the loader's 8-MiB download ceiling.
// The legacy copy/paste CODE artifact deliberately retains its own 1-MiB
// limit, which is not silently redefined as a deployable CODE capacity.
test('bootstrap accepts a verifiable runtime above legacy CODE size',async()=>{
 const saved=JSON.parse(await readFile(new URL('../dist/albot.package.json',import.meta.url),'utf8'));
 const code='/* ALBot '+saved.runtime.version+' test */\n'+
  '/*'+'x'.repeat(SLOT_LIMIT)+'*/\nvoid 0;';
 assert.ok(Buffer.byteLength(code)>SLOT_LIMIT);
 assert.ok(Buffer.byteLength(code)<BOOTSTRAP_RUNTIME_LIMIT);
 const runtime={...saved.runtime,code,sha256:createHash('sha256').update(code).digest('hex')};
 const result=await checkPackage({...saved,runtime});
 assert.equal(result.runtime.sha256,runtime.sha256);
});
test('bootstrap rejects a runtime beyond its real 8-MiB download cap',async()=>{
 const saved=JSON.parse(await readFile(new URL('../dist/albot.package.json',import.meta.url),'utf8'));
 const code='x'.repeat(BOOTSTRAP_RUNTIME_LIMIT+1);
 await assert.rejects(checkPackage({...saved,runtime:{...saved.runtime,code}}),
  /8-MiB-Bootstrap-Downloadgrenze/);
});
test('legacy CODE export does not pretend to be an 8-MiB game CODE slot',async()=>{
 const saved=JSON.parse(await readFile(new URL('../dist/albot.package.json',import.meta.url),'utf8'));
 const cfg=JSON.parse(await readFile(new URL('../profiles/full-solo.json',import.meta.url),'utf8')).config;
 const code='/* ALBot '+saved.runtime.version+' test */\n'+
  '/*'+'x'.repeat(SLOT_LIMIT)+'*/\nvoid 0;';
 const runtime={...saved.runtime,code,sha256:createHash('sha256').update(code).digest('hex')};
 assert.throws(()=>exportBundle(saved.descriptor,cfg,runtime),/Bot inklusive Einstellungen zu groß/);
});

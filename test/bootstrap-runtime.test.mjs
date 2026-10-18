import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {Script,createContext,runInContext} from 'node:vm';
import {createBootstrap,personalPrefix} from '../scripts/bootstrap-support.mjs';

const prefix='// ALBot unit bootstrap\n'+'globalThis.ALBotConfig={"test":true};\n';
const runtime='/* ALBot 0.10.9-candidate */\nglobalThis.__BootSmoke=(globalThis.__BootSmoke??0)+1;\n';
const encode=x=>new TextEncoder().encode(x);
function contextFor(source,{payload=runtime,http=200,hasCrypto=true}={}){
 const calls=[];
 const ctx=createContext({
  TextDecoder,AbortController,setTimeout,clearTimeout,
  console:{error:()=>{}},
  crypto:hasCrypto?webcrypto:null,
  fetch:async(url,params)=>{
   calls.push({url,params});
   return {ok:http===200,status:http,arrayBuffer:async()=>encode(payload).buffer};
  }
 });
 runInContext(source,ctx,{timeout:2500});
 return {ctx,calls};
}
test('bootstrap pins complete UTF-8 runtime and leaves personal configuration intact',()=>{
 const made=createBootstrap({prefix,runtime});
 assert.equal(made.sha256,createHash('sha256').update(runtime).digest('hex'));
 assert.equal(made.runtimeBytes,encode(runtime).byteLength);
 assert.equal(made.code.startsWith(prefix),true);
 assert.ok(made.bootstrapBytes<65536);
 assert.doesNotThrow(()=>new Script(made.code));
 assert.equal(made.code.includes(runtime),false,'runtime must not be in the loader');
 assert.ok(made.code.includes(made.sha256));
});
test('bootstrap executes verified runtime exactly once and exposes status',async()=>{
 const made=createBootstrap({prefix,runtime});
 const {ctx,calls}=contextFor(made.code);
 assert.equal(ctx.ALBotConfig.test,true);
 assert.equal(ctx.__BootSmoke,undefined);
 assert.equal(await ctx.ALBotBootstrapReady,true);
 assert.equal(ctx.__BootSmoke,1);
 assert.equal(ctx.ALBotBootstrapStatus.phase,'launched');
 assert.equal(calls.length,1);
 assert.equal(calls[0].params.credentials,'omit');
 assert.equal(calls[0].params.cache,'no-store');
 assert.equal(calls[0].params.mode,'cors');
});
test('bootstrap hash mismatch aborts before executing untrusted content',async()=>{
 const made=createBootstrap({prefix,runtime});
 const {ctx,calls}=contextFor(made.code,{payload:runtime+'\nglobalThis.__Pwned=true;'});
 await assert.rejects(ctx.ALBotBootstrapReady,/SHA-256 mismatch/);
 await Promise.resolve();
 assert.equal(ctx.ALBotBootstrapStatus.phase,'blocked');
 assert.equal(ctx.__BootSmoke,undefined);
 assert.equal(ctx.__Pwned,undefined);
 assert.equal(calls.length,1,'no unsafe alternate network retry');
});
test('bootstrap requires HTTP success, WebCrypto and finite payload',async()=>{
 const made=createBootstrap({prefix,runtime});
 for(const params of [{http:404},{hasCrypto:false},{payload:''}]){
  const {ctx}=contextFor(made.code,params);
  await assert.rejects(ctx.ALBotBootstrapReady);
  await Promise.resolve();
  assert.equal(ctx.ALBotBootstrapStatus.phase,'blocked');
  assert.equal(ctx.__BootSmoke,undefined);
 }
});
test('bootstrap rejects non-HTTPS resources or unsafe personal boundaries',()=>{
 for(const url of ['http://example.com/bot.js',
  'https://u:p@example.com/bot.js','https://example.com/bot.js?next=1',
  'https://example.com/bot.js#frag'])
  assert.throws(()=>createBootstrap({prefix,runtime,url}),/HTTPS/);
 assert.throws(()=>createBootstrap({prefix,runtime:'garbage'}),/runtime/);
 assert.throws(()=>personalPrefix('globalThis.ALBotConfig={};'),/boundary/);
 assert.throws(()=>personalPrefix('// ALBot foo\n'+
   'globalThis.ALBotConfig={};\n/* ALBot 0 */'),/boundary/);
});
test('bootstrap supports legitimate user prefix extracted from code',()=>{
 const current='// ALBot candidate\n'+'globalThis.ALBotConfig={x:7};\n'+runtime;
 assert.equal(personalPrefix(current),'// ALBot candidate\n'+
  'globalThis.ALBotConfig={x:7};\n');
});

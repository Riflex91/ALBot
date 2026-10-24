import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {auditPublicAssets} from '../scripts/verify-public-assets.mjs';

async function fixture(entries,run){
 const dir=await mkdtemp(join(tmpdir(),'albot-static-audit-'));
 try{
  for(const [name,data] of Object.entries(entries)){
   const path=join(dir,name);await mkdir(join(path,'..'),{recursive:true});
   await writeFile(path,data);
  }
  return await run(dir);
 }finally{await rm(dir,{force:true,recursive:true});}
}
test('checked-in Cloudflare public assets have no private-profile or secret artifacts',async()=>{
 const dir=fileURLToPath(new URL('../public/',import.meta.url));
 assert.deepEqual(await auditPublicAssets(dir),[]);
});
test('audit accepts normal HTML, browser modules and public content',async()=>{
 await fixture({'index.html':'<!doctype html><title>safe</title>',
  'config-sync.mjs':'export const key="public verification only";',
  'css/app.css':'body{color:black}', 'config.json':'{"enabled":true}'},
 async dir=>assert.deepEqual(await auditPublicAssets(dir),[]));
});
test('audit blocks private release files, profile JSON, source maps and hidden secrets',async()=>{
 await fixture({'albot/private-signed-release.json':'{}',
  'albot/profile.json':'{}',
  '.env.production':'GITHUB_TOKEN=secret',
  'bundle.js.map':'{}',
  'keys/p256-private.key':'secret'},
 async dir=>{
  const issues=await auditPublicAssets(dir);
  assert.equal(issues.length,5);
  assert.ok(issues.every(x=>/non-public/.test(x)),JSON.stringify(issues));
 });
});
test('audit blocks private-key and GitHub/telemetry credential patterns in JS assets',async()=>{
 const files={
  'private.html':'-----BEGIN PRIVATE KEY-----\\nMIIB\\n-----END PRIVATE KEY-----',
  'token.mjs':'const token="github_pat_'+ 'A'.repeat(30)+'";',
  'config.js':'const config={"INGEST_TOKEN":"'+ 'T'.repeat(32)+'"};',
  'jwk.json':JSON.stringify({kty:'EC',crv:'P-256',x:'X'.repeat(43),
   y:'Y'.repeat(43),d:'D'.repeat(43)})
 };
 await fixture(files,async dir=>{
  const issues=await auditPublicAssets(dir);
  assert.equal(issues.length,4,JSON.stringify(issues));
  assert.ok(issues.every(x=>/material pattern/.test(x)),JSON.stringify(issues));
 });
});

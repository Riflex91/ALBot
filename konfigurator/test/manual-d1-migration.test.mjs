import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CANONICAL_SIGNED_HIGHWATER_DDL,verifySignedHighwaterMigration}
 from '../scripts/verify-d1-migration.mjs';

const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const migration=await read('../migrations/001_signed_config_highwater.sql');
const schema=await read('../schema.sql');
const wrangler=await read('../wrangler.toml');
const workflow=await read('../../.github/workflows/manual-konfigurator-d1-highwater.yml');
const deploy=await read('../../.github/workflows/deploy-konfigurator.yml');

test('separate D1 migration is canonical, additive and pinned to existing free-tier database',()=>{
 const r=verifySignedHighwaterMigration({migration,schema,wrangler});
 assert.deepEqual(r,{checked:true,database:'albot-konfigurator',
  table:'signed_config_highwater',scope:'additive-only',applied:false});
 assert.equal(migration.replace(/--[^\n]*/g,'').trim(),CANONICAL_SIGNED_HIGHWATER_DDL);
 assert.equal(migration.match(/\bCREATE TABLE\b/g)?.length,1);
 assert.doesNotMatch(migration,/\b(DROP|DELETE|UPDATE|INSERT|ALTER|REPLACE|TRUNCATE)\b/i);
});

test('schema guard rejects extra SQL, destructive commands, renamed table and other DB targets',()=>{
 for(const changed of [
  migration+'\nDROP TABLE character_snapshots;',
  migration+'\nINSERT INTO character_snapshots VALUES (1);',
  migration.replace('CREATE TABLE IF NOT EXISTS','CREATE TABLE'),
  migration.replace('signed_config_highwater','character_snapshots'),
  migration.replace('CHECK(sequence > 0)','CHECK(sequence >= 0)'),
  migration.replace('PRIMARY KEY NOT NULL','NOT NULL'),
  migration.replace(');','), extra TEXT);')
 ]){
  assert.throws(()=>verifySignedHighwaterMigration({
   migration:changed,schema,wrangler}),/unexpected or destructive/);
 }
 assert.throws(()=>verifySignedHighwaterMigration({
  migration,schema:schema.replace('signed_config_highwater','wrong_table'),
  wrangler}),/differs/);
 for(const drift of [
  wrangler.replace('database_name = "albot-konfigurator"','database_name = "production-other"'),
  wrangler.replace('binding = "DB"','binding = "OTHER"'),
  wrangler.replace('880c96b9-f6c5-4167-bfe2-6d6d0c55edf2','00000000-0000-0000-0000-000000000000')
 ])assert.throws(()=>verifySignedHighwaterMigration({
  migration,schema,wrangler:drift}),/target or DB binding drifted/);
});

test('workflow is manually dispatched only, refuses stale main SHA and wrong D1 name',()=>{
 assert.match(workflow,/workflow_dispatch:/);
 assert.doesNotMatch(workflow,/^\s{2}push:|^\s{2}pull_request:|schedule:/m);
 assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
 assert.match(workflow,/github\.repository == 'Riflex91\/ALBot'/);
 assert.match(workflow,/test "\$REQUESTED_SHA" = "\$GITHUB_SHA"/);
 assert.match(workflow,/test "\$REQUESTED_DB" = 'albot-konfigurator'/);
 assert.match(workflow,/verify-d1-migration\.mjs/);
 assert.match(workflow,/options:\s*\n\s*- inspect\s*\n\s*- migrate/);
 assert.match(workflow,/default: inspect/);
 assert.match(workflow,/if: inputs\.operation == 'migrate'/);
});

test('maintenance serializes against normal deploy and touches no secrets or telemetry D1 data',()=>{
 assert.match(workflow,/group: albot-konfigurator-cloudflare-production/);
 assert.match(deploy,/group: albot-konfigurator-cloudflare-production/);
 assert.match(workflow,/cancel-in-progress: false/);
 assert.match(workflow,/secrets\.CLOUDFLARE_API_TOKEN/);
 assert.match(workflow,/secrets\.CLOUDFLARE_ACCOUNT_ID/);
 assert.match(workflow,/workingDirectory: konfigurator/);
 assert.match(workflow,/command: d1 execute albot-konfigurator --remote --file=\.\/migrations\/001_signed_config_highwater\.sql/);
 assert.match(workflow,/SELECT target,key_id,sequence,sha256,release_sha,updated_at FROM signed_config_highwater LIMIT 0/);
 assert.doesNotMatch(workflow,/command: deploy|secret put|DROP TABLE|DELETE FROM|--force/);
 assert.doesNotMatch(deploy,/d1 execute|signed_config_highwater\.sql/);
 assert.equal((workflow.match(/command: d1 execute albot-konfigurator --remote/g)??[]).length,3);
});

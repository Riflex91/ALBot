import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(path,import.meta.url),'utf8');

test('production Cloudflare deploy is gated by both credentials and Linux/Windows CI',async()=>{
 const workflow=await read('../../.github/workflows/deploy-konfigurator.yml');
 assert.match(workflow,/branches:\s*\n\s*- main/);
 assert.match(workflow,/workflow_dispatch:/);
 assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
 assert.match(workflow,/secrets\.CLOUDFLARE_API_TOKEN/);
 assert.match(workflow,/secrets\.CLOUDFLARE_ACCOUNT_ID/);
 assert.match(workflow,/configured=false/);
 assert.match(workflow,/needs\.preflight\.outputs\.configured == 'true'/);
 assert.match(workflow,/needs\.linux-verification\.result == 'success'/);
 assert.match(workflow,/needs\.windows-verification\.result == 'success'/);
 assert.match(workflow,/cloudflare\/wrangler-action@v4/);
 assert.match(workflow,/workingDirectory: konfigurator/);
 assert.match(workflow,/command: deploy/);
 assert.match(workflow,/npm run build:konfigurator/);
 assert.match(workflow,/scripts\/VERIFY-U01-U07\.ps1/);
 // Audited in Linux, Windows and again after rebuilding the deploy bytes.
 assert.equal(workflow.split('node konfigurator/scripts/verify-public-assets.mjs').length-1,3);
 assert.doesNotMatch(workflow,/wrangler d1 execute|wrangler secret (put|delete)|wrangler delete|--force|npm audit fix/);
});

test('existing Access settings, D1 binding and restricted Free worker are preserved',async()=>{
 const config=await read('../wrangler.toml');
 const workflow=await read('../../.github/workflows/deploy-konfigurator.yml');
 assert.match(config,/name = "albot-konfigurator"/);
 assert.match(config,/keep_vars = true/);
 assert.match(config,/binding = "DB"/);
 assert.match(config,/run_worker_first = true/);
 assert.match(workflow,/cancel-in-progress: false/);
 assert.match(workflow,/existing Worker and D1 binding only/);
});

test('both PR verification and guarded production publish invoke static asset audit',async()=>{
 const pr=await read('../../.github/workflows/verify-albot.yml');
 const deploy=await read('../../.github/workflows/deploy-konfigurator.yml');
 assert.match(pr,/npm run build:konfigurator[\s\S]*node konfigurator\/scripts\/verify-public-assets\.mjs/);
 assert.match(deploy,/name: Publish existing Worker and D1 binding only/);
 assert.match(deploy,/name: Fail closed on private credentials or profiles in static assets/);
});

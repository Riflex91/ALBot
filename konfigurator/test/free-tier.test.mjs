import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DASHBOARD_REFRESH_MS,TELEMETRY_MIN_INTERVAL_MS,SNAPSHOT_FRESH_MS,
 SOFT_WORKER_REQUEST_BUDGET_PER_DAY,MAX_PLANNED_CHARACTERS,
 MAX_PLANNED_BANK_PACKS_PER_CYCLE,projectedDailyRequests} from '../public/free-tier.mjs';

test('Free-only dashboard and telemetry cadence have a conservative per-day budget',()=>{
 assert.ok(DASHBOARD_REFRESH_MS>=60_000);
 assert.ok(TELEMETRY_MIN_INTERVAL_MS>=120_000);
 assert.ok(SNAPSHOT_FRESH_MS>=2*TELEMETRY_MIN_INTERVAL_MS);
 assert.ok(projectedDailyRequests({characters:MAX_PLANNED_CHARACTERS,
  dashboards:1,bankPacksPerCycle:MAX_PLANNED_BANK_PACKS_PER_CYCLE})<=SOFT_WORKER_REQUEST_BUDGET_PER_DAY);
 assert.ok(projectedDailyRequests({characters:12,dashboards:1,bankPacksPerCycle:1})<100_000);
 assert.throws(()=>projectedDailyRequests({characters:-1}));
});
test('dashboard uses shared free-tier cadence and avoids overlapping requests',async()=>{
 const content=await readFile(new URL('../public/app.mjs',import.meta.url),'utf8');
 assert.match(content,/setInterval\(refreshLive,DASHBOARD_REFRESH_MS\)/);
 assert.match(content,/Date\.now\(\)-t<SNAPSHOT_FRESH_MS/);
 assert.match(content,/if\(document\.visibilityState==='hidden'\|\|refreshingLive\)return/);
});

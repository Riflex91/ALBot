// Free-only operational contract for the public ALBot dashboard.
// Cloudflare itself enforces its Workers/D1 Free-plan limits. These conservative
// app cadences are NOT a global quota or a substitute for checking account billing.
export const DASHBOARD_REFRESH_MS=60_000;
export const TELEMETRY_MIN_INTERVAL_MS=120_000;
export const SNAPSHOT_FRESH_MS=300_000;
export const SOFT_WORKER_REQUEST_BUDGET_PER_DAY=20_000;
export const MAX_PLANNED_CHARACTERS=12;
export const MAX_PLANNED_BANK_PACKS_PER_CYCLE=1;
const DAY_MS=24*60*60*1000;
export function projectedDailyRequests({characters=0,dashboards=1,bankPacksPerCycle=0}={}){
 const amounts=[characters,dashboards,bankPacksPerCycle];
 if(amounts.some(x=>!Number.isSafeInteger(x)||x<0))throw Error('Ungültige Free-Tier-Kalkulation');
 return Math.ceil(DAY_MS/DASHBOARD_REFRESH_MS)*dashboards*2+
  Math.ceil(DAY_MS/TELEMETRY_MIN_INTERVAL_MS)*(characters+bankPacksPerCycle);
}

import {TELEMETRY_MIN_INTERVAL_MS} from '../public/free-tier.mjs';

// Cloudflare Free-only: bounded D1 tables and atomic, database-side write throttles.
// Capping writes in application JS would race across Workers. These SQL predicates
// execute with each insert/upsert; rejection does not write to D1.
// This limits writes/storage, NOT incoming Worker requests across the account.
export const MAX_STORED_CHARACTERS=12;
export const MAX_STORED_BANK_PACKS=24;
export const SNAPSHOT_READ_TTL_MS=7*24*60*60*1000;
const CHARACTER_UPSERT=`INSERT INTO character_snapshots (name,updated_at,realm,map,payload)
 SELECT ?,?,?,?,?
 WHERE (SELECT COUNT(*) FROM character_snapshots) < ?
    OR EXISTS (SELECT 1 FROM character_snapshots WHERE name=?)
 ON CONFLICT(name) DO UPDATE SET
  updated_at=excluded.updated_at,realm=excluded.realm,
  map=excluded.map,payload=excluded.payload
 WHERE excluded.updated_at-character_snapshots.updated_at >= ?`;
const BANK_UPSERT=`INSERT INTO bank_snapshots (key,updated_at,realm,map,payload)
 SELECT ?,?,?,?,?
 WHERE (SELECT COALESCE(MAX(updated_at),0) FROM bank_snapshots) <= ?
 AND ((SELECT COUNT(*) FROM bank_snapshots) < ?
      OR EXISTS (SELECT 1 FROM bank_snapshots WHERE key=?))
 ON CONFLICT(key) DO UPDATE SET
  updated_at=excluded.updated_at,realm=excluded.realm,
  map=excluded.map,payload=excluded.payload
 WHERE (SELECT COALESCE(MAX(updated_at),0) FROM bank_snapshots) <= ?`;

export async function storeTelemetry(db,kind,value,now=Date.now()){
 if(!db||!Number.isSafeInteger(now)||now<TELEMETRY_MIN_INTERVAL_MS)
  throw Error('Invalid D1 telemetry request');
 const cutoff=now-TELEMETRY_MIN_INTERVAL_MS;
 let statement;
 if(kind==='character'){
  statement=db.prepare(CHARACTER_UPSERT).bind(
   value.name,now,value.realm,value.map,JSON.stringify(value),
   MAX_STORED_CHARACTERS,value.name,TELEMETRY_MIN_INTERVAL_MS);
 }else if(kind==='bank'){
  // The bank is account-wide across Adventure Land realms. Each pack has
  // exactly one canonical key in this single-user Cloudflare installation.
  // Keep realm as the provenance of the latest observation, not identity.
  // Legacy realm:pack rows remain untouched for non-destructive migration.
  const key=value.pack;
  statement=db.prepare(BANK_UPSERT).bind(
   key,now,value.realm,value.map,JSON.stringify(value),
   cutoff,MAX_STORED_BANK_PACKS,key,cutoff);
 }else throw Error('Unknown snapshot kind');
 const result=await statement.run();
 // D1 run() reports meta.changes. Fail closed if a provider/mock returns
 // no observable write result; never misreport a blocked update as accepted.
 if(!Number.isSafeInteger(result?.meta?.changes)||result.meta.changes<0)
  throw Error('D1 write confirmation unavailable');
 return {stored:result.meta.changes===1,retryAfterSeconds:TELEMETRY_MIN_INTERVAL_MS/1000};
}

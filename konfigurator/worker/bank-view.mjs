// Bank is account-wide. Realm is the observation source, not a distinct
// inventory. Keep D1 history unchanged, but display only the most recent
// independently observed snapshot of each bank pack across all realms.
// Do NOT combine slots from different snapshots or infer unobserved packs.
export function latestBankPackViews(rows){
 if(!Array.isArray(rows))return [];
 const mostRecent=new Map();
 for(const row of rows){
  if(!row||typeof row!=='object'||typeof row.pack!=='string'||
     !/^items\d{1,2}$/.test(row.pack)||
     !Number.isSafeInteger(row.observedAt)||row.observedAt<0)continue;
  const previous=mostRecent.get(row.pack);
  if(!previous||row.observedAt>previous.observedAt)
   mostRecent.set(row.pack,row);
 }
 return [...mostRecent.values()].sort((a,b)=>b.observedAt-a.observedAt);
}

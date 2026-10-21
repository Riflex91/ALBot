import {SNAPSHOT_FRESH_MS} from './free-tier.mjs';

// Conservative read-only view of D1 observations. A fresh observation is not
// evidence of an active game connection or of complete account-wide bank stock.
export function telemetrySummary({characters=[],bank=[],errors={},now=Date.now()}={}){
 const summarize=(rows,error)=>{
  const available=!error;
  const records=available&&Array.isArray(rows)?rows:[];
  const times=records.map(row=>row?.observedAt)
   .filter(at=>Number.isSafeInteger(at)&&at>=0&&at<=now);
  const latest=times.length?Math.max(...times):null;
  const recent=times.filter(at=>now-at<SNAPSHOT_FRESH_MS).length;
  return {available,total:available?records.length:null,
   recent:available?recent:null,latest:available?latest:null};
 };
 return {
  characters:summarize(characters,errors.characters),
  bank:summarize(bank,errors.bank)
 };
}

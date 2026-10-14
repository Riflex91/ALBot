// Only observed monetary balances count. Missing peers/bank data never mean
// zero, and transfers cannot manufacture a drawdown or an inflated peak.
export function createAccountLossGuard(bot){
 const {p,cfg,me}=bot,owner=cfg.party.merchant,key='albot:account-loss:'+owner;
 const enabled=()=>cfg.merchant.budgetMode==='account-loss';
 let state=p.read(key)??{version:1,owner,blocked:false,balances:{},points:[]};
 if(state.version!==1||state.owner!==owner||!state.balances||!Array.isArray(state.points))state={version:1,owner,blocked:false,balances:{},points:[]};
 let lastSnapshot=null,lastSample=0,candidate=null,lastNote=0;
 const valid=n=>Number.isSafeInteger(n)&&n>=0;
 const windowMs=()=>cfg.merchant.accountLossWindowMs??900000;
 const fraction=()=>.85;
 function snapshot(){
  let rows;try{rows=p.call('get_characters');}catch{return {complete:false,reason:'own-roster-unavailable'};}
  if(!Array.isArray(rows)||!rows.length||rows.length>128)return {complete:false,reason:'own-roster-unavailable'};
  if(rows.some(r=>typeof r?.name!=='string'||!/^[A-Za-z0-9_]{1,80}$/.test(r.name)))return {complete:false,reason:'own-roster-malformed'};
  const names=[...new Set(rows.map(r=>r.name))].sort();if(!names.includes(owner))return {complete:false,reason:'owner-not-in-roster'};
  const now=Date.now(),hold=2*Math.max(15000,cfg.general.messageTtlMs??15000),values=[],missing=[];
  let bank=bot.bank?.goldEvidence?.()??null;
  for(const name of names){
   const r=rows.find(r=>r.name===name),local=name===me.name,h=local?null:bot.transport.fresh(name);
   const data=local?{goldBalance:p.c.gold,goldTransferPending:bot.gold?.reserved,goldTransferAt:bot.gold?.transferAt,journal:!!bot.journal||!!bot.bank?.pending,map:p.c.map}:h;
   if(data?.journal||data?.goldTransferPending||Number.isFinite(data?.goldTransferAt)&&data.goldTransferAt>0&&now-data.goldTransferAt<hold)return {complete:false,reason:'value-transfer-in-flight'};
   let value;
   if(local||h){value=data.goldBalance;if(valid(value))state.balances[name]={gold:value,at:now,source:'live-character'};
    if(h?.map?.startsWith('bank')&&valid(h.bankGoldBalance)&&Number.isFinite(h.received)&&(!bank||h.received>bank.at))bank={gold:h.bankGoldBalance,at:h.received,owner:name};
   }else if(r.online===false||r.online===0&&!r.server){
    value=state.balances[name]?.gold;
    if(!valid(value)&&valid(r.gold))value=r.gold;
    if(!valid(value))value=cfg.merchant.offlineGoldBalances?.find(x=>x.name===name)?.gold;
    if(valid(value))state.balances[name]={gold:value,at:state.balances[name]?.at??now,source:'verified-offline-balance'};
   }
   if(!valid(value)){missing.push(name);continue;}values.push(value);
  }
  if(missing.length)return {complete:false,reason:'character-gold-unknown',missing};
  if(!bank||!valid(bank.gold)||bank.at>now||now-bank.at>120000)return {complete:false,reason:'bank-gold-unknown'};
  let total=bank.gold;for(const value of values){if(!valid(total+value))return {complete:false,reason:'gold-overflow'};total+=value;}
  return {complete:true,total,cohort:names.join(','),bankAt:bank.at,at:now};
 }
 function persist(){return p.write(key,state);}
 function sample(force=false){
  if(!enabled())return;
  if(me.name!==owner){const g=bot.transport.fresh(owner)?.accountLossGuard;if(g?.blocked)state={...state,blocked:true,trip:g.trip};else if(g&&Number.isFinite(g.resetAt)&&g.resetAt>(state.trip?.at??0))state={...state,blocked:false,trip:null,resetAt:g.resetAt};return;}
  if(!force&&Date.now()-lastSample<2000)return;lastSample=Date.now();
  const s=snapshot();lastSnapshot=s;
  if(state.blocked)return;
  if(!s.complete){candidate=null;if(Date.now()-lastNote>60000){lastNote=Date.now();bot.event?.('account.gold-loss-unavailable',{reason:s.reason,missing:s.missing?.join(',')??''});}persist();return;}
  state.points=state.points.filter(x=>x&&valid(x.total)&&Number.isFinite(x.at)&&x.at<=s.at&&s.at-x.at<=windowMs()&&x.cohort===s.cohort).slice(-1802);
  const peak=Math.max(s.total,...state.points.map(x=>x.total));
  const lost=peak>0&&s.total<=peak*(1-fraction());
  if(lost&&candidate?.cohort===s.cohort&&s.at-candidate.at>=1000){
   state.blocked=true;state.trip={at:s.at,peak,current:s.total,drop:1-s.total/peak,windowMs:windowMs()};
   bot.event?.('account.gold-loss-tripped',state.trip);
  }else candidate=lost?{at:s.at,cohort:s.cohort}:null;
  state.points.push({at:s.at,total:s.total,cohort:s.cohort});persist();
 }
 function reset(){if(me.name!==owner||bot.running)throw Error('Goldverlustsperre nur am pausierten Merchant nach Kontoprüfung freigeben');const s=snapshot();if(!s.complete)throw Error('Gesamtes Accountgold noch nicht belegbar');
  const next={...state,blocked:false,trip:null,resetAt:Date.now(),points:[{at:s.at,total:s.total,cohort:s.cohort}]};if(!p.write(key,next))throw Error('Goldschutz konnte nicht gespeichert werden');state=next;candidate=null;bot.event?.('account.gold-loss-reset',{total:s.total});return true;}
 return {sample,reset,get blocked(){return enabled()&&state.blocked===true;},status:()=>({enabled:enabled(),blocked:enabled()&&state.blocked===true,threshold:.85,windowMs:windowMs(),snapshot:lastSnapshot,trip:state.trip??null,resetAt:state.resetAt??0})};
}

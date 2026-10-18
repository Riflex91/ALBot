// N14: observed, session-scoped mutation SLOT outcome comparison only.
// Never a claimed server "lucky slot" rule, never a dispatch/roll permission.
const MAX_ROWS=128,MAX_AGE=21600000;
const validSlot=n=>Number.isSafeInteger(n)&&n>=0&&n<100;
export function createLuckySlotEvidence(bot,{now=()=>Date.now()}={}){
 const rows=[];
 let realm=bot.p.realm(),session=bot.session;
 function current(){
  if(realm!==bot.p.realm()||session!==bot.session){
   realm=bot.p.realm();session=bot.session;rows.length=0;
  }
  const time=now();
  while(rows.length&&time-rows[0].at>MAX_AGE)rows.shift();
 }
 function record({kind,slot,fromLevel,toLevel,outcome,confirmed=false}={}){
  current();const time=now();
  if(!confirmed||!['upgrade','compound'].includes(kind)||
     !validSlot(slot)||!Number.isSafeInteger(fromLevel)||fromLevel<0||
     !Number.isSafeInteger(toLevel)||toLevel!==fromLevel+1||
     !['improved','server-reported-failure','unclassified'].includes(outcome)||
     !Number.isSafeInteger(time)||time<=0)return false;
  // "Unclassified" means a confirmed value effect, NOT a loss, nor a
  // randomly failed upgrade. No extra server calls or sample manufacturing.
  rows.push({kind,slot,fromLevel,outcome,at:time});
  if(rows.length>MAX_ROWS)rows.shift();
  return true;
 }
 function status(){
  current();
  const slots=new Map();
  for(const row of rows){
   const x=slots.get(row.slot)??{slot:row.slot,improved:0,
    serverReportedFailure:0,unclassified:0,samples:0};
   x.samples++;
   if(row.outcome==='improved')x.improved++;
   else if(row.outcome==='server-reported-failure')x.serverReportedFailure++;
   else x.unclassified++;
   slots.set(row.slot,x);
  }
  return {version:1,mode:'passive-receipts-only',authority:'none',
   executable:false,predictionAuthorized:false,
   session,realm,windowMs:MAX_AGE,
   observed:rows.length,slots:[...slots.values()].sort((a,b)=>a.slot-b.slot)
    .slice(0,50)};
 }
 return {record,status,close(){rows.length=0;}};
}

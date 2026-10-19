// Read-only, deterministic analysis of ALBot browser test-report JSON exports.
// A sampled idle period is NOT proof that a visible, attackable monster existed.
const observed = report => [...(report.events??[])].filter(e=>
  typeof e?.time==='string'&&Number.isFinite(Date.parse(e.time))).
  sort((a,b)=>Date.parse(a.time)-Date.parse(b.time)||(a.seq??0)-(b.seq??0));
const millis = e => Date.parse(e.time);
const signature = item => {
  if(typeof item==='string'){try{item=JSON.parse(item);}catch{return null;}}
  return item&&typeof item.name==='string'?
    [item.name,item.level??0,item.stat_type??'',item.p??'',item.title??''].join('|'):null;
};
const extract = e => {
  let details=e.details;
  if(typeof details==='string'){try{details=JSON.parse(details);}catch{details=null;}}
  return {at:millis(e),character:e.character,recipient:e.to??details?.to??null,
    sender:details?.from??null,id:details?.id??null,
    item:signature(e.item??details?.item),name:(()=>{
      let v=e.item??details?.item;
      if(typeof v==='string'){try{v=JSON.parse(v);}catch{return null;}}
      return v?.name??null;})()};
};
const category = reason => {
  if(/^(Suche Farmziel|Kein öffentlicher Spawn)/i.test(reason))return 'search';
  if(/^(Warte|Gruppe sammeln|Folge|Begleite|Gruppenblockade)/i.test(reason))return 'team';
  if(/^(Unterwegs|Gemeinsamer Plan)/i.test(reason))return 'travel';
  if(/^(Lagerdruck|Inventarreserve)/i.test(reason))return 'storage';
  if(/^(Erholung|Rückzug|Tot)/i.test(reason))return 'recovery';
  if(/^(Kampf|Sichere Gruppenhilfe|Gruppenkampf)/i.test(reason))return 'combat';
  return 'other';
};
function idlePeriods(events,minSeconds){
  const samples=events.filter(x=>x.type==='sample'&&x.running&&x.task==='farm');
  const attacks=events.filter(x=>x.type==='action.start'&&
    (x.key==='attack'||/^skill:(3shot|5shot|cburst|stomp)$/i.test(x.key??''))).map(millis);
  const spans=[];let active=null;
  const flush=()=>{if(active&&active.seconds>=minSeconds)spans.push(active);active=null;};
  for(let i=1;i<samples.length;i++){
    const left=samples[i-1],right=samples[i],a=millis(left),b=millis(right),
      seconds=(b-a)/1000,kind=category(left.reason??'');
    if(seconds<=0||seconds>16||kind==='combat'||left.target||left.rip||
       left.inventoryBlocked||left.valueActionPending||attacks.some(t=>t>=a&&t<b)){
      flush();continue;
    }
    if(!active||active.kind!==kind||active.end!==left.time){flush();
      active={kind,reason:left.reason??'',start:left.time,end:right.time,seconds:0};}
    active.end=right.time;active.seconds+=seconds;
  }
  flush();
  return spans.sort((a,b)=>b.seconds-a.seconds);
}
export function analyzeLiveTeam(input,{merchant='My_Merchant',minIdleSeconds=10,
  maxPursuitDepartures=12,maxSampledIdleSeconds=60,requireElixirs=false,
  strict=false,requiredFarmers=null,minOverlapSeconds=0}={}){
 if(!Number.isFinite(minOverlapSeconds)||minOverlapSeconds<0)
  throw Error('Invalid minimum shared observation duration');
 if(!Array.isArray(input)||!input.length)throw Error('At least one report is required');
 const reports=new Map(),realms=new Set(),versions=new Set();
 for(const r of input){
  if(!r||r.format!=='albot-test-report'||!r.character||
     !r.started||!r.exported||!Array.isArray(r.events)||typeof r.counts!=='object')
   throw Error('Invalid ALBot test-report');
  if(reports.has(r.character))throw Error('Duplicate report: '+r.character);
  reports.set(r.character,r);realms.add(r.realm);versions.add(r.version);
 }
 const issues=[];
 // Two individually healthy reports are not a team run when their capture
 // windows never overlap. Start/end metadata is not proof of active gameplay.
 const windows=[...reports.values()].map(r=>({
  start:Date.parse(r.started),end:Date.parse(r.exported)
 }));
 const validWindows=windows.every(w=>Number.isFinite(w.start)&&
  Number.isFinite(w.end)&&w.end>w.start);
 let sharedSeconds=0,sharedFrom=null,sharedUntil=null;
 if(!validWindows){
  issues.push({level:'error',code:'INVALID_OBSERVATION_WINDOW',
   detail:'A report has missing, invalid or non-increasing capture times'});
 }else{
  const from=Math.max(...windows.map(w=>w.start));
  const until=Math.min(...windows.map(w=>w.end));
  if(until<=from){
   issues.push({level:'error',code:'DISJOINT_OBSERVATION_WINDOWS',
    detail:'Character reports have no simultaneous capture interval'});
  }else{
   sharedSeconds=(until-from)/1000;
   sharedFrom=new Date(from).toISOString();
   sharedUntil=new Date(until).toISOString();
   if(sharedSeconds<minOverlapSeconds)
    issues.push({level:'error',code:'INSUFFICIENT_OBSERVATION_OVERLAP',
     detail:'Only '+sharedSeconds+' shared seconds (required '+minOverlapSeconds+')'});
  }
 }
 if(realms.size!==1||versions.size!==1)issues.push({level:'error',code:'MIXED_SESSIONS',
   detail:'Different realms or versions in supplied reports'});
 if(!reports.has(merchant))issues.push({level:'error',code:'MERCHANT_MISSING',
   detail:'No report for '+merchant});
 const farmerNames=[...reports.keys()].filter(n=>n!==merchant);
 if(Number.isSafeInteger(requiredFarmers)&&requiredFarmers>=0&&farmerNames.length!==requiredFarmers)
  issues.push({level:'error',code:'ROSTER_INCOMPLETE',detail:'Expected '+requiredFarmers+' farmer reports, got '+farmerNames.length});
 const events=new Map([...reports].map(([name,r])=>[name,observed(r)]));
 const all=[...events].flatMap(([character,rows])=>rows.map(e=>({...e,character})));
 const transfers=all.filter(e=>e.type==='inventory.intent'&&
   (e.kind==='send'||e.kind==='receive')).map(e=>({...extract(e),kind:e.kind}))
   .filter(t=>t.item).sort((a,b)=>a.at-b.at);
 const outbound=transfers.filter(t=>t.kind==='send'),
   inbound=transfers.filter(t=>t.kind==='receive');
 // Matching id+sender+recipient+item prevents accidental cross-session
 // correlation of two different items sharing a generated transfer id.
 const matched=outbound.filter(s=>inbound.some(r=>r.id&&s.id===r.id&&
   r.item===s.item&&r.character===s.recipient&&r.sender===s.character));
 const pingpong=[];
 for(const send of outbound){
  if(!send.recipient||!send.item)continue;
  const back=outbound.find(r=>r.character===send.recipient&&
    r.recipient===send.character&&r.item===send.item&&r.at>send.at&&
    r.at-send.at<=120000);
  if(back)pingpong.push({item:send.item,from:send.character,to:send.recipient,
    sentAt:new Date(send.at).toISOString(),returnedAt:new Date(back.at).toISOString(),
    seconds:Math.round((back.at-send.at)/1000)});
 }
 const pursuit=Object.fromEntries([...(events.get(merchant)??[]).filter(e=>
   e.type==='logistics.pursuit').reduce((map,e)=>{
   const name=e.peer??'unknown',row=map.get(name)??{depart:0,retarget:0,stop:0,other:0};
   if(Object.hasOwn(row,e.decision))row[e.decision]++;
   else row.other++;
   map.set(name,row);return map;
 },new Map())]);
 const departures=Object.values(pursuit).reduce((n,p)=>n+p.depart,0);
 const farmers=Object.fromEntries(farmerNames.map(name=>{
  const r=reports.get(name),rows=events.get(name),idle=idlePeriods(rows,minIdleSeconds);
  const slots=r.equipment?.slots??r.equipment?.equipment?.slots??{};
  const reported=(r.actionStats?.attack?.started??0)+
    (r.actionStats?.['skill:3shot']?.started??0)+
    (r.actionStats?.['skill:5shot']?.started??0);
  const totalIdle=idle.reduce((n,v)=>n+v.seconds,0);
  return [name,{attacksStarted:r.actionStats?.attack?.started??0,
   aoeStarted:(r.actionStats?.['skill:3shot']?.started??0)+
    (r.actionStats?.['skill:5shot']?.started??0),
   actionCount:reported,sampledIdleSeconds:Math.round(totalIdle),
   idleWindows:idle.slice(0,12),elixirEquipped:slots.elixir?.name??null,
   incompleteEvents:(r.dropped??0)>0||r.exportTrimmed===true,
   dropped:r.dropped??0,eventsRetained:rows.length,
   coverageStart:rows[0]?.time??null,coverageEnd:rows.at(-1)?.time??null}];
 }));
 const elixirs=matched.filter(t=>/^elixir/i.test(t.name??'')||t.name==='candypop');
 const merchantReport=reports.get(merchant);
 const carriedElixirs=(merchantReport?.inventory??[]).filter(i=>
   /^elixir/i.test(i.name??'')||i.name==='candypop').map(i=>({item:i.name,
   quantity:i.quantity??1}));
 if(pingpong.length)issues.push({level:'error',code:'TRANSFER_PINGPONG',
   detail:pingpong.length+' immediate opposite-direction sends detected'});
 if(departures>maxPursuitDepartures)issues.push({level:'warning',code:'MERCHANT_CHASE',
   detail:departures+' departures (limit '+maxPursuitDepartures+')'});
 for(const [name,entry] of Object.entries(farmers)){
  if(entry.sampledIdleSeconds>maxSampledIdleSeconds)
   issues.push({level:'warning',code:'FARM_IDLE',character:name,
    detail:entry.sampledIdleSeconds+' sampled idle seconds; monster availability unknown'});
  if(!entry.elixirEquipped&&requireElixirs)
   issues.push({level:'error',code:'MISSING_ELIXIR',character:name,detail:'No equipped elixir in export'});
 }
 if([...reports.values()].some(r=>(r.dropped??0)>0))
  issues.push({level:strict?'error':'info',code:'INCOMPLETE_EVENT_HISTORY',
   detail:'Ring-buffer drops: event-based evidence may omit earlier behavior'});
 return {
  schema:'albot-live-audit/1',realm:realms.size===1?[...realms][0]:null,
  version:versions.size===1?[...versions][0]:null,
  interval:{from:[...reports.values()].map(r=>r.started).sort()[0],
    until:[...reports.values()].map(r=>r.exported).sort().at(-1)},
  scope:{characters:[...reports.keys()],sampledIdleIsProofOfAvailableTargets:false,
   sharedObservation:{from:sharedFrom,until:sharedUntil,seconds:sharedSeconds,
    sufficient:validWindows&&sharedSeconds>0&&sharedSeconds>=minOverlapSeconds}},
  merchant:{name:merchant,pursuit,departures,carriedElixirs,
    outgoingItemIntents:outbound.filter(t=>t.character===merchant).length},
  transfers:{outgoingIntents:outbound.length,
    matchedIntents:matched.length,elixirMatched:elixirs.length,
    gearEquipEvents:all.filter(e=>e.type==='gear.equipped').length,
    pingpong:pingpong.slice(0,20)},
  farmers,issues,
  accepted:!issues.some(x=>x.level==='error'||strict&&x.level==='warning')
 };
}

// JSONL created by TestReport.queueWrite stores complete event rows plus
// periodic snapshots. The snapshot's dropped count reflects its RAM ring
// buffer, NOT lost on-disk lines: recompute gaps from sequence coverage.
export function parseLiveReport(text){
 if(typeof text!=='string'||!text.trim())throw Error('Empty live report');
 let parsed;
 try{parsed=JSON.parse(text);}catch{}
 if(parsed?.format==='albot-test-report')return parsed;
 if(parsed!==undefined)throw Error('Unrecognized JSON report');
 const records=text.trim().split(/\r?\n/).filter(Boolean).map((line,i)=>{
  try{return JSON.parse(line);}catch{throw Error('Invalid JSONL line '+(i+1));}
 });
 const snapshots=records.filter(x=>x.type==='snapshot'&&x.format==='albot-test-report');
 const latest=snapshots.at(-1);
 if(!latest)throw Error('JSONL contains no test-report snapshot');
 const session=records.find(x=>x.type==='session');
 const uniq=new Map();
 for(const e of records)if(e&&Number.isSafeInteger(e.seq)&&e.seq>0&&
   typeof e.type==='string'&&e.type!=='snapshot'&&e.type!=='session')
  uniq.set(e.seq,e);
 const events=[...uniq.values()].sort((a,b)=>a.seq-b.seq);
 const expected=Object.values(latest.counts??{}).reduce((n,v)=>
   n+(Number.isSafeInteger(v)&&v>=0?v:0),0);
 return {...latest,started:latest.started??session?.time,
   events,dropped:Math.max(0,expected-events.length),sourceFormat:'jsonl',
   exportTrimmed:false};
}

// Parts from one character must belong to the same session. Never merge
// distinct restarts, realms or versions into apparently continuous evidence.
export function joinLiveReportParts(reports){
 const groups=new Map();
 for(const report of reports){
  if(!report?.character)throw Error('Missing character in report part');
  const key=report.character;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(report);
 }
 return [...groups.values()].map(parts=>{
  if(parts.length===1)return parts[0];
  const first=parts[0];
  if(parts.some(p=>p.started!==first.started||p.realm!==first.realm||
      p.version!==first.version))
   throw Error('Cannot join separate sessions for '+first.character);
  const ordered=[...parts].sort((a,b)=>String(a.exported).localeCompare(String(b.exported)));
  const newest=ordered.at(-1),seq=new Map();
  for(const p of ordered)for(const e of p.events??[])
   if(Number.isSafeInteger(e?.seq)&&e.seq>0)seq.set(e.seq,e);
  const events=[...seq.values()].sort((a,b)=>a.seq-b.seq);
  const expected=Object.values(newest.counts??{}).reduce((n,v)=>
    n+(Number.isSafeInteger(v)&&v>=0?v:0),0);
  return {...newest,events,dropped:Math.max(0,expected-events.length),
    sourceFormat:'assembled'};
 });
}

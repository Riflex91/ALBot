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
  strict=false}={}){
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
 if(realms.size!==1||versions.size!==1)issues.push({level:'error',code:'MIXED_SESSIONS',
   detail:'Different realms or versions in supplied reports'});
 if(!reports.has(merchant))issues.push({level:'error',code:'MERCHANT_MISSING',
   detail:'No report for '+merchant});
 const farmerNames=[...reports.keys()].filter(n=>n!==merchant);
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
  issues.push({level:'info',code:'INCOMPLETE_EVENT_HISTORY',
   detail:'Ring-buffer drops: event-based evidence may omit earlier behavior'});
 return {
  schema:'albot-live-audit/1',realm:realms.size===1?[...realms][0]:null,
  version:versions.size===1?[...versions][0]:null,
  interval:{from:[...reports.values()].map(r=>r.started).sort()[0],
    until:[...reports.values()].map(r=>r.exported).sort().at(-1)},
  scope:{characters:[...reports.keys()],sampledIdleIsProofOfAvailableTargets:false},
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
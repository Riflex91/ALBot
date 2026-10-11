// Read-only live party/combat diagnostics for the in-game ALBot panel.
// Keep this deliberately independent of task scheduling and game action APIs.
function members(party){
 if(Array.isArray(party))return party.map(p=>typeof p==='string'?p:p?.name).filter(x=>typeof x==='string');
 if(party&&typeof party==='object')return Object.keys(party).filter(name=>typeof name==='string');
 return [];
}
export function createTeamCheck(bot,report={}){
 const {p,me}=bot,at=new Date().toISOString(),status=bot.transport.status();
 const peers=status.peers.map(peer=>({
  name:peer.name,seen:peer.seen,fresh:peer.fresh,ageMs:peer.ageMs,
  realm:peer.realm,running:peer.running,heartbeatReceived:peer.heartbeatReceived
 }));
 const selected=[...(bot.farmers??[])],partyActions=Object.fromEntries(
  Object.entries(report.actionStats??{}).filter(([key])=>key==='party'||key==='party.request'||key.startsWith('invite:'))
 );
 const attacks=report.actionStats?.attack??{};
 return {
  format:'albot-team-check',formatVersion:1,createdAt:at,version:report.version??null,
  character:me.name,realm:p.realm(),running:!!bot.running,reason:bot.reason,
  gameParty:p.c?.party??null,gamePartyMembers:members(p.parent?.party),
  teamLeader:bot.leader,selectedFarmers:selected,
  accountSelection:bot.account?.active?.()??null,
  peers,
  combat:{target:bot.target?.id??null,task:bot.task?.()??null,
   farmPlan:bot.teamPlan?.status?.()?.current?(({id,target,map,leader,expires})=>({id,target,map,leader,expires}))(bot.teamPlan.status().current):null,
   attacksStarted:attacks.started??0,attacksEnded:attacks.ended??0,attackResults:{...(attacks.results??{})}},
  partyActions,
  economy:{inventoryUsed:(p.c?.items??[]).filter(Boolean).length,inventoryFree:(p.c?.items??[]).filter(i=>!i).length,
   minFreeSlots:bot.cfg?.merchant?.minFreeSlots??null,autoDisposition:bot.cfg?.production?.autoDisposition===true,
   services:bot.services?.status?.()??null,production:bot.production?.status?.()??null,
   gearTargets:bot.gear?.status?.()?.filter(x=>me.role==='merchant'?x.state==='requested':x.character===me.name).slice(0,24)??[],
   logistics:bot.logistics?.stats?.()??null},
  transport:{heartbeatReceived:status.counters?.heartbeatReceived??0,sendFailed:status.counters?.sendFailed??0},
  warnings:report.counts?.['runtime.warning']??0,
  recentErrors:(report.incidents??[]).slice(-5).map(e=>({time:e.time,where:e.where,message:e.message})),
  inventoryBlocked:!!bot.inventoryBlocked,journal:bot.journal?{kind:bot.journal.kind??'unknown'}:null,pending:bot.exec?.pending?.size??0
 };
}
export function saveTeamCheck(p,check){
 if(p.headless)return null;
 try{
  const win=p.parent,doc=win?.document;
  if(!doc?.body||!win.URL?.createObjectURL||!win.Blob)throw Error('Browser-Download nicht verfügbar');
  const safe=String(check.character??'unknown').replace(/[^A-Za-z0-9_-]/g,'_');
  const filename='albot-teamcheck-'+safe+'-'+check.createdAt.replace(/[:.]/g,'-')+'.json';
  const url=win.URL.createObjectURL(new win.Blob([JSON.stringify(check,null,2)],{type:'application/json;charset=utf-8'}));
  const link=doc.createElement('a');link.href=url;link.download=filename;doc.body.append(link);link.click();link.remove();
  win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);
  return filename;
 }catch(e){p.log('Teamtest konnte nicht gespeichert werden: '+(e.message??e));return null;}
}

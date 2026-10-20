// W12/N12: Cave instance team coordination is a diagnostic-only safety
// boundary. It never grants a neutral pull, attack, spell or travel order.
const caveTeamRun=s=>typeof s==='string'&&/^[a-f0-9]{24}$/.test(s);
const caveTeamLabel=s=>typeof s==='string'&&s.length>0&&s.length<=100;
const caveTeamTime=n=>Number.isSafeInteger(n)&&n>0;
const caveTeamFinite=n=>Number.isFinite(n);
const caveTeamMap=/^zone_([a-f0-9]{24})_([0-7])$/;
const caveTeamBlocked=(reason,details={})=>({
 version:1,mode:'cave-team-observation',reason,ready:false,
 executable:false,canPull:false,canAttack:false,canMove:false,
 focus:null,...details
});
export function inCaveInstance(character){
 return !!character&&(
  typeof character.map==='string'&&caveTeamMap.test(character.map)||
  caveTeamRun(character.cave?.run)
 );
}
export function caveTeamCoordination({
 cave,lifecycle,name,character,realm,teamNames,
 peers,monsters=[],now=Date.now()
}={}){
 if(!caveTeamTime(now)||!caveTeamLabel(name)||!caveTeamLabel(realm))
  return caveTeamBlocked('invalid-identity-or-clock');
 const live=cave?.live,j=lifecycle?.journal;
 if(!live||!caveTeamRun(live.run)||!caveTeamTime(live.serverTime)||
    now<live.serverTime||now-live.serverTime>3000||
    cave.realm!==realm||live.map!==`zone_${live.run}_${live.floor}`||
    !character||character.name!==name||character.map!==live.map||
    (character.in!==undefined&&character.in!==live.map)||
    character.cave?.run!==live.run)
  return caveTeamBlocked('fresh-own-instance-required');
 const scope={run:live.run,floor:live.floor,map:live.map};
 if(lifecycle?.state!=='live-observed'||j?.phase!=='observed-run'||
    j.name!==name||j.realm!==realm||j.observed?.run!==live.run)
  return caveTeamBlocked('durable-current-run-required',scope);
 if(live.paused===true)
  return caveTeamBlocked('instance-paused',scope);
 const roster=live.roster;
 if(!Array.isArray(roster)||roster.length!==3||
    new Set(roster.map(m=>m?.name)).size!==3||
    !roster.some(m=>m.name===name)||
    roster.some(m=>!caveTeamLabel(m?.name)||m.left!==false||
     m.disconnected!==false))
  return caveTeamBlocked('complete-active-trio-required',scope);
 if(!Array.isArray(teamNames)||teamNames.length!==3||
    new Set(teamNames).size!==3||
    teamNames.some(n=>!roster.some(m=>m.name===n)))
  return caveTeamBlocked('configured-team-mismatch',scope);
 const memberEvidence=[];
 for(const n of teamNames){
  const m=n===name?character:peers?.[n];
  if(!m||n!==name&&(m.running!==true||m.realm!==realm||
      !caveTeamTime(m.received)||m.received>now||
      now-m.received>3000)||
     m.rip===true||!caveTeamFinite(m.hp)||!caveTeamFinite(m.max_hp)||
     m.max_hp<=0||m.hp/m.max_hp<.7||
     !caveTeamFinite(m.x)||!caveTeamFinite(m.y)||
     m.map!==live.map||(m.in!==undefined&&m.in!==live.map))
   return caveTeamBlocked('member-not-currently-ready',{...scope,member:n});
  memberEvidence.push({...m,name:n});
 }
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 for(let i=0;i<memberEvidence.length;i++)
  for(let k=i+1;k<memberEvidence.length;k++)
   if(distance(memberEvidence[i],memberEvidence[k])>180)
    return caveTeamBlocked('team-not-assembled',{
     ...scope,member:memberEvidence[k].name});
 const priests=memberEvidence.filter(m=>
  (m.ctype??m.class)==='priest');
 if(priests.length!==1)
  return caveTeamBlocked('priest-identity-unconfirmed',scope);
 const priest=priests[0];
 if(memberEvidence.some(m=>distance(m,priest)>140))
  return caveTeamBlocked('priest-out-of-support-range',scope);
 if(!Array.isArray(monsters))
  return caveTeamBlocked('monster-evidence-unavailable',scope);
 const names=new Set(teamNames);
 const engaged=monsters.filter(m=>m&&caveTeamLabel(m.id)&&
  m.hp>0&&!m.dead&&m.map===live.map&&
  (m.in===undefined||m.in===live.map)&&names.has(m.target)&&
  caveTeamFinite(m.x)&&caveTeamFinite(m.y));
 const hp=new Map(memberEvidence.map(m=>[m.name,m.hp/m.max_hp]));
 const target=engaged.sort((a,b)=>
  (a.target===priest.name?-1:0)-(b.target===priest.name?-1:0)||
  hp.get(a.target)-hp.get(b.target)||
  a.hp-b.hp||
  String(a.id).localeCompare(String(b.id)))[0]??null;
 // The focus is for diagnostic review only. We deliberately do not
 // authorize a pull, combat or path traversal in generated instances.
 return {...caveTeamBlocked(target?
  'engaged-target-for-manual-review':'assembled-no-engaged-threat',scope),
  ready:true,priest:priest.name,
  members:teamNames.slice(),maxSeparation:180,
  focus:target?{id:target.id,mtype:target.mtype??null,
   victim:target.target,alreadyEngaged:true}:null};
}
export function createCaveTeamCoordination(bot,{now=()=>Date.now()}={}){
 function status(){
  const character=bot.p?.c;
  if(!inCaveInstance(character))
   return caveTeamBlocked('not-in-cave');
  const names=bot.farmers??[];
  const peers=Object.fromEntries(names.filter(n=>n!==bot.me.name)
   .map(n=>[n,bot.transport?.fresh?.(n)]));
  return caveTeamCoordination({
   cave:bot.cave?.status?.()??null,
   lifecycle:bot.caveLifecycle?.status?.()??null,
   name:bot.me.name,character,realm:bot.p.realm(),
   teamNames:names,peers,monsters:bot.monsters?.()??[],now:now()
  });
 }
 return {status};
}

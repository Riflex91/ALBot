// W12/N12: cautious single-target Cave Priest heal. This is a
// distinct life-saving support path, NOT ordinary farm rotations.
// Re-evaluate the identical run, floor, roster, target and native heal
// capability immediately before the one game API call.
const caveHealFinite=n=>Number.isFinite(n);
const caveHealDeny=(reason,extra={})=>({
 version:1,mode:'cave-priest-single-heal',
 ready:false,canHeal:false,canMove:false,canAttack:false,
 canAoE:false,reason,...extra
});
export function cavePriestHealPreflight(bot,{now=Date.now(),hostChecks=true}={}){
 const p=bot?.p,c=p?.c;
 if(!bot?.running||bot?.me?.role!=='farmer'||c?.ctype!=='priest'||
    c.rip===true||bot.cfg?.party?.enabled!==true||
    bot.cfg?.party?.healing!==true||
    bot.cfg?.party?.waitForTeam!==true)
  return caveHealDeny('eligible-active-priest-required');
 if(bot.journal||bot.inventoryBlocked||bot.lifecycleChanging||
    bot.account?.rotationPending?.()||bot.bank?.pending||
    bot.logistics?.reserved||bot.gold?.reserved||
    bot.teamTravel?.blocked)
  return caveHealDeny('value-or-lifecycle-action-blocked');
 const team=bot.caveTeam?.healStatus?.();
 if(team?.ready!==true||!team.run||
    !Number.isSafeInteger(team.floor)||team.floor<0||
    team.map!==`zone_${team.run}_${team.floor}`||
    team.priest!==c.name||team.members?.length!==3)
  return caveHealDeny('verified-nearby-trio-required',{
   teamReason:team?.reason??'unavailable'});
 const scope={run:team.run,floor:team.floor,map:team.map};
 if(!Number.isSafeInteger(now)||now<=0||c.map!==team.map||
    (c.in!==undefined&&c.in!==team.map)||
    c.cave?.run!==team.run||
    !caveHealFinite(c.mp)||!caveHealFinite(c.max_mp)||
    c.mp<0||c.max_mp<=0)
  return caveHealDeny('current-priest-state-unverified',scope);
 const skill=p.G?.skills?.heal;
 const manaCost=skill?.mp??c.mp_cost;
 if(!caveHealFinite(manaCost)||manaCost<0||
    c.mp-manaCost<Math.max(0,c.max_mp*.1))
  return caveHealDeny('heal-mana-reserve-unavailable',scope);
 const candidates=[];
 for(const memberName of team.members){
  const visible=memberName===c.name?c:bot.entity?.(memberName);
  const heartbeat=memberName===c.name?c:bot.transport?.fresh?.(memberName);
  if(!visible||!heartbeat||visible.name!==memberName||
     visible.type==='monster'||visible.rip===true||
     visible.map!==team.map||
     (visible.in!==undefined&&visible.in!==team.map)||
     heartbeat.map!==team.map||
     (heartbeat.in!==undefined&&heartbeat.in!==team.map)||
     heartbeat.name!==memberName||
     (memberName!==c.name&&(
      heartbeat.running!==true||heartbeat.realm!==p.realm()||
      !Number.isSafeInteger(heartbeat.received)||
      heartbeat.received>now||now-heartbeat.received>3000))||
     !caveHealFinite(visible.hp)||!caveHealFinite(visible.max_hp)||
     visible.max_hp<=0||visible.hp<=0||
     visible.hp>visible.max_hp||
     !caveHealFinite(heartbeat.hp)||!caveHealFinite(heartbeat.max_hp)||
     heartbeat.max_hp<=0||heartbeat.hp<=0||
     !caveHealFinite(visible.x)||!caveHealFinite(visible.y)||
     Math.hypot(c.x-visible.x,c.y-visible.y)>140)
    continue;
  const missing=visible.max_hp-visible.hp;
  const fraction=visible.hp/visible.max_hp;
  // Avoid wasting heal on a healthy character. All current targets
  // must be demonstrably injured, not inferred from stale heartbeats.
  if(missing<1||fraction>.8)continue;
  candidates.push({name:memberName,entity:visible,fraction,missing});
 }
 candidates.sort((a,b)=>a.fraction-b.fraction||
  b.missing-a.missing||a.name.localeCompare(b.name));
 if(!candidates.length)
  return caveHealDeny('no-current-injured-in-range-member',scope);
 const pick=candidates[0];
 const chosen={...scope,targetName:pick.name,
  targetHp:pick.entity.hp,targetMaxHp:pick.entity.max_hp,
  targetFraction:pick.fraction};
 if(hostChecks){
  try{
   if(p.has?.('heal')!==true||p.has?.('can_heal')!==true||
      p.has?.('is_on_cooldown')!==true||
      p.call('can_heal',pick.entity)!==true||
      p.call('is_on_cooldown','heal')!==false)
    return caveHealDeny('native-heal-not-ready',chosen);
  }catch{
   return caveHealDeny('native-heal-capability-unavailable',chosen);
  }
 }
 return {...caveHealDeny('injured-teammate-heal-ready',chosen),
  ready:true,canHeal:true,target:pick.entity};
}
export function createCavePriestHealing(bot,{now=()=>Date.now()}={}){
 let attempts=0,last=null;
 const proof=hostChecks=>cavePriestHealPreflight(bot,{
  now:now(),hostChecks});
 function status(){
  const {target,...safe}=proof(false);
  return {...safe,attempts,last};
 }
 function tick(){
  const first=proof(true);
  if(!first.ready||typeof bot.exec?.run!=='function)return false;
  const {run,floor,targetName}=first;
  const guard=()=>{
   const p=proof(true);
   return p.ready===true&&p.run===run&&p.floor===floor&&
    p.targetName===targetName;
  };
  const invoke=()=>{
   const p=proof(true);
   if(p.ready!==true||p.run!==run||p.floor!==floor||
      p.targetName!==targetName)
    throw Error('Cave Priest heal proof changed before game call');
   // The exact freshly checked entity is used, never an obsolete
   // target captured from the scheduler's earlier frame.
   return bot.p.call('heal',p.target);
  };
  const accepted=bot.exec.run('cave.priest.heal',['attack','mana'],
   guard,invoke,{delay:400,timeout:7000,waitForObservation:true,
    observe:()=>{
     const current=proof(false);
     return current.run===run&&current.floor===floor&&
      (current.targetName===targetName&&
       current.targetHp>first.targetHp);
    }});
  if(accepted){
   attempts++;
   last={run,floor,targetName,at:now()};
   bot.event?.('cave.priest.healRequested',last);
  }
  return accepted;
 }
 return {status,tick};
}

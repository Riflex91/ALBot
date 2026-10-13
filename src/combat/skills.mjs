import {distance,samePlace,matches} from '../core/policy.mjs';
import {SUPPORTED_SKILLS} from '../config/live-a.mjs';
import {FULL_SKILLS} from '../config/full.mjs';
export function conditionActive(entity,id,now=Date.now()){const value=entity?.s?.[id]??entity?.status?.[id]??entity?.effects?.[id]??entity?.conditions?.[id];if(!value)return false;if(typeof value!=='object')return true;const end=value.expiresAt??value.expires??value.endsAt;const timestamp=typeof end==='number'?end:Date.parse(end??'');if(Number.isFinite(timestamp))return timestamp>now;return value.ms===undefined||value.ms>0;}
// AoE is a normal farmer capability. Limits on hostile targets, pulls,
// mana, PVP, weapons and cooldowns are still enforced in use().
export const aoePermitted=bot=>bot.me?.role==='farmer'||bot.cfg?.party?.aoe===true;
export function highestDpsFarmer(bot,allies){
 const selected=new Set(bot.farmers??[]);
 return (allies??[]).filter(a=>a&&selected.has(a.name)&&
   a.name!==bot.p.c.name&&!a.rip&&a.hp>0&&
   Number.isFinite(a.attack)&&a.attack>0&&
   Number.isFinite(a.mp)&&Number.isFinite(a.max_mp)&&a.max_mp>0)
   .sort((a,b)=>{
    const dps=x=>x.attack*(Number.isFinite(x.frequency)&&x.frequency>0?x.frequency:1);
    return dps(b)-dps(a)||a.name.localeCompare(b.name);
   })[0]??null;
}
export function createSkills(bot){
  const {p,cfg,exec}=bot,last=new Map(),failedUntil=new Map(),stats=new Map();
  const count=(id,kind)=>{const row=stats.get(id)??{ready:0,ruleBlocked:0,weaponBlocked:0,mpBlocked:0,targetBlocked:0,cooldownBlocked:0,started:0,confirmed:0,failed:0};row[kind]++;stats.set(id,row);};
  const diagnostics=()=>Object.fromEntries([...stats].map(([id,row])=>[id,{...row}]));
  const asArray=v=>Array.isArray(v)?v:v?[v]:[];
  function ready(id,target,reserve=.2,ignoreCooldown=false){
    const c=p.c,s=p.G.skills[id];if(!s||c.rip||c.s?.stunned||c.s?.silenced)return false;
    if(s.hostile&&(p.parent.is_pvp||p.G.maps[c.map]?.pvp)&&!cfg.farming.pvp)return false;
    if(asArray(s.class).length&&!asArray(s.class).includes(c.ctype)||c.level<(s.level??0))return false;
    if(!ignoreCooldown&&p.call('is_on_cooldown',id))return false;
    const cost=id==='burst'?c.mp:s.mp??(['attack','heal'].includes(id)?c.mp_cost??0:0);
    if(c.mp-cost<c.max_mp*reserve)return false;
    if(Object.entries(s.requirements??{}).some(([k,v])=>!Number.isFinite(c[k])||c[k]<v))return false;
    const weapons=['mainhand','offhand'].flatMap(k=>asArray(p.G.items[c.slots?.[k]?.name]?.wtype));
    if(s.wtype&&!asArray(s.wtype).some(w=>weapons.includes(w)))return false;
    const off=p.G.items[c.slots?.offhand?.name];if(s.offhand_type&&off?.type!==s.offhand_type&&off?.wtype!==s.offhand_type)return false;
    if(asArray(s.slot).some(v=>!Array.isArray(v)||c.slots?.[v[0]]?.name!==v[1]))return false;
    if(s.consume&&!bot.canConsumeImplicit(s.consume))return false;
    if(s.condition&&!s.toggle&&conditionActive(target??c,s.condition))return false;
    if(target&&s.hostile&&(target.immune===true||target.invincible||['entangle','stomp'].includes(id)&&Object.keys(target.s??{}).some(k=>p.G.conditions?.[k]?.immune)))return false;
    if(target){if(!samePlace(c,target)||(!target.rip&&target.hp<=0))return false;const range=s.range??((c.range??0)*(s.range_multiplier??1)+(s.range_bonus??0));if(distance(c,target)>range)return false;if(s.no_self&&target.name===c.name)return false;}
    return true;
  }
  function use(id,target,reserve=.2,every=800,maxTargets=cfg.party.aoeMaxTargets,explicit=false){
    const roles=bot.teamPlan?.roles(),role={heal:'heal',partyheal:'heal',revive:'heal',energize:'energize',rspeed:'speed',reflection:'protect',taunt:'aggro',agitate:'aggro',huntersmark:'mark'}[id];if(!explicit&&role){let owner=roles?.[role];if(bot.capabilities){if(!owner||!bot.capabilities.available(owner,id,target))owner=(bot.farmers??[]).filter(n=>bot.capabilities.available(n,id,target)).sort()[0];}if(owner&&owner!==p.c.name)return false;}
    if(['heal','partyheal'].includes(id)&&!cfg.party.healing)return false;
    if(id==='energize'&&!cfg.party.energize&&!(bot.me?.role==='farmer'&&p.c.ctype==='mage')||id==='revive'&&!cfg.party.revive)return false;
    if(['warcry','darkblessing','reflection','rspeed'].includes(id)&&!cfg.party.buffs)return false;
    if(!explicit&&!(id==='energize'&&bot.me?.role==='farmer'&&p.c.ctype==='mage')&&
        cfg.skills.some(r=>r.enabled&&r.skill===id&&(!r.character||r.character===p.c.name)&&(r.class==='auto'||r.class===p.c.ctype))){count(id,'ruleBlocked');return false;}
    if((last.get(id)??0)+every>Date.now()||(failedUntil.get(id)??0)>Date.now()||
      !(cfg.general.testLogging!==undefined?FULL_SKILLS:SUPPORTED_SKILLS).includes(id))return false;
    // Do not spend offensive mana on a normal-attack kill while the normal
    // attack is available. Explicit user skill rules remain authoritative.
    if(!explicit&&['supershot','quickstab','quickpunch','smash','piercingshot','arcane_needle','burst'].includes(id)&&
       target?.type==='monster'&&!p.G.monsters?.[target.mtype]?.boss&&
       Number.isFinite(target.hp)&&target.hp<=Math.max(1,p.c.attack??0)&&
       !p.call('is_on_cooldown','attack'))return false;
    const s=p.G.skills[id];if(!s)return false;const control=cfg.skills.find(r=>r.enabled&&r.skill===id&&(!r.character||r.character===p.c.name)&&(r.class==='auto'||r.class===p.c.ctype));
    let extra,argsTarget=target;
    const multi=['3shot','5shot','fanofknives','cleave','stomp'].includes(id);
    const aimed=['3shot','5shot'].includes(id);
    const visible=multi?bot.monsters().filter(e=>distance(p.c,e)<(s.range??p.c.range)-5):[];
    // Targeted skills can initiate a controlled encounter: a neutral mob is
    // allowed only if the team plan, danger checks and planner all approve it.
    // Untargeted AoE must account for EVERY visible mob inside its effect area.
    const eligible=e=>!!(e.target&&bot.teamNames.includes(e.target)&&bot.allowed(e));
    const limit=Math.min(id==='3shot'?3:id==='5shot'?5:Infinity,maxTargets,cfg.party.aoeMaxTargets,cfg.farming.maxAggro??Infinity);
    const engaged=visible.filter(eligible);
    const canPull=e=>!!(e&&!e.target&&bot.teamPlan?.target()&&e.mtype===bot.teamPlan.target()&&
      bot.teamPlan.wantsCombat?.()!==false&&bot.allowed(e)&&bot.strategy?.safeTarget?.(e.mtype,e)!==false);
    function extraAllowance(){
      const phase=bot.encounter?.status?.(),allEngaged=bot.monsters().filter(e=>e.target&&bot.teamNames.includes(e.target)).length;
      if(phase?.phase!=='BUILD')return 0;
      return Math.max(0,Math.min(limit-engaged.length,phase.capacity-allEngaged,
        (cfg.farming.maxAggro??1)-allEngaged));
    }
    const additional=Math.floor(extraAllowance());
    const candidates=aimed?[...engaged,...visible.filter(canPull).slice(0,additional)]:visible;
    const selected=multi?candidates.slice(0,limit):[];
    const neutralCount=selected.filter(e=>!e.target).length;
    if(multi){if(!aoePermitted(bot)||selected.length<(control?.minTargets??1)||
      (aimed?selected.some(e=>!eligible(e)&&!canPull(e)):
        (visible.length>limit||visible.some(e=>!eligible(e)&&!canPull(e))))||
      neutralCount>additional){count(id,'targetBlocked');return false;}
      argsTarget=aimed?selected:null;target=selected[0];}
    if(id==='energize'){extra=Math.floor(Math.min(target.max_mp-target.mp,p.c.mp-p.c.max_mp*reserve,200));if(extra<=0)return false;}
    let burstMana=0;if(id==='cburst'){const budget=Math.floor(Math.min(p.c.mp-p.c.max_mp*reserve-(s.mp??0),p.c.max_mp*(control?.manaBudget??1)));burstMana=Math.min(budget,Math.ceil((target?.hp??0)/Math.max(.001,s.ratio??.5)));if(!target||burstMana<=0)return false;argsTarget=[[target.id,burstMana]];}
    const consume=s.consume,prior=consume?bot.count(consume):0;
    if(s.hostile&&target&&target.type!=='monster')return false;
    if(s.target&&!target)return false;
    if(s.target==='player'&&target?.type==='monster')return false;
    const guard=()=>ready(id,target,reserve)&&(id!=='cburst'||p.c.mp-burstMana-(s.mp??0)>=p.c.max_mp*reserve)&&(!s.hostile||!target||bot.allowed(bot.entity(target.id)))&&(!multi||(selected.filter(e=>!e.target).length<=extraAllowance()&&selected.every(e=>{const live=bot.entity(e.id);return !!(live&&(e.target?eligible(live):canPull(live)));})));
    if(!guard()){
      const weapons=['mainhand','offhand'].flatMap(k=>asArray(p.G.items[p.c.slots?.[k]?.name]?.wtype));
      const cost=id==='burst'?p.c.mp:s.mp??0;
      count(id,s.wtype&&!asArray(s.wtype).some(w=>weapons.includes(w))||s.offhand_type&&p.G.items[p.c.slots?.offhand?.name]?.wtype!==s.offhand_type?'weaponBlocked':
        p.c.mp-cost<p.c.max_mp*reserve?'mpBlocked':target&&!bot.allowed?.(bot.entity(target.id))?'targetBlocked':p.call('is_on_cooldown',id)?'cooldownBlocked':'ruleBlocked');
      return false;
    }
    count(id,'ready');
    if(consume&&(bot.inventoryBlocked||bot.logistics.reserved))return false;
    const accepted=exec.run('skill:'+id,['mana',s.share==='attack'||id==='heal'?'attack':'skill',...(consume?['inventory']:[])],guard,()=>{
      count(id,'started');
      if(consume)bot.beginValue({kind:'consume',item:consume,before:prior});
      const invoked=id==='heal'?p.call('heal',target):p.call('use_skill',id,argsTarget,extra);
      if(!['3shot','5shot'].includes(id))return invoked;
      const noTarget=x=>['no_target','not_there'].includes(String(x?.reason??x?.message??''));
      const transient=()=>{bot.target=null;
        bot.event?.('skill.transient',{skill:id,reason:'Ziel während Ausführung verschwunden'});
        return {transient:'no_target'};};
      return Promise.resolve(invoked).then(v=>noTarget(v)?transient():v,
        err=>{if(noTarget(err))return transient();throw err;});
    },{delay:every,value:!!consume,observe:consume?()=>bot.count(consume)<prior:null,onSettle:(state,result)=>{if(consume)bot.endValue(state);if(result?.transient==='no_target'){count(id,'targetBlocked');return;}if(['returned','confirmed'].includes(state))count(id,'confirmed');else if(['rejected','timeout','unknown'].includes(state)){count(id,'failed');failedUntil.set(id,Date.now()+3000);}}});
    if(accepted){last.set(id,Date.now());bot.event?.('skill.decision',{skill:id,target:target?.name??target?.id??'self',reason:explicit?'Passende individuelle Skill-Regel':'Klassenrotation oder situationsabhängige Gruppenunterstützung',mana:burstMana||extra||s.mp||0,reserve});}return accepted;
  }
  function support(){
    if(!cfg.party.enabled)return false;
    const allies=bot.allies(),alive=allies.filter(e=>!e.rip),hurt=alive.slice().sort((a,b)=>a.hp/a.max_hp-b.hp/b.max_hp);
    if(p.c.ctype==='priest'){
      if(cfg.party.revive){const dead=allies.find(e=>e.rip);if(dead){if(dead.hp>=dead.max_hp&&use('revive',dead,.25))return true;if(dead.hp<dead.max_hp&&use('heal',dead,.1,300))return true;}}
      if(cfg.party.healing){if(hurt.filter(e=>e.hp/e.max_hp<.65).length>=2&&use('partyheal',null,.2,1000))return true;if(hurt[0]?.hp/hurt[0]?.max_hp<.85&&use('heal',hurt[0],.05,250))return true;}
    }
    if(p.c.ctype==='mage'){
      {
        // Serve the highest observable DPS farmer, not whichever ally happens
        // to have the lowest MP ratio. Keep feeding them during combat whenever
        // they have meaningful missing mana and are in casting range.
        const candidates=alive.filter(a=>bot.farmers?.includes(a.name)&&
          a.name!==p.c.name&&samePlace(p.c,a)&&
          distance(p.c,a)<=(p.G.skills?.energize?.range??0));
        const strongest=highestDpsFarmer(bot,candidates);
        // Refill the priority DPS farmer once at least 2% of maximum MP is missing.
        if(strongest&&(strongest.max_mp-strongest.mp)/strongest.max_mp>=.02&&
          use('energize',strongest,.4,250))return true;
       }
      if(cfg.party.buffs){const tank=alive.find(e=>e.ctype==='warrior');if(tank&&use('reflection',tank,.5,5000))return true;}
    }
    if(cfg.party.buffs&&p.c.ctype==='rogue')for(const a of alive)if(use('rspeed',a,.4,1500))return true;
    if(cfg.party.advancedSkills&&p.c.ctype==='paladin'){
      if(cfg.party.healing){const afflicted=alive.find(a=>a.name!==p.c.name&&Object.keys(a.s??{}).some(k=>p.G.conditions?.[k]?.cleansable));if(afflicted&&use('cleansing_light',afflicted,.3,2000))return true;}
      const threatened=alive.filter(a=>a.name!==p.c.name&&a.party===p.c.party&&a.hp/a.max_hp<.6&&!a.s?.guardians_oath&&bot.monsters().some(m=>m.target===a.name));
      const burden=bot.monsters().filter(m=>m.target===p.c.name||threatened.some(a=>m.target===a.name)).reduce((n,m)=>n+Math.max(0,m.attack??p.G.monsters[m.mtype]?.attack??0)*(m.frequency??1),0)*8;
      if(cfg.party.healing&&p.c.hp/p.c.max_hp>.8&&burden<(p.c.hp-p.c.max_hp*.6)&&!alive.some(a=>a.s?.guardians_oath?.f===p.c.name)&&threatened[0]&&use('guardians_oath',threatened[0],.4,3000))return true;
      if(cfg.party.buffs&&alive.length>1&&bot.monsters().some(m=>bot.teamNames.includes(m.target))&&use('beacon_of_resolve',null,.4,5000))return true;
    }
    return false;
  }
  function custom(target){for(const r of cfg.skills.filter(r=>r.enabled&&
     !(r.skill==='energize'&&bot.me?.role==='farmer'&&p.c.ctype==='mage')&&
     (!r.character||r.character===p.c.name)&&(r.class==='auto'||r.class===p.c.ctype)).sort((a,b)=>b.priority-a.priority)){
    const s=bot.measure(target);if(!matches(r.conditions,s))continue;
    const allies=bot.allies().filter(e=>!e.rip);const t=r.target==='enemy'?target:r.target==='self'?p.c:r.target==='leader'?bot.entity(bot.leader):allies.sort((a,b)=>r.target==='lowestHp'?a.hp/a.max_hp-b.hp/b.max_hp:a.mp/a.max_mp-b.mp/b.max_mp)[0];
    if(['heal','partyheal','hardshell','selfheal'].includes(r.skill)&&((t??p.c).hp/(t??p.c).max_hp>=(r.hpThreshold??.7)))continue;if(r.skill==='partyheal'&&allies.filter(a=>a.hp/a.max_hp<(r.hpThreshold??.7)).length<(r.minInjured??2))continue;if(!t&&p.G.skills[r.skill]?.target)continue;if(use(r.skill,t,r.minMp,r.everyMs,r.maxTargets,true))return true;
  }return false;}
  function rotation(t){
    const c=p.c,hp=c.hp/c.max_hp,long=t&&t.hp>c.attack*4;
    // Highest priority for an eligible AoE, while still honoring cooldown,
    // weapon, legal targets, mana cost and approved encounter capacity.
    if(t&&aoePermitted(bot)){
      const shotRange=(p.G.skills['5shot']?.range??c.range)-5;
      const phase=bot.encounter?.status?.();
      const engaged=bot.monsters().filter(m=>m.target&&bot.teamNames.includes(m.target)).length;
      const remaining=phase?.phase==='BUILD'?Math.max(0,Math.min(
        (phase.capacity??1)-engaged,(cfg.farming.maxAggro??1)-engaged)):0;
      const safe=bot.monsters().filter(m=>distance(c,m)<shotRange&&
        ((m.target&&bot.teamNames.includes(m.target)&&bot.allowed(m))||
        (!m.target&&remaining>0&&m.mtype===bot.teamPlan?.target()&&bot.allowed(m)&&
         bot.strategy?.safeTarget?.(m.mtype,m)!==false)));
      const safeCount=Math.min(cfg.party.aoeMaxTargets,engaged+Math.min(remaining,safe.filter(m=>!m.target).length));
      const ids=c.ctype==='ranger'?(safeCount>=4?['5shot','3shot']:['3shot']):({warrior:['stomp','cleave'],rogue:['fanofknives']}[c.ctype]??[]);
      for(const id of ids)if(use(id,t,0,600))return;
    }
    if(p.c.ctype==='mage'&&bot.me?.role==='farmer'?
      support()||custom(t):custom(t)||support())return;
    if(c.ctype==='paladin'&&hp<.7&&use('selfheal',null,.1,1200))return;
    if(c.ctype==='warrior'&&hp<.5&&use('hardshell',null,.1,10000))return;
    if(cfg.party.advancedSkills&&c.ctype==='paladin'){
      const magical=bot.monsters().some(m=>m.target===c.name&&p.G.monsters[m.mtype]?.damage_type==='magical');
      const shield=magical?(hp<.55&&c.mp/c.max_mp>.6?'mshield':hp>.8&&c.mp/c.max_mp<.5?'aether_shield':null):null;
      if(shield&&!c.s?.[shield]&&use(shield,null,0,3000))return;
      if(c.s?.mshield&&(!magical||c.mp/c.max_mp<.25)&&use('mshield',null,0,3000))return;
      if(c.s?.aether_shield&&(!magical||hp<.6)&&use('aether_shield',null,0,3000))return;
    }
    if(!t)return;
    if(cfg.party.advancedSkills&&c.ctype==='mage'&&long){if(use('cburst',t,.4,700))return;const ratio=p.G.skills.burst?.ratio;if(Number.isFinite(ratio)&&t.hp>=Math.max(1200,c.attack*4)&&t.hp<=c.mp*ratio&&c.mp/c.max_mp>=.75&&!bot.allies().some(a=>a.name!==c.name&&a.mp/a.max_mp<.5)&&use('burst',t,0,6000))return;}
    const choices={
      warrior:[[long&&cfg.party.buffs,'warcry',null,5000],[t.target&&t.target!==c.name&&bot.teamNames.includes(t.target),'taunt',t,1500],[distance(c,t)>c.range*1.4,'charge',null,10000]],
      ranger:[[long,'huntersmark',t,5000],[long,'poisonarrow',t,1500],[(t.armor??p.G.monsters[t.mtype]?.armor??0)>200,'piercingshot',t,700],[t.hp>c.attack*1.5,'supershot',t,1500]],
      mage:[[long&&t.attack>c.max_hp*.04,'entangle',t,5000],[long,'arcane_needle',t,700]],
      priest:[[long&&cfg.party.buffs,'darkblessing',null,5000],[long,'curse',t,3000],[hp<.3,'phaseout',null,5000]],
      rogue:[[t.hp>c.attack*1.5,'pcoat',null,5000],[t.hp>c.attack*1.5,'mentalburst',t,1500],[true,'quickstab',t,500],[true,'quickpunch',t,500]],
      paladin:[[long,'shield_slam',t,1000],[long,'purify',t,1200],[true,'smash',t,1000]]
    };
    for(const [ok,id,target,delay] of choices[c.ctype]??[])if(ok&&use(id,target,.3,delay))return;
  }
  return {ready,use,rotation,diagnostics};
}

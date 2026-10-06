import {distance,samePlace,matches} from '../core/policy.mjs';
import {SUPPORTED_SKILLS} from '../config/live-a.mjs';
export function createSkills(bot){
  const {p,cfg,exec}=bot,last=new Map();
  const asArray=v=>Array.isArray(v)?v:v?[v]:[];
  function ready(id,target,reserve=.2){
    const c=p.c,s=p.G.skills[id];if(!s||c.rip||c.s?.stunned||c.s?.silenced)return false;
    if(s.hostile&&(p.parent.is_pvp||p.G.maps[c.map]?.pvp))return false;
    if(asArray(s.class).length&&!asArray(s.class).includes(c.ctype)||c.level<(s.level??0))return false;
    if(p.call('is_on_cooldown',id))return false;
    const cost=s.mp??(['attack','heal'].includes(id)?c.mp_cost??0:0);
    if(c.mp-cost<c.max_mp*reserve)return false;
    if(Object.entries(s.requirements??{}).some(([k,v])=>!Number.isFinite(c[k])||c[k]<v))return false;
    const weapons=['mainhand','offhand'].flatMap(k=>asArray(p.G.items[c.slots?.[k]?.name]?.wtype));
    if(s.wtype&&!asArray(s.wtype).some(w=>weapons.includes(w)))return false;
    const off=p.G.items[c.slots?.offhand?.name];if(s.offhand_type&&off?.type!==s.offhand_type&&off?.wtype!==s.offhand_type)return false;
    if(asArray(s.slot).some(v=>!Array.isArray(v)||c.slots?.[v[0]]?.name!==v[1]))return false;
    if(s.consume&&!bot.canConsumeImplicit(s.consume))return false;
    if(s.condition&&(target??c).s?.[s.condition])return false;
    if(target){if(!samePlace(c,target)||(!target.rip&&target.hp<=0))return false;const range=s.range??((c.range??0)*(s.range_multiplier??1)+(s.range_bonus??0));if(distance(c,target)>range)return false;if(s.no_self&&target.name===c.name)return false;}
    return true;
  }
  function use(id,target,reserve=.2,every=800,maxTargets=cfg.party.aoeMaxTargets,explicit=false){
    if(['heal','partyheal'].includes(id)&&!cfg.party.healing)return false;
    if(id==='energize'&&!cfg.party.energize||id==='revive'&&!cfg.party.revive)return false;
    if(['warcry','darkblessing','reflection','rspeed'].includes(id)&&!cfg.party.buffs)return false;
    if(!explicit&&cfg.skills.some(r=>r.skill===id&&(!r.character||r.character===p.c.name)&&(r.class==='auto'||r.class===p.c.ctype)))return false;
    if((last.get(id)??0)+every>Date.now()||!SUPPORTED_SKILLS.includes(id))return false;
    const s=p.G.skills[id];if(!s)return false;
    let extra,argsTarget=target;
    const multi=['3shot','5shot','fanofknives','cleave','stomp'].includes(id);
    const candidates=multi?bot.monsters().filter(e=>distance(p.c,e)<(s.range??p.c.range)-5):[];
    if(multi){if(!cfg.party.aoe||candidates.length<2||candidates.length>Math.min(maxTargets,cfg.party.aoeMaxTargets)||candidates.some(e=>!bot.allowed(e)||!e.target||!bot.teamNames.includes(e.target)))return false;argsTarget=['cleave','stomp'].includes(id)?null:candidates.slice(0,id==='3shot'?3:5);target=candidates[0];}
    if(id==='energize'){extra=Math.floor(Math.min(target.max_mp-target.mp,p.c.mp-p.c.max_mp*reserve,200));if(extra<=0)return false;}
    const consume=s.consume,prior=consume?bot.count(consume):0;
    if(s.hostile&&target&&target.type!=='monster')return false;
    if(s.target&&!target)return false;
    if(s.target==='player'&&target?.type==='monster')return false;
    const guard=()=>ready(id,target,reserve)&&(!s.hostile||!target||bot.allowed(bot.entity(target.id)))&&(!multi||candidates.every(e=>bot.allowed(bot.entity(e.id))));
    if(!guard())return false;
    if(consume&&(bot.inventoryBlocked||bot.logistics.reserved))return false;
    const accepted=exec.run('skill:'+id,['mana',s.share==='attack'||id==='heal'?'attack':'skill',...(consume?['inventory']:[])],guard,()=>{
      if(consume)bot.beginValue({kind:'consume',item:consume,before:prior});
      return id==='heal'?p.call('heal',target):p.call('use_skill',id,argsTarget,extra);
    },{delay:every,value:!!consume,observe:consume?()=>bot.count(consume)<prior:null,onSettle:state=>{if(consume)bot.endValue(state);}});
    if(accepted)last.set(id,Date.now());return accepted;
  }
  function support(){
    if(!cfg.party.enabled)return false;
    const allies=bot.allies(),alive=allies.filter(e=>!e.rip),hurt=alive.slice().sort((a,b)=>a.hp/a.max_hp-b.hp/b.max_hp);
    if(p.c.ctype==='priest'){
      if(cfg.party.revive){const dead=allies.find(e=>e.rip);if(dead){if(dead.hp>=dead.max_hp&&use('revive',dead,.25))return true;if(dead.hp<dead.max_hp&&use('heal',dead,.1,300))return true;}}
      if(cfg.party.healing){if(hurt.filter(e=>e.hp/e.max_hp<.65).length>=2&&use('partyheal',null,.2,1000))return true;if(hurt[0]?.hp/hurt[0]?.max_hp<.85&&use('heal',hurt[0],.05,250))return true;}
    }
    if(p.c.ctype==='mage'){
      if(cfg.party.energize){const low=alive.filter(e=>e.name!==p.c.name&&e.mp/e.max_mp<.5).sort((a,b)=>a.mp/a.max_mp-b.mp/b.max_mp)[0];if(low&&use('energize',low,.4,1500))return true;}
      if(cfg.party.buffs){const tank=alive.find(e=>e.ctype==='warrior');if(tank&&use('reflection',tank,.5,5000))return true;}
    }
    if(cfg.party.buffs&&p.c.ctype==='rogue')for(const a of alive)if(use('rspeed',a,.4,1500))return true;
    return false;
  }
  function custom(target){for(const r of cfg.skills.filter(r=>r.enabled&&(!r.character||r.character===p.c.name)&&(r.class==='auto'||r.class===p.c.ctype)).sort((a,b)=>b.priority-a.priority)){
    const s=bot.measure(target);if(!matches(r.conditions,s))continue;
    const allies=bot.allies().filter(e=>!e.rip);const t=r.target==='enemy'?target:r.target==='self'?p.c:r.target==='leader'?bot.entity(bot.leader):allies.sort((a,b)=>r.target==='lowestHp'?a.hp/a.max_hp-b.hp/b.max_hp:a.mp/a.max_mp-b.mp/b.max_mp)[0];
    if(!t&&p.G.skills[r.skill]?.target)continue;if(use(r.skill,t,r.minMp,r.everyMs,r.maxTargets,true))return true;
  }return false;}
  function rotation(t){
    if(custom(t)||support())return;
    const c=p.c,hp=c.hp/c.max_hp,long=t&&t.hp>c.attack*4;
    if(c.ctype==='paladin'&&hp<.7&&use('selfheal',null,.1,1200))return;
    if(c.ctype==='warrior'&&hp<.5&&use('hardshell',null,.1,10000))return;
    if(!t)return;
    if(cfg.party.aoe)for(const id of ({ranger:['5shot','3shot'],warrior:['stomp','cleave'],rogue:['fanofknives']}[c.ctype]??[]))if(use(id,t,.35,600))return;
    const choices={
      warrior:[[long&&cfg.party.buffs,'warcry',null,5000],[t.target&&t.target!==c.name&&bot.teamNames.includes(t.target),'taunt',t,1500],[distance(c,t)>c.range*1.4,'charge',null,10000]],
      ranger:[[long,'huntersmark',t,5000],[long,'poisonarrow',t,1500],[(t.armor??p.G.monsters[t.mtype]?.armor??0)>200,'piercingshot',t,700],[t.hp>c.attack*1.5,'supershot',t,1500]],
      mage:[[long&&t.attack>c.max_hp*.04,'entangle',t,5000],[long,'arcane_needle',t,700]],
      priest:[[long&&cfg.party.buffs,'darkblessing',null,5000],[long,'curse',t,3000],[hp<.3,'phaseout',null,5000]],
      rogue:[[long,'pcoat',null,5000],[long,'mentalburst',t,1500],[true,'quickstab',t,500],[true,'quickpunch',t,500]],
      paladin:[[long,'shield_slam',t,1000],[long,'purify',t,1200],[true,'smash',t,1000]]
    };
    for(const [ok,id,target,delay] of choices[c.ctype]??[])if(ok&&use(id,target,.3,delay))return;
  }
  return {ready,use,rotation};
}

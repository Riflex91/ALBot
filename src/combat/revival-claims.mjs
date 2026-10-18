// A consumed Essence of Life may never be authorized twice for the same
// observed death. Missing replies or an absent entity are not a new death.
export function reviveDeathKey(bot,target){
 if(!target?.rip||typeof target.name!=='string'||!target.name)return null;
 const stamp=target.rip_time;
 const at=typeof stamp==='number'?stamp:Date.parse(stamp??'');
 if(Number.isFinite(at)&&at>0)return JSON.stringify([target.name,bot.p.realm(),'server',at]);
 const peer=bot.transport?.fresh?.(target.name),life=peer?.combatLife;
 if(peer?.realm===bot.p.realm()&&typeof peer.session==='string'&&
    life?.dead===true&&Number.isSafeInteger(life.generation)&&life.generation>0)
  return JSON.stringify([target.name,peer.realm,peer.session,life.generation]);
 // Conservative fallback survives reloads. Only observed ALIVE or a real
 // server/peer death generation can release this claim.
 return JSON.stringify([target.name,bot.p.realm(),'unversioned-observed-death']);
}
export function createRevivalClaims(bot){
 const storage='albot:revival-claims:'+bot.me.name;
 const saved=bot.p.read?.(storage);
 let claims=saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{};
 const valid=(saved==null||saved&&typeof saved==='object'&&!Array.isArray(saved))&&Object.keys(claims).length<=24&&Object.entries(claims).every(([name,row])=>
  name&&row&&typeof row.key==='string'&&row.key.length<=500&&
  Number.isFinite(row.at)&&row.at>0);
 let blocked=!valid;
 if(blocked)claims={};
 const persist=next=>bot.p.write?.(storage,next)===true;
 return {
  canCast(target,expected=reviveDeathKey(bot,target)){
   const key=reviveDeathKey(bot,target);
   return !blocked&&!!key&&key===expected&&!target.c?.revival&&
    !Object.hasOwn(claims,target.name) /* cleared by an observed alive state, never TTL */;
  },
  claim(target,expected){
   if(!this.canCast(target,expected))return false;
   const next={...claims,[target.name]:{key:expected,at:Date.now()}};
   if(Object.keys(next).length>24||!persist(next)){blocked=true;return false;}
   claims=next;return true;
  },
  observe(){
   let next=null;
   for(const name of Object.keys(claims)){
    const target=bot.entity?.(name);if(!target)continue;
    const key=reviveDeathKey(bot,target);
    // A differing trustworthy server/peer generation is a NEW death. An
    // unversioned fallback can only be cleared after actually seeing alive.
    const versioned=key&&!key.includes('unversioned-observed-death');
    if(!target.rip||versioned&&key!==claims[name].key){
     next??={...claims};delete next[name];
    }
   }
   if(next){if(persist(next))claims=next;else blocked=true;}
  },
  status:()=>({blocked,pending:Object.keys(claims)}),
 };
}

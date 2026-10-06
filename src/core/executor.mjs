// Bounded resource owners, no queued closures carrying obsolete inventory slots.
export class Executor {
  constructor({now,active,limit,onError}){Object.assign(this,{now,active,limit,onError});this.pending=new Map();this.generation=0;this.cooldowns=new Map();}
  busy(resource){return [...this.pending.values()].some(p=>p.resources.includes(resource));}
  run(key,resources,guard,invoke,{timeout=8000,delay=250,observe=null,value=false,onSettle=()=>{}}={}){
    if(!this.active()||this.pending.size>=this.limit||this.pending.has(key)||(this.cooldowns.get(key)||0)>this.now()||resources.some(r=>this.busy(r))||!guard())return false;
    const p={key,resources,generation:this.generation,deadline:this.now()+timeout,settled:false,observe,value,onSettle,delay};this.pending.set(key,p);
    try {Promise.resolve(invoke()).then(v=>{if(p.generation===this.generation){p.settled=true;p.result=v;p.error=v?.failed||v?.success===false?v:null;}},e=>{if(p.generation===this.generation){p.settled=true;p.error=e;}});}catch(e){p.settled=true;p.error=e;}
    return true;
  }
  poll(){
    const now=this.now();for(const [k,t] of this.cooldowns)if(t<=now)this.cooldowns.delete(k);
    for(const [key,p] of this.pending){
      let observed=false;try{observed=p.observe?.()===true;}catch{}
      if(observed||(!p.value&&p.settled)||now>=p.deadline){
        this.pending.delete(key);this.cooldowns.set(key,now+(p.error?3000:p.delay));
        const result=observed?'confirmed':p.value?'unknown':p.error?'rejected':p.settled?'returned':'timeout';
        p.onSettle(result,p.error??p.result);if(p.error||result==='timeout')this.onError(key,p.error??result);
      }
    }
  }
  cancelResource(resource){for(const [key,p] of this.pending)if(!p.value&&p.resources.includes(resource))this.pending.delete(key);}
  invalidate(){this.generation++;for(const p of this.pending.values())if(p.value)p.onSettle('unknown');this.pending.clear();}
}

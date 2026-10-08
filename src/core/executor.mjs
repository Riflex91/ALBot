// Bounded resource owners, no queued closures carrying obsolete inventory slots.
export class Executor {
  constructor({now,active,limit,onError,onEvent=()=>{}}){Object.assign(this,{now,active,limit,onError,onEvent});this.pending=new Map();this.generation=0;this.cooldowns=new Map();this.frame=null;this.waiting=new Map();}
  busy(resource){return [...this.pending.values()].some(p=>p.resources.includes(resource));}
  run(key,resources,guard,invoke,options={}){if(this.frame){if(!this.active()||this.frame.some(j=>j.key===key)||this.pending.has(key)||(this.cooldowns.get(key)||0)>this.now()||!guard())return false;if(!this.waiting.has(key))this.waiting.set(key,this.now());this.frame.push({key,resources,guard,invoke,options});return true;}return this.dispatch(key,resources,guard,invoke,options);}
  beginFrame(){this.frame=[];}
  flush(){const jobs=this.frame??[];this.frame=null;const rank=j=>j.options.priority??(/respawn|potion|regen/.test(j.key)?1000:/send|gold|partial|reclaim/.test(j.key)?800:/heal|reflection|revive|energize/.test(j.key)?700:/attack|skill|target/.test(j.key)?500:/town|move/.test(j.key)?400:/giveaway|merrit/.test(j.key)?10:200);jobs.sort((a,b)=>rank(b)-rank(a)||(this.waiting.get(a.key)??0)-(this.waiting.get(b.key)??0));for(const j of jobs){this.onEvent('action.selection',{key:j.key,priority:rank(j),reason:'Aktuelle Voraussetzungen, Wichtigkeit und Wartealter; Ressourcen nur einmal vergeben'});if(this.dispatch(j.key,j.resources,j.guard,j.invoke,j.options))this.waiting.delete(j.key);else if(!j.options.value)j.options.onSettle?.('superseded');}for(const key of this.waiting.keys())if(!jobs.some(j=>j.key===key))this.waiting.delete(key);}
  dispatch(key,resources,guard,invoke,{timeout=8000,delay=250,observe=null,value=false,waitForObservation=false,onSettle=()=>{}}={}){
    if(!this.active()||this.pending.size>=this.limit||this.pending.has(key)||(this.cooldowns.get(key)||0)>this.now()||resources.some(r=>this.busy(r))||!guard())return false;
    const p={key,resources,generation:this.generation,deadline:this.now()+timeout,settled:false,observe,value,waitForObservation,onSettle,delay};this.pending.set(key,p);
    this.onEvent('action.start',{key,resources:resources.join(','),value});
    try {Promise.resolve(invoke()).then(v=>{if(p.generation===this.generation){p.settled=true;p.result=v;p.error=v?.failed||v?.success===false?v:null;}},e=>{if(p.generation===this.generation){p.settled=true;p.error=e;}});}catch(e){p.settled=true;p.error=e;}
    return true;
  }
  poll(){
    const now=this.now();for(const [k,t] of this.cooldowns)if(t<=now)this.cooldowns.delete(k);
    for(const [key,p] of this.pending){
      let observed=false;try{observed=p.observe?.()===true;}catch{}
      if(observed||(!p.value&&p.settled&&(!p.waitForObservation||p.error))||now>=p.deadline){
        this.pending.delete(key);this.cooldowns.set(key,now+(p.error?3000:p.delay));
        const result=observed?'confirmed':p.value?'unknown':p.error?'rejected':p.settled&&!p.waitForObservation?'returned':'timeout';
        this.onEvent('action.end',{key,result,error:p.error?.message??p.error?.reason??''});
        if(p.error||result==='timeout')this.onError(key,p.error??result);p.onSettle(result,p.error??p.result);
      }
    }
  }
  cancelResource(resource){if(this.frame)this.frame=this.frame.filter(j=>!j.resources.includes(resource));for(const [key,p] of this.pending)if(!p.value&&p.resources.includes(resource))this.pending.delete(key);}
  invalidate(){this.frame=null;this.waiting.clear();this.generation++;for(const p of this.pending.values())if(p.value)p.onSettle('unknown');this.pending.clear();}
}

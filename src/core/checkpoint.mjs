// Reserve a small fixed-size record, rather than rewriting the whole profile.
// Only our obsolete optional configuration cache may be removed, never other bots.
export function recoverableNonValueJournal(j){return !!j&&j.kind==='quest.monsterhunt'&&(j.cost??0)===0&&(j.loss??0)===0&&Array.isArray(j.slots)&&j.slots.length===0;}
export function createCheckpoint(p,key,report){
  try{p.root.localStorage?.removeItem('cstore_'+key+':config');}catch{}
  const stored=p.read(key);let durable=true;
  function write(journal){const payload={journal,padding:''};const size=JSON.stringify(payload).length;payload.padding=' '.repeat(Math.max(0,4096-size));const ok=p.write(key,payload);durable=ok;if(!ok)report.error('checkpoint.write',p.storageError||'Speicher voll oder nicht verfügbar');return ok;}
  if(!stored?.journal)write(null);
  return {journal:stored?.journal??null,get durable(){return durable;},write,
    begin(j){if(durable&&write(j))return true;if(j.kind==='consume'){report.event('checkpoint.memory',{kind:j.kind,item:j.item});return true;}return false;},
    clear(j){return j?.kind==='consume'&&!durable?true:write(null);}
  };
}

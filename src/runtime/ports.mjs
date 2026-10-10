export function createPorts(root){
  let parent;try{parent=root.parent??root;}catch{parent=root;}
  const h=parent.headless,headless=!!(h||parent.caracAL);
  let progressionRuntime=null,progressionDefinitions=null;
  const ipc=!!(h?.apiVersion===1&&h.capabilities?.localMessages&&typeof h.send==='function'&&typeof h.onMessage==='function');
  const find=name=>typeof root[name]==='function'?[root,root[name]]:typeof parent[name]==='function'?[parent,parent[name]]:null;
  return {root,parent,headless,ipc,h,
    has:name=>!!find(name),
    hasProgression(){return typeof parent.progression_read==='function'||!!find('get_progression')||typeof (parent.ProgressionRuntime??root.ProgressionRuntime)?.create==='function';},
    progression(options={}){
     if(typeof parent.progression_read==='function')return parent.progression_read(options);
     const wrapper=find('get_progression');if(wrapper)return wrapper[1].call(wrapper[0],options);
     const factory=parent.ProgressionRuntime??root.ProgressionRuntime,G=root.G??parent.G;
     if(typeof factory?.create!=='function'||!G)throw Error('Offizielle Progression-API fehlt');
     if(progressionRuntime&&progressionDefinitions!==G){progressionRuntime.detach?.();progressionRuntime=null;}
     if(!progressionRuntime){
      progressionDefinitions=G;
      progressionRuntime=factory.create({G,characterSlots:root.character_slots??parent.character_slots,doublehandTypes:root.doublehand_types??parent.doublehand_types,
       character:()=>root.character,realm:()=>String(parent.server_region??root.server_region??'')+' '+String(parent.server_identifier??root.server_identifier??''),
       socket:()=>parent.socket,entities:()=>parent.entities??{},party:()=>parent.party,status:()=>parent.S??{},
       nextSkill:id=>parent.next_skill?.[id]??0});
     }return progressionRuntime.read(options);
    },
    closeProgression(){try{progressionRuntime?.detach?.();const f=find('get_progression');f?.[1]?.runtime?.detach?.();}catch{}progressionRuntime=null;progressionDefinitions=null;},
    call(name,...args){const f=find(name);if(!f)throw Error('Spiel-API fehlt: '+name);return f[1].apply(f[0],args);},
    get c(){return root.character;},get G(){return root.G??parent.G;},get entities(){return parent.entities??{};},
    realm(){return String(parent.server_region??root.server_region??'')+String(parent.server_identifier??root.server_identifier??'');},
    log(message){try{this.call('game_log','ALBot: '+String(message).slice(0,220));}catch{root.console?.warn(message);}},
    read(key){try{return this.call('get',key);}catch{return null;}},
    storageError:'',
    write(key,value){try{if(root.localStorage){root.localStorage.setItem('cstore_'+key,JSON.stringify(value));this.storageError='';return true;}const ok=this.call('set',key,value)===true;if(!ok)this.storageError='set() meldet Schreibfehler';return ok;}catch(e){this.storageError=String(e?.name)+': '+String(e?.message??e);return false;}},
    hook(name,handler){const old=root[name];const fn=function(...args){if(handler(...args)===true)return;if(typeof old==='function')return old.apply(this,args);};root[name]=fn;return ()=>{if(root[name]===fn)root[name]=old;};}
  };
}

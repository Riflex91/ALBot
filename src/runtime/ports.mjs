export function createPorts(root){
  let parent;try{parent=root.parent??root;}catch{parent=root;}
  const h=parent.headless,headless=!!(h||parent.caracAL);
  let progressionRuntime=null,progressionDefinitions=null;
  const ipc=!!(h?.apiVersion===1&&h.capabilities?.localMessages&&typeof h.send==='function'&&typeof h.onMessage==='function');
  const find=name=>typeof root[name]==='function'?[root,root[name]]:typeof parent[name]==='function'?[parent,parent[name]]:null;
  const owns=name=>{if(typeof parent.owned_character==='function')return parent.owned_character(name);const f=find('get_characters');if(!f)return null;const rows=f[1].call(f[0]);return Array.isArray(rows)?rows.find(c=>c?.name===name):null;};
  return {root,parent,headless,ipc,h,
    has:name=>!!find(name),
    characterSwitchCapability(name){
     let reason='';
     if(headless)reason='headless-host';
     else if(typeof parent.owned_character!=='function'&&!find('get_characters'))reason='owned-character-api-missing';
     else if(typeof parent.code_persistence_logic!=='function')reason='code-persistence-api-missing';
     else if(parent.code_slot===undefined||parent.code_slot===null||String(parent.code_slot)==='')reason='code-slot-missing';
     else if(!parent.location?.assign||!parent.socket?.disconnect)reason='window-navigation-missing';
     if(!reason&&name){try{const own=owns(name);if(!own||own.name!==name)reason='target-not-owned';else if(own.online)reason='target-already-online';}catch{reason='owned-character-read-failed';}}
     if(!reason){try{const u=new URL(parent.location.href);if(!/^https?:$/.test(u.protocol)||u.pathname.split('/')[1]!=='character'||decodeURIComponent(u.pathname.split('/')[2])!==root.character?.name)reason='window-route-unsupported';}catch{reason='window-route-invalid';}}
     return {supported:!reason,reason:reason||'same-game-window'};
    },
    canSwitchCharacter(name){
     if(headless||typeof parent.owned_character!=='function'&&!find('get_characters')||typeof parent.code_persistence_logic!=='function'||parent.code_slot===undefined||parent.code_slot===null||String(parent.code_slot)===''||!parent.location?.assign||!parent.socket?.disconnect)return false;
     const owned=owns(name);
     if(!owned||owned.name!==name||owned.online||name===root.character?.name)return false;
     try{const u=new URL(parent.location.href);return /^https?:$/.test(u.protocol)&&u.pathname.split('/')[1]==='character'&&decodeURIComponent(u.pathname.split('/')[2])===root.character?.name;}catch{return false;}
    },
    async switchCharacter(name,guard=()=>true){
     if(!guard()||!this.canSwitchCharacter(name))throw Error('Charakterwechsel im eigenen Fenster nicht verfügbar');
     // Persist the existing CODE slot before unloading its character. An
     // explicit code query runs that same saved bot on the incoming farmer.
     const saved=await parent.code_persistence_logic();
     if(saved?.failed||saved?.success===false||!guard()||!this.canSwitchCharacter(name))throw Error('CODE-Speicherung/Charakterwechsel nicht bestätigt');
     const u=new URL(parent.location.href),parts=u.pathname.split('/');
     parts[2]=encodeURIComponent(name);u.pathname=parts.join('/');u.searchParams.set('code',String(parent.code_slot));
     parent.socket.disconnect();parent.location.assign(u.href);return true;
    },
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
    // Only detach a runtime created by this port. The official get_progression
    // wrapper owns a shared singleton; stopping ALBot must not detach listeners
    // still in use by the game or another code client.
    closeProgression(){try{progressionRuntime?.detach?.();}catch{}progressionRuntime=null;progressionDefinitions=null;},
    // Only a read-only tracker observation request; no user-item operations.
    trackerSocket(){return parent?.socket??null;},
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

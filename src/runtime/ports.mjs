export function createPorts(root){
  let parent;try{parent=root.parent??root;}catch{parent=root;}
  const h=parent.headless,headless=!!(h||parent.caracAL);
  let progressionRuntime=null,progressionDefinitions=null;
  const ipc=!!(h?.apiVersion===1&&h.capabilities?.localMessages&&typeof h.send==='function'&&typeof h.onMessage==='function');
  const find=name=>typeof root[name]==='function'?[root,root[name]]:typeof parent[name]==='function'?[parent,parent[name]]:null;
  const owns=name=>{if(typeof parent.owned_character==='function')return parent.owned_character(name);const f=find('get_characters');if(!f)return null;const rows=f[1].call(f[0]);return Array.isArray(rows)?rows.find(c=>c?.name===name):null;};
  // The CODE editor can select another slot while this runner stays alive.
  // Bind rotation to the runner's slot/source, never to that mutable editor.
  let rotationSlot=null;try{const f=find('get_active_code_slot');rotationSlot=f?f[1].call(f[0]):parent.code_slot;}catch{}
  const rotationCode=typeof parent.the_code==='string'?parent.the_code:null;
  const validSlot=()=>['string','number'].includes(typeof rotationSlot)&&String(rotationSlot).trim()!=='';
  const directSave=()=>rotationCode!==null&&rotationCode.length>0&&!!find('upload_code');
  return {root,parent,headless,ipc,h,
    has:name=>!!find(name),
    rewardMailCapability(){
     let reason='';
     if(headless)reason='authenticated-mail-reader-unavailable-on-headless-host';
     else if(!parent.$||typeof parent.$.ajax!=='function'||!find('api_call'))
      reason='official-authenticated-mail-reader-unavailable';
     else {try{if(!['https://adventure.land','https://www.adventure.land'].includes(parent.location.origin))
      reason='mail-reader-origin-not-verified';}catch{reason='mail-reader-origin-unavailable';}}
     return {supported:!reason,reason:reason||'official-browser-authenticated-api'};
    },
    async readRewardMailPage(cursor=null){
     if(!this.rewardMailCapability().supported)throw Error('Authenticated reward mail reader unavailable');
     if(cursor!==null&&(typeof cursor!=='string'||!/^\d{1,8}$/.test(cursor)))
      throw Error('Invalid reward mail cursor');
     // Same authenticated endpoint/options as official api_call(), but read
     // infs directly: api_call deletes infs and forwards them to the mail UI.
     const data=await Promise.resolve(parent.$.ajax({method:'POST',dataType:'json',
      contentType:'application/json; charset=utf-8',url:'/api/pull_mail',
      data:JSON.stringify(cursor===null?{}:{cursor}),timeout:15000}));
     if(!data||data.failed||!Array.isArray(data.infs)||data.infs.length>64)
      throw Error('Invalid authenticated reward mail response');
     const page=data.infs.find(row=>row?.type==='mail');
     if(!page||!Array.isArray(page.mail)||page.mail.length>40)throw Error('Reward mail page unavailable');
     // Free-form subject/message text is discarded at the port boundary.
     return {more:page.more===true,cursor:page.cursor??null,mail:page.mail.map(row=>({
      id:row.id,to:row.to,item:row.item,taken:row.taken,can_take:row.can_take,
      subject_message:{phrase:row.subject_message?.phrase}
     }))};
    },
    characterSwitchCapability(name){
     let reason='';
     if(headless)reason='headless-host';
     else if(typeof parent.owned_character!=='function'&&!find('get_characters'))reason='owned-character-api-missing';
     else if(!directSave()&&typeof parent.code_persistence_logic!=='function')reason='code-persistence-api-missing';
     else if(!validSlot())reason='code-slot-missing';
     else if(!directSave()&&(parent.explicit_slot||String(parent.code_slot)!==String(rotationSlot)))reason='running-code-save-unavailable';
     else if(!parent.location?.assign||!parent.socket?.disconnect)reason='window-navigation-missing';
     if(!reason&&name){try{const own=owns(name);if(!own||own.name!==name)reason='target-not-owned';else if(own.online)reason='target-already-online';}catch{reason='owned-character-read-failed';}}
     if(!reason){try{const u=new URL(parent.location.href);if(!/^https?:$/.test(u.protocol)||u.pathname.split('/')[1]!=='character'||decodeURIComponent(u.pathname.split('/')[2])!==root.character?.name)reason='window-route-unsupported';}catch{reason='window-route-invalid';}}
     return {supported:!reason,reason:reason||'same-game-window'};
    },
    canSwitchCharacter(name){
     return !!name&&name!==root.character?.name&&this.characterSwitchCapability(name).supported;
    },
    async switchCharacter(name,guard=()=>true){
     if(!guard()||!this.canSwitchCharacter(name))throw Error('Charakterwechsel im eigenen Fenster nicht verfügbar');
     // Persist the existing CODE slot before unloading its character. An
     // explicit code query runs that same saved bot on the incoming farmer.
     // Let an already running editor save finish before persisting the exact
     // running source. upload_code does not save unrelated editor contents and
     // unlike code_persistence_logic also works with an explicit ?code= slot.
     if(parent.code_save_promise)await parent.code_save_promise;
     if(!guard()||!this.canSwitchCharacter(name))throw Error('Charakterwechsel nicht mehr freigegeben');
     const upload=find('upload_code');
     const saved=directSave()?await upload[1].call(upload[0],rotationSlot,undefined,rotationCode):await parent.code_persistence_logic();
     if(!saved||saved.failed||saved.success===false||!guard()||!this.canSwitchCharacter(name))throw Error('CODE-Speicherung/Charakterwechsel nicht bestätigt');
     const u=new URL(parent.location.href),parts=u.pathname.split('/');
     parts[2]=encodeURIComponent(name);u.pathname=parts.join('/');u.searchParams.set('code',String(rotationSlot));
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
    // The official server emits seller-visible swaps as socket "ui".
    // Subscribe without changing game UI handlers; detach on bot disposal.
    watchOwnTradeSwaps(handler){
     const socket=parent.socket;
     if(typeof handler!=='function'||!socket||
        typeof socket.on!=='function'||
        typeof socket.off!=='function'&&
        typeof socket.removeListener!=='function')return null;
     const listener=data=>{
      if(data?.type==='swap'&&data.event===true)handler(data);
     };
     socket.on('ui',listener);
     return ()=>{if(typeof socket.off==='function')socket.off('ui',listener);
      else socket.removeListener('ui',listener);};
    },
    // Official chest_opened contains per-item looter and per-recipient gold.
    // It is emitted to each group recipient. This subscriber is read-only.
    watchChestOpened(handler){
     const socket=parent.socket;
     if(typeof handler!=='function'||!socket||
       typeof socket.on!=='function'||
       typeof socket.off!=='function'&&
       typeof socket.removeListener!=='function')return null;
     socket.on('chest_opened',handler);
     return ()=>{if(typeof socket.off==='function')socket.off('chest_opened',handler);
      else socket.removeListener('chest_opened',handler);};
    },
    // Only a read-only tracker observation request; no user-item operations.
    trackerSocket(){return parent?.socket??null;},
    call(name,...args){const f=find(name);if(!f)throw Error('Spiel-API fehlt: '+name);return f[1].apply(f[0],args);},
    get c(){return root.character;},get G(){return root.G??parent.G;},get entities(){return parent.entities??{};},
    realm(){return String(parent.server_region??root.server_region??'')+String(parent.server_identifier??root.server_identifier??'');},
    log(message){try{this.call('game_log','ALBot: '+String(message).slice(0,220));}catch{root.console?.warn(message);}},
    read(key){try{return this.call('get',key);}catch{return null;}},
    // The official get() catches storage/JSON failures and returns null.
    // That behavior is acceptable for ordinary preferences, but would make
    // an unresolved Cave admission look like an absent journal on restart.
    // Read the SAME cstore_ storage used by set() without swallowing faults.
    readCaveJournal(key){
     if(typeof key!=='string'||!/^albot:cave-lifecycle:[A-Za-z0-9_]{1,100}$/.test(key))
      throw Error('Invalid Cave journal key');
     const storage=root.localStorage??parent.localStorage;
     if(!storage||typeof storage.getItem!=='function')
      throw Error('Strict Cave journal storage unavailable');
     const raw=storage.getItem('cstore_'+key);
     if(raw===null)return null;
     if(typeof raw!=='string'||raw.length>65536)
      throw Error('Invalid Cave journal storage payload');
     return JSON.parse(raw);
    },
    storageError:'',
    write(key,value){try{if(root.localStorage){root.localStorage.setItem('cstore_'+key,JSON.stringify(value));this.storageError='';return true;}const ok=this.call('set',key,value)===true;if(!ok)this.storageError='set() meldet Schreibfehler';return ok;}catch(e){this.storageError=String(e?.name)+': '+String(e?.message??e);return false;}},
    hook(name,handler){const old=root[name];const fn=function(...args){if(handler(...args)===true)return;if(typeof old==='function')return old.apply(this,args);};root[name]=fn;return ()=>{if(root[name]===fn)root[name]=old;};}
  };
}

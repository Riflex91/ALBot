export function createPorts(root){
  let parent;try{parent=root.parent??root;}catch{parent=root;}
  const h=parent.headless,headless=!!(h||parent.caracAL);
  const ipc=!!(h?.apiVersion===1&&h.capabilities?.localMessages&&typeof h.send==='function'&&typeof h.onMessage==='function');
  const find=name=>typeof root[name]==='function'?[root,root[name]]:typeof parent[name]==='function'?[parent,parent[name]]:null;
  return {root,parent,headless,ipc,h,
    has:name=>!!find(name),
    call(name,...args){const f=find(name);if(!f)throw Error('Spiel-API fehlt: '+name);return f[1].apply(f[0],args);},
    get c(){return root.character;},get G(){return root.G??parent.G;},get entities(){return parent.entities??{};},
    realm(){return String(parent.server_region??root.server_region??'')+String(parent.server_identifier??root.server_identifier??'');},
    log(message){try{this.call('game_log','ALBot: '+String(message).slice(0,220));}catch{root.console?.warn(message);}},
    read(key){try{return this.call('get',key);}catch{return null;}},
    write(key,value){try{return this.call('set',key,value)!==false;}catch{return false;}},
    hook(name,handler){const old=root[name];const fn=function(...args){if(handler(...args)===true)return;if(typeof old==='function')return old.apply(this,args);};root[name]=fn;return ()=>{if(root[name]===fn)root[name]=old;};}
  };
}

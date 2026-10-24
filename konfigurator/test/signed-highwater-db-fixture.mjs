// Test-only faithful D1 first()/run() façade with SQL CAS invariants.
export function fakeSignedHighwaterDb(){
 const rows=new Map();
 const db={rows,offline:false,noTable:false,failWrites:false,writes:0,
  prepare(sql){
   if(db.offline||db.noTable)throw Error('no such table: signed_config_highwater');
   if(!sql.includes('signed_config_highwater'))
    throw Error('Unexpected D1 query');
   return {bind(...values){return {
    first:async()=>structuredClone(rows.get(values[0])??null),
    run:async()=>{
     if(db.failWrites)throw Error('D1 unavailable');
     if(!sql.includes('excluded.sequence>signed_config_highwater.sequence')||
      !sql.includes('signed_config_highwater.key_id=excluded.key_id'))
      throw Error('High-water CAS predicate absent');
     const [target,key_id,sequence,sha256,release_sha,updated_at]=values;
     const current=rows.get(target);
     if(current&&(current.key_id!==key_id||sequence<=current.sequence))
      return {meta:{changes:0}};
     rows.set(target,{key_id,sequence,sha256,release_sha,updated_at});
     db.writes++;
     return {meta:{changes:1}};
    }
   };}};
  }
 };
 return db;
}

// Functional evidence is independent of market price and equipment score.
// Unknown purposes never constitute permission to discard an item.
const KEYS=new Set(['cryptkey','frozenkey','tombkey','spiderkey','stonekey']);
const UTILITIES=new Set(['computer','supercomputer','tracker','xptome']);
const TOKENS=new Set(['monstertoken','funtoken','pvptoken']);
export function itemPurposes(G,item){
 const m=G.items?.[item?.name];
 if(!m)return {known:false,tags:['unreviewed'],recipes:[],skills:[],protected:true};
 const tags=[],recipes=[],skills=[];
 if(m.upgrade||m.compound||m.wtype)tags.push('equipment');
 for(const [out,recipe] of Object.entries(G.craft??{})){
  let quantity=0,invalid=false;
  for(const row of Array.isArray(recipe?.items)?recipe.items:[]){
   if(Array.isArray(row)&&row[1]===item.name&&
      (item.level??0)===(row[2]??0)){
    if(!Number.isSafeInteger(row[0])||row[0]<1)invalid=true;
    else quantity+=row[0];
   }
  }
  if(invalid||!Number.isSafeInteger(quantity))tags.push('unreviewed');
  else if(quantity)recipes.push({out,quantity,level:item.level??0});
 }
 for(const [id,skill] of Object.entries(G.skills??{})){
  if(skill.consume===item.name)skills.push(id);
 }
 if(recipes.length)tags.push('recipeInput');
 if(skills.length)tags.push('skillConsumable');
 if(TOKENS.has(item.name)||G.tokens?.[item.name]||m.type==='token')tags.push('tokenCurrency');
 if(KEYS.has(item.name)||m.type==='key'||m.opens)tags.push('instanceKey');
 if(UTILITIES.has(item.name)||m.type==='computer'||m.type==='tracker'||m.type==='tool')tags.push('utility');
 if(m.quest||m.event)tags.push('quest');
 if(m.e)tags.push('exchange');
 if(['offering','uscroll','cscroll','pscroll','booster','stand','pot','elixir'].includes(m.type))tags.push('operatingSupply');
 // Explicitly known skill weapons need protection even when G.skills uses
 // a weapon TYPE rather than an item id for its requirement.
 if(item.name==='basher')tags.push('skillEquipment');
 if(m.action||m.onclick||m.special||m.ability||m.abilities)tags.push('unreviewed');
 return {known:true,tags,recipes,skills,protected:tags.some(t=>
  ['tokenCurrency','instanceKey','utility','skillConsumable','skillEquipment','quest','operatingSupply','unreviewed'].includes(t))};
}

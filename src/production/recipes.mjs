export function findRecipe(G,item,alias=''){
 const entries=alias?[[alias,G.craft?.[alias]]]:Object.entries(G.craft??{});
 for(const [key,recipe] of entries)if(recipe&&(recipe.output?.name??key)===item)return {key,recipe};return null;
}
export function recipeIngredients(recipe){
 const result=[];for(const row of recipe.items??[]){if(!Array.isArray(row)||!Number.isSafeInteger(row[0])||row[0]<1||typeof row[1]!=='string')throw Error('Ungültige Rezeptzutat');const level=row[2]??0;
  const old=result.find(x=>x.item===row[1]);if(old){if(old.level!==level)throw Error('Rezept mit mehreren Leveln derselben Zutat nicht ausführbar');old.quantity+=row[0];}else result.push({item:row[1],level,quantity:row[0]});
 }return result;
}

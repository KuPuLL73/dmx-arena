import fs from 'node:fs';
export const LOADOUT_SLOTS=['primary','backup','melee','special','head'];
const rules=JSON.parse(fs.readFileSync(new URL('./dist/slot-rules.json',import.meta.url),'utf8'));
export function assetSlot(asset){return asset?.slot==='Mask'?'head':rules[asset?.collection]||rules[asset?.slot]||(LOADOUT_SLOTS.includes(asset?.slot)?asset.slot:null);}
export function normalizedSlots(slots,inventory=[],strict=true){
 const result={};let needsReview=false;
 for(const [key,id] of Object.entries(slots||{})){
  const slot=LOADOUT_SLOTS.includes(key)?key:key==='Mask'?'head':rules[key];
  if(!slot||result[slot]){if(strict)throw Error('В каждом из пяти игровых слотов может быть только один предмет.');needsReview=true;continue;}
  const asset=inventory.find(row=>row.id===id);if(asset&&assetSlot(asset)!==slot){if(strict)throw Error('Этот предмет не подходит для выбранного игрового слота.');needsReview=true;continue;}
  result[slot]=id;
 }
 return {slots:result,needsReview};
}
export function savedLoadout(set){const normalized=normalizedSlots(set.slots,[],false);return {...set,...normalized};}
export function assertItemsAvailable(set,sets=[]){
 const used=new Set(sets.filter(other=>other.id!==set.id).flatMap(other=>Object.values(other.slots||{})));
 if(Object.values(set.slots||{}).some(id=>used.has(id)))throw Error('Скин уже используется в другом сете. Сначала убери его оттуда.');
}

// Generated from the preserved Node/Python application.

export const LOADOUT_SLOTS=['primary','backup','melee','special','head'];
const rules={
  "Chef's Knife": "melee",
  "Lil Prick": "backup",
  "Ak-69": "primary",
  "Bloop Tube": "special",
  "Claw": "melee",
  "Micro Mayhem": "backup",
  "Eggplant": "primary",
  "Multi-shot": "special",
  "Plunger": "melee",
  "Loud Bastard": "backup",
  "Booyaka": "primary",
  "RPG": "special",
  "Katana": "melee",
  "Toxic": "backup",
  "Deadeye": "primary",
  "Pepe": "special",
  "Ivory Beam": "primary",
  "Debugger": "melee",
  "M-18": "primary",
  "Bad Bitch": "primary",
  "Bow": "backup",
  "Hallconnen": "primary",
  "Trinity": "special",
  "Midget": "backup",
  "LMG": "primary",
  "Pixel Slayer": "melee",
  "Whisper": "backup",
  "Scarface": "primary",
  "Overkill": "special",
  "Freakout": "primary",
  "Dead Air": "special",
  "Deagle": "backup",
  "Rapid Release": "primary",
  "Casull": "backup",
  "Fire Axe": "melee",
  "Click Clack": "primary",
  "Flash": "special",
  "Banana": "backup",
  "Duck Launcher": "primary",
  "Trident": "melee",
  "UV 9000": "special",
  "": "special",
  "Chicken": "head",
  "Doge": "head",
  "Dogs": "head",
  "PD": "head",
  "Pixel Head": "head"
};
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

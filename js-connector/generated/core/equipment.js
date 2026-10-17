// Generated from the preserved Node/Python application.
import crypto from 'node:crypto';
import {validateSet} from './domain.js';
import {savedLoadout,assertItemsAvailable} from './loadout.js';
export const EQUIPMENT_SLOTS=Object.freeze(['primary','backup','melee','special','head']);
export function equipmentBonus(set,inventory){
 let count=0;
 try{if(set&&!set.needsReview)count=Object.keys(validateSet(set,inventory).slots).length;}catch{}
 return {count,percent:count*10,perSkin:10,maxPercent:50};
}
// A slot mutation always uses the authenticated account and fresh owned inventory.
export function equipSlot(profile,input,inventory){
 if(!EQUIPMENT_SLOTS.includes(input?.slot)||(input.itemId!==null&&(typeof input.itemId!=='string'||!input.itemId||input.itemId.length>100)))throw Error('Неверный игровой слот или скин.');
 const sets=(profile.sets||[]).map(savedLoadout),active=sets.find(s=>s.id===profile.active);
 let current=null;
 try{if(active&&!active.needsReview){validateSet(active,inventory);current=active;}}catch{}
 if(input.itemId===null&&!current)return {...profile,sets,active:null};
 if(!current){if(sets.length>=20)throw Error('Сначала выбери или удали один из 20 сохранённых сетов.');current={id:crypto.randomUUID(),name:'Мой сет',slots:{}};}
 const slots={...current.slots};if(input.itemId===null)delete slots[input.slot];else slots[input.slot]=input.itemId;
 if(!Object.keys(slots).length)return {...profile,sets:sets.filter(s=>s.id!==current.id),active:null};
 const checked=validateSet({name:current.name,slots},inventory),next={id:current.id,...checked,published:false};
 assertItemsAvailable(next,sets);
 const index=sets.findIndex(s=>s.id===next.id);if(index<0)sets.push(next);else sets[index]=next;
 return {...profile,sets,active:next.id};
}

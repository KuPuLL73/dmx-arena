// Generated from the preserved Node/Python application.
import {normalizedSlots,assetSlot} from './loadout.js';
import {clanPhoto} from './game-avatar.js';
export function playerId(value){
 if(typeof value!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim()))throw Error('Введите полный ID игрока из профиля pw.game.');
 return value.trim().toLowerCase();
}
export function validateSet(input,inventory){
 if(!input||typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>32||!input.slots||Array.isArray(input.slots)||typeof input.slots!=='object')throw Error('Укажите название сета и выберите свои скины.');
 const slots=normalizedSlots(input.slots,inventory).slots,entries=Object.entries(slots);if(!entries.length||entries.length>5)throw Error('Выберите предметы для пяти игровых слотов.');
 for(const [slot,id] of entries){const asset=inventory.find(row=>row.id===id);if(!asset||asset.source!=='notgames'||asset.owned!==true||assetSlot(asset)!==slot)throw Error('Надеть можно только свои скины из NotGames. Обновите инвентарь.');}
 if(new Set(entries.map(row=>row[1])).size!==entries.length)throw Error('Один предмет нельзя надеть дважды.');
 return {name:input.name.trim(),slots};
}
export function validatePreview(input){
 if(!input||typeof input.id!=='string'||!/^[a-z0-9:-]{1,100}$/i.test(input.id)||typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>32||!input.slots||typeof input.slots!=='object'||Array.isArray(input.slots)||!Array.isArray(input.items))throw Error('Некорректный образец сета.');
 const canonical=normalizedSlots(input.slots,input.items).slots,slots=Object.entries(canonical);if(!slots.length||slots.length>5||input.items.length>5)throw Error('В образце может быть до пяти предметов.');
 const items=slots.map(([slot,id])=>{
  const item=input.items.find(x=>x?.id===id&&assetSlot(x)===slot);
  if(typeof slot!=='string'||slot.length>64||typeof id!=='string'||id.length>100||!item||typeof item.name!=='string'||item.name.length>128||typeof item.collection!=='string'||item.collection.length>64||typeof item.image!=='string'||item.image.length>2048)throw Error('Некорректный предмет в образце.');
  let image=item.image;if(!/^assets\/[a-f0-9]+\.png$/.test(image)){let url;try{url=new URL(image);}catch{throw Error('Некорректное изображение предмета.');}if(url.protocol!=='https:'||url.username||url.password)throw Error('Некорректное изображение предмета.');image=url.href;}
  return {id,slot,name:item.name,collection:item.collection,image,owned:false,source:'shared_preview'};
 });
 return {id:input.id,name:input.name.trim(),slots:Object.fromEntries(slots),author:typeof input.author==='string'?input.author.slice(0,24):'Игрок',items};
}
export function rankPlayers(rows){return rows.filter(row=>Number.isSafeInteger(row.userId)&&row.userId>0&&Number.isSafeInteger(row.score)&&row.score>=0&&row.scoreVerified===true).sort((a,b)=>b.score-a.score||a.userId-b.userId).map((row,index)=>({rank:index+1,name:row.link?.name||'Игрок',score:row.score,profileId:row.publicId||null,photoUrl:row.photoUrl||null}));}
export function rankClans(rows,awards){
 const users=new Set(rows.filter(row=>Number.isSafeInteger(row.userId)&&row.userId>0).map(row=>row.userId)),clans=new Map();
 const add=clan=>{if(!Number.isSafeInteger(clan?.id)||clan.id<1||typeof clan.name!=='string'||!clan.name)return null;if(!clans.has(clan.id))clans.set(clan.id,{clanId:clan.id,name:clan.name,avatar:clanPhoto(clan.avatar),score:0,members:0});const entry=clans.get(clan.id);if(!entry.avatar)entry.avatar=clanPhoto(clan.avatar);return entry;};
 for(const row of rows){const clan=row.gameStats?.clan;if(users.has(row.userId)&&row.link&&clan?.status==='found'&&clan.source==='pixel_world_api'&&clan.playerId===row.link.playerId){const entry=add(clan);if(entry){entry.members++;if(row.scoreVerified===true&&Number.isSafeInteger(row.score)&&row.score>=0)entry.score+=row.score;}}}
 for(const row of rows)for(const map of row.gameStats?.clanWars?.maps||[])for(const clan of [map.owner,...(map.lastBattle?.teams||[])]){const entry=clans.get(clan?.id);if(entry&&!entry.avatar)entry.avatar=clanPhoto(clan.avatar);}
 return [...clans.values()].sort((a,b)=>b.score-a.score||a.clanId-b.clanId).map((row,index)=>({...row,rank:index+1}));
}
export function clanMembers(rows,awards,clanId){
 if(!Number.isSafeInteger(clanId)||clanId<1)throw Error('Некорректный клан.');
 const members=rows.filter(row=>{const clan=row.gameStats?.clan;return row.link&&clan?.status==='found'&&clan.source==='pixel_world_api'&&clan.playerId===row.link.playerId&&clan.id===clanId;});
 const ranked=rankClans(rows,awards).find(row=>row.clanId===clanId);
 let metadata=members[0]?.gameStats?.clan;
 if(!metadata)for(const row of rows){for(const map of row.gameStats?.clanWars?.maps||[]){metadata=[map.owner,...(map.lastBattle?.teams||[])].find(clan=>clan?.id===clanId);if(metadata)break;}if(metadata)break;}
 const clan={id:clanId,name:ranked?.name||metadata?.name||'Клан #'+clanId,avatar:ranked?.avatar||clanPhoto(metadata?.avatar),score:ranked?.score||0,members:members.length};
 return {clan,players:rankPlayers(members),source:'dmx_clan_members'};
}

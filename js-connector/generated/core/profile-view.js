// Generated from the preserved Node/Python application.
import {savedLoadout} from './loadout.js';
import {equipmentBonus} from './equipment.js';
import {clanPhoto} from './game-avatar.js';
export function telegramPhoto(value){
 if(typeof value!=='string'||value.length>2048)return null;
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}
}
export function viewInventory(items){
 return items.filter(r=>r.owned===true&&r.source==='notgames').map(r=>Object.fromEntries(['id','name','collection','slot','image','model','serial','backdrop','symbol','traitRarity','owned','source'].map(k=>[k,r[k]])));
}
export function publicProfile(saved,dmx){
 if(saved.privateProfile===true)return {profileId:saved.publicId,name:saved.link?.name||'Игрок',photoUrl:telegramPhoto(saved.photoUrl),dmx:{balance:dmx.balance},private:true};
 const inventory=saved.viewInventory||[],sets=(saved.sets||[]).map(savedLoadout),active=sets.find(s=>s.id===saved.active);
 const bonus=equipmentBonus(active,inventory),stats=saved.gameStats,clan=stats?.clan;
 const connected=saved.link&&clan?.status==='found'&&clan.source==='pixel_world_api'&&clan.playerId===saved.link.playerId;
 const publicClan=connected?{id:clan.id,name:clan.name,avatar:clanPhoto(clan.avatar),stale:!!clan.stale}:null;
 const battles=connected?(stats.mapProgress?.battles||[]).filter(b=>b.clanId===clan.id&&b.source==='clan_score_schedule_observation'&&Number.isSafeInteger(b.score)&&b.score>=0&&Number.isSafeInteger(b.startsAt)&&Number.isSafeInteger(b.endsAt)&&Number.isSafeInteger(b.updatedAt)).slice(-100).map(b=>({mapId:b.mapId,score:b.score,startsAt:b.startsAt,endsAt:b.endsAt,updatedAt:b.updatedAt,isLowerBound:true})):[];
 const maps=connected?stats.clanWars?.maps||[]:[];
 const territory=stats?.mapProgress?.territoryStats;
 const territoryStats=connected&&territory?Object.fromEntries(['captured','defended','unclassified','total','observedSince'].map(k=>[k,Number.isSafeInteger(territory[k])&&territory[k]>=0?territory[k]:0])):null;
 return {profileId:saved.publicId,name:saved.link?.name||'Игрок',photoUrl:telegramPhoto(saved.photoUrl),dmx:{balance:dmx.balance},inventory,sets,active:bonus.count?active.id:null,equipmentBonus:bonus,updatedAt:saved.inventoryVerifiedAt||null,clan:publicClan,activity:{battles,territoryStats,ownedMaps:connected&&maps.length?maps.filter(m=>m.segment_type==='ownership'&&m.owner?.id===clan.id&&m.startsAt<=Date.now()&&m.endsAt>Date.now()).length:null,totalMaps:maps.length||null,updatedAt:connected?clan.updatedAt||null:null}};
}

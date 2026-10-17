import fs from 'node:fs';
import path from 'node:path';
import {MATCH_FINISH_GRACE_MS,MAX_OBSERVATION_GAP_MS,BATTLE_FINALIZATION_DELAY_MS} from './battle-timing.mjs';
const integer=v=>Number.isSafeInteger(v)&&v>=0;

export class MapProgress {
 constructor(directory){
  this.file=path.join(directory,'game-map-progress.json');
  try{this.records=JSON.parse(fs.readFileSync(this.file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw Error('Не удалось прочитать прогресс карт.');this.records={};}
 }
 save(){fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file+'.tmp',JSON.stringify(this.records),{mode:0o600});fs.renameSync(this.file+'.tmp',this.file);}
 observe(uuid,clan,maps){
  if(!clan||clan.status!=='found'||clan.source!=='pixel_world_api'||clan.playerId!==uuid||clan.stale||!integer(clan.memberScore)||!integer(clan.updatedAt)||!integer(clan.observedFrom)||clan.observedFrom>clan.updatedAt||!Array.isArray(maps?.maps))return this.view(uuid,maps);
  const record=this.records[uuid]||{points:{},windows:{},last:null,unassigned:0,startedAt:clan.updatedAt,lastReason:'baseline'};
  for(const map of maps.maps){
   const windows=[...(map.segment_type==='battle'?[{mapId:map.map_id,startsAt:map.startsAt,endsAt:map.endsAt}]:[]),...(map.lastBattle?.source==='pixel_world_api'?[map.lastBattle]:[])];
   for(const window of windows)if(window.mapId===map.map_id&&integer(window.startsAt)&&integer(window.endsAt)&&window.endsAt>window.startsAt){
    const key=window.mapId+':'+window.startsAt,previous=record.windows[key];
    const value={...previous,mapId:window.mapId,startsAt:window.startsAt,endsAt:window.endsAt};
    if(value.ownerBefore===undefined&&maps.source==='pixel_world_api'&&map.segment_type==='battle'&&map.startsAt===window.startsAt&&map.endsAt===window.endsAt&&window.startsAt<=clan.updatedAt&&clan.updatedAt<window.endsAt){
     if(integer(map.owner?.id)&&map.owner.id>0)value.ownerBefore=map.owner.id;
     else if(map.owner===null)value.ownerBefore=0;
    }
    record.windows[key]=value;
   }
  }
  const current={clanId:clan.id,clanName:clan.name,value:clan.memberScore,observedFrom:clan.observedFrom,updatedAt:clan.updatedAt},last=record.last;
  if(last&&current.updatedAt<=last.updatedAt){this.complete(record,maps);this.save();return this.view(uuid,maps);}
  // Battle contributions are separate from lifetime map totals and from other clans.
  record.battles ||= {};
  record.pending ||= {};
  const battleKey=w=>current.clanId+':'+w.mapId+':'+w.startsAt;
  for(const window of Object.values(record.windows)){
   if(window.startsAt<=current.observedFrom&&current.updatedAt<window.endsAt){
    record.battles[battleKey(window)] ||= {...window,clanId:current.clanId,clanName:clan.name,score:0,observedSince:current.observedFrom,partial:true};
   }
  }
  if(last&&last.clanId===current.clanId&&current.value>=last.value){
   const delta=current.value-last.value;
   if(delta>0){
    // Use the full possible completion interval, not just the map's entry window.
    // During adjacent maps' overlap the aggregate roster counter cannot tell
    // whether a match belongs to the previous map or the new one.
    const overlaps=Object.values(record.windows).filter(w=>w.startsAt<current.updatedAt&&w.endsAt+MATCH_FINISH_GRACE_MS>last.observedFrom);
    const win=overlaps.length===1?overlaps[0]:null;
    const complete=win&&win.startsAt<=last.observedFrom&&current.updatedAt<win.endsAt+MATCH_FINISH_GRACE_MS;
    if(current.updatedAt-last.updatedAt<=MAX_OBSERVATION_GAP_MS&&complete){
     record.points[win.mapId]=(record.points[win.mapId]||0)+delta;record.lastReason='counted';
     const battle=record.battles[battleKey(win)];
     if(battle)battle.score+=delta;
    }else{
     record.unassigned+=delta;record.lastReason=current.updatedAt-last.updatedAt>MAX_OBSERVATION_GAP_MS?'gap':overlaps.length>1?'map_overlap':'boundary';
     const key=current.clanId+':'+last.updatedAt+':'+current.updatedAt;
     record.pending[key]={clanId:current.clanId,from:last.observedFrom,to:current.updatedAt,score:delta,reason:record.lastReason,candidates:overlaps.map(w=>({mapId:w.mapId,startsAt:w.startsAt,endsAt:w.endsAt}))};
    }
   }
  }else if(last){record.lastReason=last.clanId!==current.clanId?'clan_changed':'counter_reset';}
  record.last=current;
  this.complete(record,maps);
  const oldest=current.updatedAt-3*86400000;
  record.windows=Object.fromEntries(Object.entries(record.windows).filter(([,w])=>w.endsAt>=oldest));
  record.battles=Object.fromEntries(Object.entries(record.battles).filter(([,w])=>w.endsAt>=oldest));
  record.pending=Object.fromEntries(Object.entries(record.pending).filter(([,p])=>p.to>=oldest));
  this.records[uuid]=record;this.save();return this.view(uuid,maps);
 }
 complete(record,maps){
  if(maps?.source!=='pixel_world_api')return;
  record.territoryWins ||= {};
  for(const map of maps.maps||[]){
   const result=map.lastBattle,winners=result?.teams?.filter(t=>t.rank===1)||[];
   if(result?.source!=='pixel_world_api'||winners.length!==1||!integer(result.startsAt)||!integer(result.endsAt)||result.endsAt<=result.startsAt||map.segment_type!=='ownership'||map.startsAt<result.endsAt||!integer(maps.updatedAt)||maps.updatedAt<result.endsAt+BATTLE_FINALIZATION_DELAY_MS||!integer(result.updatedAt)||result.updatedAt<result.endsAt+BATTLE_FINALIZATION_DELAY_MS||map.owner?.id!==winners[0].id)continue;
   const key=map.map_id+':'+result.startsAt+':'+result.endsAt;if(record.territoryWins[key])continue;
   const contribution=Object.values(record.battles||{}).find(b=>b.mapId===map.map_id&&b.startsAt===result.startsAt&&b.endsAt===result.endsAt&&b.clanId===winners[0].id&&integer(b.score)&&b.score>=1000);
   if(!contribution)continue;
   const window=record.windows[map.map_id+':'+result.startsAt],before=window?.endsAt===result.endsAt?window.ownerBefore:undefined;
   record.territoryWins[key]={mapId:map.map_id,startsAt:result.startsAt,endsAt:result.endsAt,clanId:contribution.clanId,score:contribution.score,type:before===undefined?'unclassified':before===contribution.clanId?'defended':'captured',confirmedAt:maps.updatedAt,source:'confirmed_map_result'};
  }
 }
 view(uuid,maps){
  const record=this.records[uuid],rows=(maps?.maps||[]).map(map=>({mapId:map.map_id,score:record?.points[map.map_id]||0,target:1000,complete:(record?.points[map.map_id]||0)>=1000}));
  const battles=Object.values(record?.battles||{}).filter(w=>w.clanId===record.last?.clanId).map(w=>({...w,updatedAt:record.last.updatedAt,source:'clan_score_schedule_observation',isLowerBound:true}));
  const wins=Object.values(record?.territoryWins||{});
  const territoryStats={captured:wins.filter(w=>w.type==='captured').length,defended:wins.filter(w=>w.type==='defended').length,unclassified:wins.filter(w=>w.type==='unclassified').length,total:wins.length,observedSince:record?.startedAt||null};
  const pending=Object.values(record?.pending||{}).filter(p=>p.clanId===record.last?.clanId).map(p=>({clanId:p.clanId,score:p.score,reason:p.reason,from:p.from,to:p.to,candidates:p.candidates}));
  return {status:record?'tracking':'waiting',source:'clan_score_schedule_observation',available:!!record&&rows.length>0,maps:rows,battles,pending,territoryStats,completed:rows.filter(row=>row.complete).length,total:rows.length,updatedAt:record?.last?.updatedAt||null,startedAt:record?.startedAt||null,unassigned:record?.unassigned||0,lastReason:record?.lastReason||'baseline'};
 }
}

import fs from 'node:fs';
import path from 'node:path';
import {playerId} from './domain.mjs';
import {ECONOMY,skinReward} from './economy.mjs';
import {MapProgress} from './map-progress.mjs';
import {ladderStatus,ladderAward} from './battle-ladder.mjs';

const integer=value=>Number.isSafeInteger(value)&&value>=0;
export function clanQuestBattle(stats,now=Date.now()){
 const clan=stats?.clan,progress=stats?.mapProgress,maps=stats?.clanWars?.maps;
 if(stats?.source!=='pixel_world_api'||clan?.status!=='found'||clan.source!=='pixel_world_api'||clan.playerId!==stats.playerId||clan.stale||progress?.source!=='clan_score_schedule_observation'||progress.available!==true||!Array.isArray(maps)||!integer(progress.updatedAt))return null;
 const windows=maps.flatMap(map=>[
  ...(map.segment_type==='battle'?[{mapId:map.map_id,startsAt:map.startsAt,endsAt:map.endsAt}]:[]),
  ...(map.lastBattle?.source==='pixel_world_api'?[map.lastBattle]:[])
 ]);
 const candidates=(progress.battles||[]).filter(row=>row.clanId===clan.id&&row.source==='clan_score_schedule_observation'&&integer(row.score)&&integer(row.observedSince)&&integer(row.startsAt)&&integer(row.endsAt)&&row.endsAt>row.startsAt&&row.observedSince>=row.startsAt&&row.observedSince<row.endsAt&&row.startsAt<=now&&windows.some(w=>w.mapId===row.mapId&&w.startsAt===row.startsAt&&w.endsAt===row.endsAt));
 const live=candidates.filter(row=>row.endsAt>now),rows=live.length?live:candidates;
 return rows.sort((a,b)=>b.score-a.score||b.startsAt-a.startsAt||a.mapId.localeCompare(b.mapId))[0]||null;
}
export function questStatus(stats,claimed=[],economy=ECONOMY){
 const battle=clanQuestBattle(stats),progress=stats?.mapProgress;
 const verifiedAt=progress?.updatedAt??null;
 const available=!!battle&&Number.isSafeInteger(verifiedAt)&&Date.now()-verifiedAt<=90000&&Date.now()-verifiedAt>=-5000;
 const personal=(id,title,target)=>({id,title,description:'Набери '+target.toLocaleString('ru-RU')+' очков за одну клановую битву.',target,progress:available?battle.score:null,available,claimed:claimed.includes(id),kind:'clan_war',verifiedAt,battle:available?{mapId:battle.mapId,startsAt:battle.startsAt,endsAt:battle.endsAt,clanId:battle.clanId}:null,hint:available?'Учтён новый вклад с начала наблюдения.':'Вклад появится после наблюдения за твоими клановыми битвами.'});
 return [
  personal('clan_arms','К оружию',1000),
  personal('clan_contribution','Боевой вклад',2000),
  personal('clan_power','Ударная сила',3000),
  {id:'world',title:'Весь мир',description:'Набери 1000 очков в часы клановой битвы на каждой карте.',target:stats?.mapProgress?.total||null,progress:stats?.mapProgress?.completed||0,available:stats?.mapProgress?.available===true&&stats?.clan?.status==='found'&&!stats.clan.stale,claimed:claimed.includes('world'),unit:'карт',hint:'Новые очки учитываются по расписанию битв после привязки ID.'},
  {id:'clan_ownership_ladder',title:'Контроль территорий',description:'Удержите 3 / 4 / 5 / 6 карт во владении клана к концу дня.',target:6,progress:null,available:false,claimed:false,unit:'карт',stages:[3,4,5,6],hint:'Захват и защита подходят. Общий фонд делят до 10 лучших участников DMX по вкладу за день. Суммы готовятся.'}
 ].map(q=>({...q,reward:economy.claimsEnabled?economy.rewards[q.id]??null:null,claimEnabled:economy.claimsEnabled&&integer(economy.rewards[q.id])&&economy.rewards[q.id]>0}));
}
export function publicSnapshot(result,uuid){
 if(result?.source!=='pixel_world_api'||result.playerId!==uuid)throw Error('Игра вернула данные другого ID.');
 const periods={};
 for(const period of ['day','week','month']){
  const row=result.periods?.[period]??null;
  if(row&&(row.playerId!==uuid||!integer(row.score)||!Number.isSafeInteger(row.rank)||row.rank<1||typeof row.name!=='string'||!row.name||!Number.isSafeInteger(row.updatedAt)))throw Error('Не удалось подтвердить строку игрока в таблице игры.');
  periods[period]=row;
 }
 const found=Object.values(periods).filter(Boolean).sort((a,b)=>b.updatedAt-a.updatedAt);
 const clan=result.clan||null;
 if(clan?.status==='found'&&(clan.source!=='pixel_world_api'||clan.playerId!==uuid||!integer(clan.id)||clan.id<1||typeof clan.name!=='string'||typeof clan.memberName!=='string'||!clan.memberName||!integer(clan.memberScore)||!integer(clan.updatedAt)||!integer(clan.observedFrom)))throw Error('Не удалось подтвердить участника клана по игровому ID.');
 const pending=Object.values(result.progress||{}).some(row=>row.status==='searching')||clan?.status==='searching'||clan?.refreshStatus==='searching';
 return {status:found.length||clan?.status==='found'?'connected':result.status==='not_listed'?'not_listed':pending?'searching':'error',playerId:uuid,name:found[0]?.name||clan?.memberName||null,avatar:found[0]?.avatar||'',
  periods,progress:result.progress||{},clan,pending,dayPoints:periods.day?.score??null,weekPoints:periods.week?.score??null,monthPoints:periods.month?.score??null,dayRank:periods.day?.rank??null,
  updatedAt:found[0]?.updatedAt||result.updatedAt,source:'pixel_world_api'};
}

export class GameService {
 constructor(directory,lookup,clanMaps,economy=ECONOMY,lookupClan=null){
  this.directory=directory;this.lookup=lookup;this.clanMaps=clanMaps;this.inflight=new Map();
  this.economy=economy;
  this.lookupClan=lookupClan;
  this.mapProgress=new MapProgress(directory);
  this.links=this.read('game-links.json',{});this.awards=this.read('game-awards.json',{});
  const seen=new Set();for(const [id,link] of Object.entries(this.links)){const uuid=playerId(link.playerId);if(!Number.isSafeInteger(Number(id))||Number(id)<=0||Number(id)>=2**52||String(Number(id))!==id||link.telegramId!==undefined&&link.telegramId!==Number(id)||seen.has(uuid))throw Error('Обнаружена повторная привязка игрового ID. Требуется восстановить хранилище.');link.playerId=uuid;link.telegramId=Number(id);seen.add(uuid);}
 }
 read(name,fallback){try{return JSON.parse(fs.readFileSync(path.join(this.directory,name),'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw Error('Хранилище игрового профиля требует восстановления.');}}
 write(name,value){fs.mkdirSync(this.directory,{recursive:true});const file=path.join(this.directory,name);fs.writeFileSync(file+'.tmp',JSON.stringify(value),{mode:0o600});fs.renameSync(file+'.tmp',file);}
 async find(value,{force=false,waitMs=6000,period}={}){
  const uuid=playerId(value),deadline=Date.now()+waitMs;let result=await this.lookup(uuid,force);
  while(Date.now()<deadline){
   const searching=period?result.progress?.[period]?.status==='searching':force?Object.values(result.progress||{}).some(row=>row.status==='searching'):result.status==='searching';
   if(!searching)break;
   await new Promise(resolve=>setTimeout(resolve,500));result=await this.lookup(uuid,false);
  }
  return publicSnapshot(result,uuid);
 }
 bind(user,snapshot){
  const uuid=playerId(snapshot?.playerId);
  publicSnapshot(snapshot,uuid);
  if(!Number.isSafeInteger(user?.id)||user.id<=0||user.id>=2**52)throw Error('Неверный пользователь Telegram.');
  if(snapshot.source!=='pixel_world_api'||typeof snapshot.name!=='string'||!snapshot.name||!(Object.values(snapshot.periods||{}).some(row=>row?.playerId===uuid)||snapshot.clan?.status==='found'&&snapshot.clan.playerId===uuid))throw Error('Дождись, пока игра найдёт ID и ник.');
  if(this.links[user.id]&&this.links[user.id].playerId!==uuid)throw Error('За этим Telegram-аккаунтом уже закреплён другой игровой ID.');
  for(const [id,link] of Object.entries(this.links))if(Number(id)!==user.id&&link.playerId===uuid)throw Error('Этот игровой ID уже закреплён за другим Telegram-аккаунтом.');
  const link={playerId:uuid,telegramId:user.id,name:snapshot.name,status:'connected',active:true,dataVerified:true,ownershipVerified:false,associationPolicy:'id_only',source:'pixel_world_api',linkedAt:this.links[user.id]?.linkedAt||Date.now()};
  const next={...this.links,[user.id]:link};this.write('game-links.json',next);this.links=next;return link;
 }
 link(userId){const record=this.links[userId];return record&&record.active!==false?record:null;}
 async sync(userId,{force=false,period}={}){
  const link=this.link(userId);if(!link)throw Error('Сначала привяжи игровой ID в профиле.');
  const key=userId+':'+(force?'fresh':'cached')+':'+(period||'all');if(this.inflight.has(key))return this.inflight.get(key);
  const promise=(async()=>{
   const [snapshot,maps]=await Promise.all([this.find(link.playerId,{force,period,waitMs:force?22000:2000}),this.clanMaps().catch(()=>null)]);
   if(this.link(userId)!==link)throw Error('Привязка игрового ID изменилась. Обнови профиль.');
   if(snapshot.name){link.name=snapshot.name;this.write('game-links.json',this.links);}
   return {...snapshot,clanWars:maps,mapProgress:this.mapProgress.observe(link.playerId,snapshot.clan,maps)};
  })();this.inflight.set(key,promise);try{return await promise;}finally{this.inflight.delete(key);}
 }
 async syncClan(userId){
  const link=this.link(userId);if(!link||!this.lookupClan)throw Error('Игровой профиль не подключён.');
  const [clan,maps]=await Promise.all([this.lookupClan(link.playerId,true),this.clanMaps().catch(()=>null)]);
  const snapshot=publicSnapshot({source:'pixel_world_api',playerId:link.playerId,periods:{},clan,progress:{},updatedAt:Date.now()},link.playerId);
  if(this.link(userId)!==link)throw Error('Привязка изменилась.');
  if(snapshot.name&&snapshot.name!==link.name){link.name=snapshot.name;this.write('game-links.json',this.links);}
  return {clan:snapshot.clan,clanWars:maps,mapProgress:this.mapProgress.observe(link.playerId,clan,maps)};
 }
 claim(userId,snapshot,questId,skinCount=0){
  if(!this.economy.claimsEnabled)throw Error('Начисления ещё не запущены. Задания и награды готовятся.');
  if(snapshot?.source!=='pixel_world_api'||snapshot.playerId!==this.link(userId)?.playerId)throw Error('Обнови данные своего игрового ID.');
  publicSnapshot(snapshot,snapshot.playerId);
  const q=this.quests(snapshot).find(row=>row.id===questId);if(!q?.claimEnabled||!q.available)throw Error('Дождись подтверждения вклада в клановых войнах.');if(q.progress<q.target)throw Error('Задание ещё не выполнено.');
  const age=Date.now()-snapshot.mapProgress?.updatedAt;
  if(!Number.isFinite(age)||age>30000||age< -5000)throw Error('Обнови игровые очки перед получением награды.');
  const key=snapshot.playerId+':alltime:'+q.id;
  if(this.awards[key]||Object.values(this.awards).some(row=>(row.userId===userId||row.playerId===snapshot.playerId)&&row.questId===q.id))throw Error('Награда уже получена.');
  const amount=skinReward(q.reward,skinCount);
  this.awards[key]={userId,playerId:snapshot.playerId,period:'alltime',questId:q.id,amount,baseAmount:q.reward,skinBonus:{count:skinCount,percent:skinCount*10,amount:amount-q.reward},clan:snapshot.clan?.status==='found'&&!snapshot.clan.stale?{id:snapshot.clan.id,name:snapshot.clan.name}:null,issuedAt:Date.now()};this.write('game-awards.json',this.awards);return amount;
 }
 quests(stats,claimed=[]){return questStatus(stats,claimed,this.economy);}
 ladder(userId,stats,skinCount,policy,options={}){return ladderStatus(userId,this.link(userId)?.playerId,stats,this.awards,skinCount,policy,options);}
 claimLadder(userId,stats,questId,skinCount,policy,options={}){
  const uuid=this.link(userId)?.playerId;if(!uuid||stats?.playerId!==uuid)throw Error('Обнови данные своего игрового ID.');publicSnapshot(stats,uuid);
  const {key,award}=ladderAward(userId,uuid,stats,this.awards,questId,skinCount,policy,options);
  const next={...this.awards,[key]:award};this.write('game-awards.json',next);this.awards=next;return award.amount;
 }
 settleLadders(userId,stats,skinCount,policy,options={}){
  const uuid=this.link(userId)?.playerId;if(!uuid||stats?.playerId!==uuid)throw Error('Обнови данные своего игрового ID.');publicSnapshot(stats,uuid);
  const next={...this.awards},issued=[];
  for(const row of stats.mapProgress?.battles||[]){
   const scope={...options,mapId:row.mapId,battleStartsAt:row.startsAt};
   const state=ladderStatus(userId,uuid,stats,next,skinCount,policy,scope);
   if(!state.canClaim)continue;
   const {key,award}=ladderAward(userId,uuid,stats,next,state.next.questId,skinCount,policy,scope);
   next[key]=award;issued.push(award);
  }
  if(issued.length){this.write('game-awards.json',next);this.awards=next;}
  return {amount:issued.reduce((sum,row)=>sum+row.amount,0),awards:issued};
 }
 rewards(userId){const rows=Object.values(this.awards).filter(row=>row.userId===userId&&integer(row.amount)&&row.amount>0);return {balance:rows.reduce((n,row)=>n+row.amount,0),score:rows.reduce((n,row)=>n+row.amount,0),claimed:[...new Set(rows.map(row=>row.questId))],scoreVerified:true};}
 unlink(userId){const link=this.links[userId];if(!link)return;const next={...this.links,[userId]:{...link,active:false,status:'disconnected',disconnectedAt:Date.now()}};this.write('game-links.json',next);this.links=next;}
}

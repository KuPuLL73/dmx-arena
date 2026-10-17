// Generated from the preserved Node/Python application.
import {launchView} from './quest-launch.js';
import {BATTLE_FINALIZATION_DELAY_MS} from './battle-timing.js';
import {skinReward} from './economy.js';
export const MISSIONS_VERSION='missions-v1';
export const DAILY_MAP_GOALS=Object.freeze([
 Object.freeze({maps:2,rewards:Object.freeze([5,10,15])}),
 Object.freeze({maps:3,rewards:Object.freeze([10,25,50])}),
 Object.freeze({maps:5,rewards:Object.freeze([25,50,75])})
]);
export const MAP_REWARDS=Object.freeze({boxes_level:100,panelka_level:100,city_level:100,silent_floor_level:50,not_factory_level:50,jungle_level:50,medieval_level:50,lost_city_level:50,victory_street_level:50,flying_ship_level:50,temple_level:50});
export const MAP_WINNER_LIMIT=5;
const DAY=86400000,integer=v=>Number.isSafeInteger(v)&&v>=0;
export const dayStart=now=>Math.floor(now/DAY)*DAY;
export const weekStart=now=>dayStart(now)-((new Date(now).getUTCDay()+6)%7)*DAY;
const battleKey=b=>b.mapId+':'+b.startsAt+':'+b.endsAt;
function verifiedNickname(stats,uuid,now){
 if(!uuid||stats?.source!=='pixel_world_api'||stats.playerId!==uuid)return null;
 const fresh=at=>integer(at)&&now-at>=-5000&&now-at<=90000,clan=stats.clan;
 if(clan?.source==='pixel_world_api'&&clan.status==='found'&&!clan.stale&&clan.playerId===uuid&&fresh(clan.updatedAt)&&typeof clan.memberName==='string'&&clan.memberName.trim())return clan.memberName;
 return Object.values(stats.periods||{}).filter(r=>r?.playerId===uuid&&fresh(r.updatedAt)&&typeof r.name==='string'&&r.name.trim()).sort((a,b)=>b.updatedAt-a.updatedAt)[0]?.name||null;
}

// This service accepts only the server's observed contributions and finalized wins.
// Client requests never supply progress, membership, reward sizes or recipients.
export class Missions {
 constructor(game){this.game=game;this.release=game.read('missions-launch.json',{enabled:false,startedAt:null});this.dailyLaunch=game.read('daily-map-launch.json',{startedAt:this.release.startedAt});this.state=game.read('missions-state.json',{events:{},rankings:{}});if(this.release.enabled===true&&(!integer(this.release.startedAt)||!integer(this.dailyLaunch.startedAt)))throw Error('Проверь дату запуска заданий.');this.collect();}
 enabled(policy,userId){return this.release.enabled===true&&launchView(policy,userId).claimsEnabled;}
 collect(now=Date.now()){
  if(this.release.enabled!==true)return;
  let changed=false;const records=this.game.mapProgress.records;
  for(const [id,link] of Object.entries(this.game.links)){
   const record=records[link.playerId];if(!record)continue;
   for(const b of Object.values(record.battles||{})){
    if(!Object.hasOwn(MAP_REWARDS,b.mapId)||!integer(b.startsAt)||!integer(b.endsAt)||b.endsAt<=b.startsAt||b.endsAt<this.release.startedAt||b.endsAt+BATTLE_FINALIZATION_DELAY_MS>now||!integer(b.score)||!integer(b.observedSince)||b.observedSince<b.startsAt||b.observedSince>=b.endsAt||!integer(b.clanId)||b.clanId<1||link.linkedAt>b.endsAt)continue;
    const key=link.playerId+':'+b.clanId+':'+battleKey(b);
    if(!this.state.events[key]){this.state.events[key]={playerId:link.playerId,userId:Number(id),mapId:b.mapId,startsAt:b.startsAt,endsAt:b.endsAt,clanId:b.clanId,clanName:b.clanName||('Клан #'+b.clanId),score:b.score,source:'clan_score_schedule_observation'};changed=true;}
    const event=this.state.events[key],win=record.territoryWins?.[battleKey(b)];
    if(!event.won&&win?.source==='confirmed_map_result'&&win.clanId===event.clanId&&win.score>=1000){event.won=true;changed=true;}
   }
  }
  // Freeze a common roster after the battle, including temporarily disconnected IDs.
  const groups=new Map();for(const event of Object.values(this.state.events)){const key=event.clanId+':'+battleKey(event);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(event);}
  for(const [key,events] of groups)if(!this.state.rankings[key]){this.state.rankings[key]=events.filter(e=>e.score>0).sort((a,b)=>b.score-a.score||a.userId-b.userId).map(e=>e.playerId);changed=true;}
  if(changed)this.game.write('missions-state.json',this.state);
 }
 rows(userId,policy,{now=Date.now(),allPeriods=false,skinCount=0,stats=null}={}){
  const uuid=this.game.link(userId)?.playerId,events=Object.values(this.state.events).filter(e=>e.playerId===uuid).sort((a,b)=>a.endsAt-b.endsAt||a.startsAt-b.startsAt||a.mapId.localeCompare(b.mapId));
  const enabled=this.enabled(policy,userId),rows=[],day=dayStart(now),week=weekStart(now);
  const add=(id,title,group,progress,target,amount,scope,extra={})=>{
   const key=uuid+':'+MISSIONS_VERSION+':'+id+':'+scope,paid=this.game.awards[key];
   const count=group==='once'?0:skinCount,boosted=skinReward(amount,count);
   rows.push({id,title,group,progress:Math.min(progress,target),target,amount:paid?.amount??boosted,baseAmount:paid?.baseAmount??amount,skinBonusPercent:paid?(paid.skinBonus?.percent??0):count*10,scope,key,claimed:!!paid,ready:enabled&&!!uuid&&progress>=target&&!paid,...extra});
  };
  const nickname=verifiedNickname(stats,uuid,now);
  add('nickname_dmx','Добавить DMX в ник в игре','once',nickname&&/dmx/i.test(nickname)?1:0,1,50,'account',{verified:nickname!==null});
  const days=allPeriods?[...new Set([day,...events.map(e=>dayStart(e.endsAt))])]:[day];
  for(const start of days){
   for(const [index,contributionTarget] of [1000,2000,3000].entries()){
    const groups=new Map();
    for(const e of events.filter(e=>e.endsAt>=Math.max(start,this.dailyLaunch.startedAt)&&e.endsAt<start+DAY&&e.score>=contributionTarget)){if(!groups.has(e.clanId))groups.set(e.clanId,new Set());groups.get(e.clanId).add(e.mapId);}
    const progress=Math.max(0,...[...groups.values()].map(v=>v.size));
    for(const goal of DAILY_MAP_GOALS)add('daily_maps_'+goal.maps+'_'+contributionTarget,'На '+goal.maps+' картах','day',progress,goal.maps,goal.rewards[index],String(start),{contributionTarget,resetAt:start+DAY});
   }
  }
  const weeks=allPeriods?[...new Set([week,...events.map(e=>weekStart(e.endsAt))])]:[week];
  for(const start of weeks){
   const maps={};for(const e of events.filter(e=>e.endsAt>=start&&e.endsAt<start+7*DAY))maps[e.mapId]=(maps[e.mapId]||0)+e.score;
   const route=Object.values(maps).filter(v=>v>=1000).length,total=Object.values(maps).reduce((a,b)=>a+b,0);
   add('weekly_route_5','Недельный маршрут','week',route,5,100,String(start),{resetAt:start+7*DAY});
   add('weekly_route_10','Недельный маршрут','week',route,10,150,String(start),{cumulative:250,resetAt:start+7*DAY});
   add('weekly_score','Большой вклад','week',total,10000,250,String(start),{resetAt:start+7*DAY});
   add('weekly_score_25000','Масштабный вклад','week',total,25000,500,String(start),{resetAt:start+7*DAY});
  }
  const ranking=e=>this.state.rankings[e.clanId+':'+battleKey(e)]||[];
  for(const e of events.filter(e=>e.won&&e.score>=1000)){
   const extra={battle:{mapId:e.mapId,startsAt:e.startsAt,endsAt:e.endsAt},clan:{id:e.clanId,name:e.clanName}};
   add('territory_win','Захват / защита','victory',1,1,10,e.clanId+':'+battleKey(e),extra);
   const rank=ranking(e).indexOf(uuid)+1;
   if(rank>0&&rank<=MAP_WINNER_LIMIT)add('map_victory','Победа на карте','victory',1,1,MAP_REWARDS[e.mapId],e.clanId+':'+battleKey(e),{...extra,rank});
  }
  return rows;
 }
 settle(userId,policy,options={}){
  if(!this.enabled(policy,userId)||!this.game.link(userId))return [];
  this.collect(options.now);const ready=this.rows(userId,policy,{...options,allPeriods:true}).filter(r=>r.ready&&(!options.groups||options.groups.includes(r.group))),next={...this.game.awards};
  const latest=this.game.mapProgress.records[this.game.link(userId).playerId]?.last,issuedAt=options.now??Date.now();
  const clan=latest?.clanId>0&&typeof latest.clanName==='string'&&issuedAt-latest.updatedAt>=-5000&&issuedAt-latest.updatedAt<=90000?{id:latest.clanId,name:latest.clanName}:null;
  for(const r of ready)next[r.key]={version:MISSIONS_VERSION,userId,playerId:this.game.link(userId).playerId,questId:r.id,period:r.group,scope:r.scope,amount:r.amount,baseAmount:r.baseAmount,skinBonus:{count:r.skinBonusPercent/10,percent:r.skinBonusPercent,amount:r.amount-r.baseAmount},clan:r.clan||clan,battle:r.battle||null,issuedAt};
  if(ready.length){this.game.write('game-awards.json',next);this.game.awards=next;}
  return ready;
 }
 board(userId,policy,options={}){return {enabled:this.enabled(policy,userId),startedAt:this.release.startedAt,rows:this.rows(userId,policy,options).map(({key,ready,...r})=>r)};}
}

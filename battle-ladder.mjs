import {skinReward} from './economy.mjs';
import {LADDER_VERSION,launchView} from './quest-launch.mjs';
export const LADDER_STAGES=Object.freeze([{id:'clan_arms',title:'К оружию',target:1000,base:10},{id:'clan_contribution',title:'Боевой вклад',target:2000,base:25},{id:'clan_power',title:'Ударная сила',target:3000,base:50}]);
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const sameBattle=(a,b)=>a?.mapId===b?.mapId&&a?.startsAt===b?.startsAt&&a?.endsAt===b?.endsAt;
export function ladderStatus(userId,uuid,stats,awards,skinCount,policy,{now=Date.now(),mapId,battleStartsAt}={}){
 const launch=launchView(policy,userId),clan=stats?.clan,progress=stats?.mapProgress;
 const selectedMap=mapId||stats?.clanWars?.maps?.[0]?.map_id||null;
 const windows=(stats?.clanWars?.maps||[]).filter(m=>m.map_id===selectedMap).flatMap(m=>[...(m.segment_type==='battle'?[{mapId:m.map_id,startsAt:m.startsAt,endsAt:m.endsAt}]:[]),...(m.lastBattle?.source==='pixel_world_api'?[{...m.lastBattle,mapId:m.map_id}]:[])]).filter(w=>integer(w.startsAt)&&integer(w.endsAt)&&w.endsAt>w.startsAt&&w.startsAt<=now);
 const window=windows.filter(w=>battleStartsAt===undefined||w.startsAt===battleStartsAt).sort((a,b)=>b.startsAt-a.startsAt)[0]||null;
 // Identity is the game's map and exact battle window. A clan change cannot replay it.
 const paid=window?Object.values(awards).filter(a=>a.version===LADDER_VERSION&&a.playerId===uuid&&sameBattle(a.battle,window)):[];
 const highest=paid.reduce((n,a)=>Math.max(n,a.target||0),0),totalPaid=paid.reduce((n,a)=>n+a.amount,0);
 const fresh=stats?.source==='pixel_world_api'&&stats.playerId===uuid&&clan?.source==='pixel_world_api'&&clan.status==='found'&&clan.playerId===uuid&&!clan.stale&&progress?.source==='clan_score_schedule_observation'&&progress.available===true&&integer(progress.updatedAt)&&now-progress.updatedAt<=90000&&now-progress.updatedAt>=-5000;
 const row=fresh&&window?(progress.battles||[]).find(b=>sameBattle(b,window)&&b.clanId===clan.id&&b.source==='clan_score_schedule_observation'&&integer(b.score)&&integer(b.observedSince)&&b.observedSince>=b.startsAt&&b.observedSince<b.endsAt):null;
 const available=!!row,score=available?row.score:null;
 const stages=LADDER_STAGES.map(s=>{const cumulative=skinReward(s.base,skinCount),claimed=highest>=s.target;return {...s,cumulative,claimed,reached:available&&score>=s.target,amount:claimed?0:Math.max(0,cumulative-totalPaid)};});
 const next=stages.filter(s=>s.reached&&!s.claimed).at(-1)||null;
 const status=highest>=3000?'collected':next?'ready':available?'tracking':'waiting_data';
 return {...launch,mapId:selectedMap,battle:window?{mapId:selectedMap,clanId:clan?.id??null,startsAt:window.startsAt,endsAt:window.endsAt,observedSince:row?.observedSince??null}:null,available,score,highest,totalPaid,skinBonusPercent:skinCount*10,stages,status,next:next?{questId:next.id,amount:next.amount,target:next.target}:null,canClaim:launch.claimsEnabled&&!!next};
}
export function ladderAward(userId,uuid,stats,awards,questId,skinCount,policy,options={}){
 const state=ladderStatus(userId,uuid,stats,awards,skinCount,policy,options);
 if(!state.claimsEnabled)throw Error('Получение наград пока не открыто для этого аккаунта.');
 const stage=state.stages.find(s=>s.id===questId);if(!stage)throw Error('Это задание ещё готовится к запуску.');
 if(stage.claimed)throw Error('Эта ступень уже начислена за эту битву карты.');
 if(!state.available)throw Error('Дождись подтверждённого вклада в эту битву карты.');
 const age=(options.now??Date.now())-stats.mapProgress.updatedAt;if(age>30000||age< -5000)throw Error('Обнови игровые очки перед начислением награды.');
 if(!stage.reached)throw Error('Порог этой ступени ещё не достигнут.');
 const key=uuid+':'+LADDER_VERSION+':'+state.mapId+':'+state.battle.startsAt+':'+state.battle.endsAt+':'+stage.target;
 return {key,award:{version:LADDER_VERSION,userId,playerId:uuid,period:'battle',questId,target:stage.target,amount:stage.amount,baseAmount:stage.base,totalThroughStage:state.totalPaid+stage.amount,coveredStages:state.stages.filter(s=>s.target<=stage.target).map(s=>s.id),battle:state.battle,skinBonus:{count:skinCount,percent:skinCount*10},clan:{id:stats.clan.id,name:stats.clan.name},issuedAt:options.now??Date.now()}};
}

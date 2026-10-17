import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {GameService} from './game-service.mjs';
import {Missions,MAP_REWARDS,DAILY_MAP_GOALS,MAP_WINNER_LIMIT,dayStart,weekStart} from './missions.mjs';
import {TelegramQuest,subscriptionBoard,SUBSCRIPTION} from './telegram-quest.mjs';
import {BATTLE_FINALIZATION_DELAY_MS} from './battle-timing.mjs';
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'dmx-missions-'));
const policy={mode:'open',pilotUserIds:[]},now=Date.UTC(2026,9,15,18),start=weekStart(now),uuid='11111111-1111-4111-8111-111111111111';
try{
 const game=new GameService(directory,async()=>{},async()=>{});
 game.write('missions-launch.json',{enabled:true,startedAt:start});
 for(let id=1;id<=12;id++){
  const playerId=id===1?uuid:String(id).padStart(8,'0')+'-1111-4111-8111-111111111111';
  game.links[id]={playerId,linkedAt:start-10000};game.mapProgress.records[playerId]={battles:{},territoryWins:{}};
 }
 const add=(userId,mapId,score,endsAt,{won=false,clanId=41}={})=>{
  const rec=game.mapProgress.records[game.links[userId].playerId],b={clanId,clanName:'DMX',mapId,score,startsAt:endsAt-60000,endsAt,observedSince:endsAt-50000};
  rec.battles[clanId+':'+mapId+':'+b.startsAt]=b;
  if(won)rec.territoryWins[mapId+':'+b.startsAt+':'+endsAt]={...b,source:'confirmed_map_result'};
  return b;
 };
 const maps=Object.keys(MAP_REWARDS),end=dayStart(now)+3600000;
 assert.equal(MAP_WINNER_LIMIT,5);
 for(const [map,amount] of Object.entries(MAP_REWARDS))assert.equal(amount,['boxes_level','panelka_level','city_level'].includes(map)?100:50);
 for(let i=0;i<20;i++)for(let user=1;user<=12;user++)add(user,maps[i%11],user===1?3000+i*100:user===12?1000:2500-user*10,end+i*120000,{won:true});
 const missions=new Missions(game);missions.collect(now);
 const rows=missions.rows(1,policy,{now}),daily=rows.filter(r=>r.group==='day');
 assert.equal(daily.length,9,'all nine goals are available together');
 for(const goal of DAILY_MAP_GOALS)for(const [i,score] of [1000,2000,3000].entries()){
  const r=daily.find(r=>r.id==='daily_maps_'+goal.maps+'_'+score);assert.equal(r.progress,goal.maps);assert.equal(r.amount,goal.rewards[i]);assert.equal(r.ready,true);
 }
 assert.equal(daily.reduce((n,r)=>n+r.amount,0),265,'separate daily rewards total exactly 265');
 assert.equal(rows.find(r=>r.id==='weekly_score').ready,true);assert.equal(rows.find(r=>r.id==='weekly_score_25000').ready,true);assert.equal(rows.find(r=>r.id==='weekly_route_10').ready,true);
 assert.equal(rows.some(r=>r.group==='medal'||r.id==='two_fronts'),false,'retired goals cannot be issued');
 assert.equal(rows.filter(r=>r.id==='map_victory').length,20);
 assert.equal(missions.rows(5,policy,{now}).filter(r=>r.id==='map_victory').length,20,'fifth place receives the reward');
 assert.equal(missions.rows(6,policy,{now}).filter(r=>r.id==='map_victory').length,0,'sixth place receives no map reward');
 assert.equal(missions.rows(12,policy,{now}).filter(r=>r.id==='territory_win').length,20,'capture reward remains independent of top five');
 const issued=missions.settle(1,policy,{now}),balance=game.rewards(1).balance;
 assert.equal(issued.filter(r=>r.group==='day').reduce((a,r)=>a+r.amount,0),265);assert.equal(issued.filter(r=>['weekly_score','weekly_score_25000'].includes(r.id)).reduce((n,r)=>n+r.amount,0),750,'10k and 25k are separate rewards');
 assert.equal(issued.filter(r=>r.id.startsWith('weekly_route')).reduce((a,r)=>a+r.amount,0),250);
 assert.equal(issued.some(r=>r.group==='medal'),false);
 assert.equal(missions.settle(1,policy,{now}).length,0,'repeated checks cannot replay payments');
 assert.equal(new Missions(game).settle(1,policy,{now}).length,0,'restart cannot replay payments');assert.equal(game.rewards(1).balance,balance);
 // Existing payments keep their exact amounts, even after a map rate increases.
 const old=Object.entries(game.awards).find(([,a])=>a.questId==='map_victory'&&a.battle.mapId==='boxes_level');
 game.awards[old[0]].amount=50;game.awards[old[0]].baseAmount=50;assert.equal(missions.settle(1,policy,{now}).length,0);
 game.awards.legacy_medal={userId:1,playerId:uuid,questId:'war_veteran',amount:200,period:'medal'};
 const beforeLegacy=game.rewards(1).balance;missions.settle(1,policy,{now});assert.equal(game.rewards(1).balance,beforeLegacy,'old medal balance remains intact');
 assert.equal(missions.settle(2,{mode:'preview'},{now}).length,0);
 const previousWeek=start-1000;add(1,maps[0],100000,previousWeek,{won:true});missions.collect(now);assert.ok(!Object.values(missions.state.events).some(e=>e.endsAt===previousWeek));
 const nextWeek=start+7*86400000;assert.equal(missions.rows(1,policy,{now:nextWeek}).find(r=>r.id==='weekly_score').progress,0);
 // Finalized winner proof may arrive late.
 const b=add(1,maps[0],1100,now-600000),k=maps[0]+':'+b.startsAt+':'+b.endsAt;missions.collect(now);
 assert.ok(!missions.rows(1,policy,{now}).some(r=>r.id==='territory_win'&&r.scope.endsWith(k)));
 game.mapProgress.records[uuid].territoryWins[k]={...b,source:'confirmed_map_result'};missions.collect(now);
 assert.equal(missions.rows(1,policy,{now}).filter(r=>r.id==='territory_win'&&r.scope.endsWith(k)).length,1);
 // A midnight delay retains the completed day's reward, without filling the new day.
 const nextDay=dayStart(now)+86400000,endDay=nextDay-60000;
 add(2,maps[0],4000,endDay);add(2,maps[1],4000,endDay-120000);missions.collect(nextDay+420000);
 const late=missions.settle(2,policy,{now:nextDay+420000});assert.equal(late.filter(r=>r.id==='daily_maps_2_3000'&&r.scope===String(dayStart(now))).length,1);
 assert.equal(missions.rows(2,policy,{now:nextDay+420000}).filter(r=>r.group==='day').every(r=>r.progress===0),true);
 // Different clans and several runs on the same map never make a new distinct map.
 add(3,maps[0],4000,nextDay+600000,{clanId:41});add(3,maps[1],4000,nextDay+720000,{clanId:52});add(3,maps[0],4000,nextDay+840000,{clanId:41});missions.collect(nextDay+1300000);
 assert.equal(missions.rows(3,policy,{now:nextDay+1300000}).filter(r=>r.group==='day').every(r=>r.progress===1),true);
 // 999 is below every goal; two different battles of 1500 do not meet 2000 each.
 add(4,maps[0],999,nextDay+600000);add(4,maps[1],1500,nextDay+720000);add(4,maps[1],1500,nextDay+840000);missions.collect(nextDay+1300000);
 assert.equal(missions.rows(4,policy,{now:nextDay+1300000}).find(r=>r.id==='daily_maps_2_1000').progress,1);assert.equal(missions.rows(4,policy,{now:nextDay+1300000}).find(r=>r.id==='daily_maps_2_2000').progress,0);
 // New daily rules have a separate cutoff: old events cannot retroactively earn them.
 game.write('daily-map-launch.json',{startedAt:nextDay});const migrated=new Missions(game);
 assert.equal(migrated.rows(1,policy,{now}).filter(r=>r.group==='day').every(r=>r.progress===0),true);
 assert.equal(migrated.rows(1,policy,{now}).find(r=>r.id==='weekly_score').progress,10000,'weekly history survives daily-rule migration');
 // The new weekly 25k quest pays separately after the 10k quest has been paid.
 const weeklyId='00000020-1111-4111-8111-111111111111';game.links[20]={playerId:weeklyId,linkedAt:start};game.mapProgress.records[weeklyId]={battles:{},territoryWins:{}};
 add(20,maps[0],10000,now-600000);missions.collect(now);
 let stages=missions.rows(20,policy,{now});assert.equal(stages.find(r=>r.id==='weekly_score').ready,true);assert.equal(stages.find(r=>r.id==='weekly_score_25000').ready,false);
 let weekPaid=missions.settle(20,policy,{now});assert.equal(weekPaid.find(r=>r.id==='weekly_score').amount,250);assert.equal(weekPaid.some(r=>r.id==='weekly_score_25000'),false);
 add(20,maps[1],15000,now-600000);missions.collect(now);weekPaid=missions.settle(20,policy,{now});
 assert.equal(weekPaid.find(r=>r.id==='weekly_score_25000').amount,500);assert.equal(weekPaid.some(r=>r.id==='weekly_score'),false,'25k does not repay or replace the 10k award');
 assert.equal(missions.settle(20,policy,{now}).length,0);
 stages=missions.rows(20,policy,{now:nextWeek});for(const id of ['weekly_score','weekly_score_25000']){assert.equal(stages.find(r=>r.id===id).claimed,false);assert.equal(stages.find(r=>r.id===id).progress,0);}
 // Do not freeze the score or rank while a last-minute match can still finish.
 const lateId='00000021-1111-4111-8111-111111111111';game.links[21]={playerId:lateId,linkedAt:start};game.mapProgress.records[lateId]={battles:{},territoryWins:{}};
 const delayed=add(21,maps[0],900,now-180000),delayedKey=lateId+':41:'+maps[0]+':'+delayed.startsAt+':'+delayed.endsAt;
 missions.collect(now);assert.equal(missions.state.events[delayedKey],undefined);
 delayed.score=1100;missions.collect(delayed.endsAt+BATTLE_FINALIZATION_DELAY_MS-1);assert.equal(missions.state.events[delayedKey],undefined);
 missions.collect(delayed.endsAt+BATTLE_FINALIZATION_DELAY_MS);assert.equal(missions.state.events[delayedKey].score,1100);
 // Every game mission uses the verified equipped count; paid amounts never change.
 const bonusGame=new GameService(path.join(directory,'bonus'),async()=>{},async()=>{});bonusGame.links=structuredClone(game.links);bonusGame.mapProgress.records=structuredClone(game.mapProgress.records);bonusGame.write('missions-launch.json',{enabled:true,startedAt:start});const bonusMissions=new Missions(bonusGame);
 const boostedRows=bonusMissions.rows(1,policy,{now,skinCount:5});
 for(const row of boostedRows.filter(r=>r.group!=='once')){assert.equal(row.amount,Math.floor(row.baseAmount*1.5));assert.equal(row.skinBonusPercent,50);}
 const boosted=bonusMissions.settle(1,policy,{now,skinCount:5});
 assert.equal(boosted.filter(r=>r.group==='day').reduce((n,r)=>n+r.amount,0),395,'round each daily award once, including 5 -> 7 and 25 -> 37');
 assert.equal(boosted.filter(r=>r.group==='week').reduce((n,r)=>n+r.amount,0),1500);
 assert.equal(boosted.find(r=>r.id==='weekly_score_25000').amount,750);
 assert.equal(boosted.find(r=>r.id==='weekly_score').amount,375);
 assert.equal(boosted.find(r=>r.id==='territory_win').amount,15);
 assert.equal(boosted.find(r=>r.id==='map_victory'&&r.battle.mapId==='boxes_level').amount,150);
 assert.equal(boosted.find(r=>r.id==='map_victory'&&r.battle.mapId==='silent_floor_level').amount,75);
 for(const row of boosted){const award=bonusGame.awards[row.key];assert.equal(award.baseAmount,row.baseAmount);assert.deepEqual(award.skinBonus,{count:5,percent:50,amount:row.amount-row.baseAmount});}
 const paidBonusBalance=bonusGame.rewards(1).balance;
 assert.equal(bonusMissions.settle(1,policy,{now,skinCount:0}).length,0);
 for(const row of bonusMissions.rows(1,policy,{now,skinCount:0}).filter(r=>r.claimed)){assert.equal(row.amount,bonusGame.awards[row.key].amount);assert.equal(row.skinBonusPercent,50);}
 assert.equal(new Missions(bonusGame).settle(1,policy,{now,skinCount:5}).length,0);assert.equal(bonusGame.rewards(1).balance,paidBonusBalance);
 assert.equal(missions.rows(1,policy,{now,skinCount:5}).find(r=>r.key===old[0]).amount,50,'a legacy payment stays at its actual amount');
 assert.equal(missions.settle(1,policy,{now,skinCount:5}).some(r=>r.key===old[0]),false,'adding a set cannot replay or top up old mission payments');
 for(const count of [1,2,3,4])for(const row of missions.rows(6,policy,{now,skinCount:count}).filter(r=>r.group!=='once'))assert.equal(row.amount,Math.floor(row.baseAmount*(100+count*10)/100));
 assert.throws(()=>missions.rows(6,policy,{now,skinCount:6}));
 // One-time nickname reward: exact 50, fresh game identity only, no set bonus.
 const nickDir=path.join(directory,'nickname'),nickGame=new GameService(nickDir,async()=>{},async()=>{});
 nickGame.links[22]={playerId:uuid,linkedAt:start,active:true,name:'DMX from saved/Telegram name'};nickGame.write('game-links.json',nickGame.links);nickGame.write('missions-launch.json',{enabled:true,startedAt:start});
 const nickMissions=new Missions(nickGame),nickStats=name=>({source:'pixel_world_api',playerId:uuid,periods:{},clan:{source:'pixel_world_api',playerId:uuid,status:'found',id:41,name:'DMX',memberName:name,memberScore:0,updatedAt:now,observedFrom:now-1000}});
 const nickRow=stats=>nickMissions.rows(22,policy,{now,skinCount:5,stats}).find(r=>r.id==='nickname_dmx');
 assert.equal(nickRow(null).ready,false,'stored or Telegram nickname is not game proof');
 for(const name of ['DIAVOLO','ДМХ','ＤＭＸ','D M X',''])assert.equal(nickRow(nickStats(name)).ready,false);
 for(const name of ['DMX_ROLEX','[DMX] DIAVOLO','diavolo dMx'])assert.equal(nickRow(nickStats(name)).ready,true);
 for(const modify of [s=>s.source='client',s=>s.playerId='foreign',s=>s.clan.playerId='foreign',s=>s.clan.stale=true,s=>s.clan.updatedAt=now-90001,s=>s.clan.updatedAt=now+5001]){const s=nickStats('DMX_ROLEX');modify(s);assert.equal(nickRow(s).ready,false);}
 assert.equal(nickRow({source:'pixel_world_api',playerId:uuid,periods:{week:{playerId:uuid,name:'DMX_PLAYER',updatedAt:now}}}).ready,true,'verified public row works without a clan');
 let nickAwards=nickMissions.settle(22,policy,{now,skinCount:5,stats:nickStats('DMX_ROLEX'),groups:['once']});
 assert.equal(nickAwards.length,1);assert.equal(nickAwards[0].amount,50);assert.equal(nickAwards[0].skinBonusPercent,0);
 assert.deepEqual(Object.values(nickGame.awards)[0].skinBonus,{count:0,percent:0,amount:0});assert.equal(nickGame.rewards(22).balance,50);
 assert.equal(nickMissions.settle(22,policy,{now,skinCount:5,stats:nickStats('DMX_CHANGED')}).length,0);
 assert.equal(nickRow(nickStats('PLAYER')).claimed,true,'renaming again does not remove an issued award');
 nickGame.links[22].active=false;assert.equal(nickMissions.settle(22,policy,{now,stats:nickStats('DMX_ROLEX')}).length,0);nickGame.links[22].active=true;
 const restartedNickGame=new GameService(nickDir,async()=>{},async()=>{});
 assert.equal(new Missions(restartedNickGame).settle(22,policy,{now,skinCount:5,stats:nickStats('DMX_ROLEX')}).length,0);assert.equal(restartedNickGame.rewards(22).balance,50);
 // Subscription: signed user only, fixed amount, no game or skin bonus requirement.
 let status='left',botStatus='administrator',calls=0,clock=now;
 const api=async(method,input)=>{calls++;if(method==='getMe')return {id:999};assert.equal(input.chat_id,SUBSCRIPTION.chatId);return input.user_id===999?{status:botStatus}:{status,user:{id:input.user_id}};};
 const social=new TelegramQuest(game,'test',{api,clock:()=>clock});
 await assert.rejects(social.check(40,policy),/Подпишись/);assert.equal(game.rewards(40).balance,0);
 status='member';clock+=6000;const paid=await Promise.all([social.check(40,()=>policy),social.check(40,policy)]);
 assert.equal(paid[0].amount,100);assert.equal(game.rewards(40).balance,100);assert.equal(subscriptionBoard(game,40).claimed,true);
 const before=calls;assert.equal((await social.check(40,policy)).amount,0);assert.equal(calls,before,'paid state survives membership change without rechecking');
 botStatus='member';clock+=6000;await assert.rejects(social.check(41,policy),/недоступна/);assert.equal(game.rewards(41).balance,0);
 botStatus='administrator';status='kicked';clock+=6000;await assert.rejects(social.check(42,policy),/Подпишись/);
 await assert.rejects(social.check(43,{mode:'preview'}));
 const broken=new TelegramQuest(game,'test',{api:async()=>{throw Error('outage');}});await assert.rejects(broken.check(44,policy));assert.equal(game.rewards(44).balance,0);
 let paused=false;const changing=new TelegramQuest(game,'test',{api:async(method,input)=>{if(method==='getMe')return {id:999};if(input.user_id===999)return {status:'administrator'};paused=true;return {status:'member',user:{id:45}};}});
 await assert.rejects(changing.check(45,()=>({mode:paused?'preview':'open',pilotUserIds:[]})));assert.equal(game.rewards(45).balance,0,'policy is checked again after Telegram responds');
 console.log('Passed: mission launch boundary, UTC periods, nine daily goals/265 budget, distinct maps/clans, top-five map rates, retired medals, delayed results, restart/replay protection, all-game skin bonuses/rounding/legacy amounts; membership, nonmember/admin/outage/concurrency/pause checks with exact one-time 100 DMX.');
}finally{fs.rmSync(directory,{recursive:true,force:true});}

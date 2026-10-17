/* Shared battle timing and observed-score rules, also exercised by the UI checks. */
(() => {
 const valid=v=>Number.isSafeInteger(v)&&v>=0;
 function phase(map,now=Date.now()){
  if(!map||!valid(map.startsAt)||!valid(map.endsAt)||map.endsAt<=map.startsAt)return 'unknown';
  if(now>=map.endsAt)return 'expired';
  if(map.segment_type==='battle')return now>=map.startsAt?'live':'upcoming';
  return map.segment_type==='ownership'&&now>=map.startsAt?'ownership':'unknown';
 }
 function select(maps,preferred,now=Date.now()){
  const selected=maps.find(m=>m.map_id===preferred);if(selected)return selected;
  return [...maps].sort((a,b)=>{
   const priority=m=>phase(m,now)==='live'?0:['upcoming','ownership'].includes(phase(m,now))?1:2;
   return priority(a)-priority(b)||a.endsAt-b.endsAt;
  })[0]||null;
 }
 function homeMaps(maps,now=Date.now()){
  const live=maps.filter(m=>phase(m,now)==='live').sort((a,b)=>a.endsAt-b.endsAt||a.map_id.localeCompare(b.map_id));
  if(live.length)return live;
  const next=maps.map(map=>({map,start:phase(map,now)==='upcoming'?map.startsAt:phase(map,now)==='ownership'?(map.nextBattleStartsAt||map.endsAt):null}))
   .filter(row=>valid(row.start)&&row.start>now).sort((a,b)=>a.start-b.start||a.map.map_id.localeCompare(b.map.map_id));
  return next.length?[next[0].map]:[];
 }
 function contribution(stats,map,now=Date.now()){
  const clan=stats?.clan;
  const row=stats?.mapProgress?.battles?.find(b=>b.mapId===map?.map_id&&b.startsAt===map?.startsAt&&b.endsAt===map?.endsAt&&b.clanId===clan?.id);
  const available=phase(map,now)==='live'&&clan?.status==='found'&&clan.source==='pixel_world_api'&&!clan.stale&&row?.source==='clan_score_schedule_observation'&&valid(row.score)&&valid(row.updatedAt)&&now-row.updatedAt<=90000&&now-row.updatedAt>=-5000;
  const score=available?row.score:null;
  const pendingScore=(stats?.mapProgress?.pending||[]).filter(p=>p.clanId===clan?.id&&valid(p.score)&&p.candidates?.some(b=>b.mapId===map?.map_id&&b.startsAt===map?.startsAt&&b.endsAt===map?.endsAt)).reduce((sum,p)=>sum+p.score,0);
  return {score,pendingScore,available,observedSince:available?row.observedSince:null,target:score!==null&&score>=3000?3000:score!==null&&score>=2000?3000:score!==null&&score>=1000?2000:1000,completed:score!==null&&score>=3000};
 }
 function homeTimeline(maps,now=Date.now()){
  const upcoming=homeMaps(maps,now);
  if(upcoming.some(map=>phase(map,now)==='live'))return upcoming.map(map=>({kind:'live',map}));
  if(!maps.length)return [];
  const completed=maps.map(map=>{
   const battle=map.lastBattle;
   const end=valid(battle?.startsAt)&&valid(battle?.endsAt)&&battle.startsAt<battle.endsAt&&battle.endsAt<=now?battle.endsAt:phase(map,now)==='expired'&&map.segment_type==='battle'?map.endsAt:null;
   return {map,end};
  }).filter(row=>valid(row.end)).sort((a,b)=>b.end-a.end||a.map.map_id.localeCompare(b.map.map_id));
  return [{kind:'previous',map:completed[0]?.map||null},{kind:'upcoming',map:upcoming[0]||null}];
 }
 window.DMXLobby={phase,select,homeMaps,homeTimeline,contribution};
})();


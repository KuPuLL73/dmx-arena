const nonnegative=value=>Number.isSafeInteger(value)&&value>=0;
const positive=value=>Number.isSafeInteger(value)&&value>0;
const validMap=value=>typeof value==='string'&&/^[A-Za-z0-9_]+$/.test(value);
const validUuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function timestamp(value){if(typeof value!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(value))throw Error('Missing battle time');
 const result=Date.parse(value);if(!nonnegative(result))throw Error('Invalid battle time');return result;}
export class PixelWorldClient{
 constructor({fetch,token,clock=Date.now}){this.fetch=fetch;this.token=token;this.clock=clock;this.rosters=new Map();this.lastBattles=new Map();this.mapCache=null;}
 async request(path){
  const token=await this.token();if(typeof token!=='string'||!token)throw Error('Pixel World authorization required');
  const response=await this.fetch('https://release.pw.game/api/v2/'+path,{headers:{Accept:'application/json',Authorization:'Bearer '+token,Origin:'https://pw.game',Referer:'https://pw.game/'}});
  if(!response.ok)throw Error('Pixel World source unavailable');const result=await response.json();
  if(result?.ok!==true)throw Error('Pixel World API did not confirm the response');return result.data;
 }
 async roster(teamId,{force=false}={}){
  if(!positive(teamId))throw Error('Invalid clan ID');
  const cached=this.rosters.get(teamId);if(!force&&cached&&this.clock()-cached.updatedAt<20000)return cached;
  const observedFrom=this.clock(),team=(await this.request('team/'+teamId))?.team;
  if(team?.id!==teamId||typeof team.name!=='string'||!team.name||!Array.isArray(team.members)||team.members.length>10000)throw Error('Invalid public clan roster');
  const seen=new Set(),members=team.members.map(row=>{
   if(!validUuid(row?.id)||typeof row.username!=='string'||!row.username||!nonnegative(row.score)||seen.has(row.id.toLowerCase()))throw Error('Invalid roster member');
   seen.add(row.id.toLowerCase());return {playerId:row.id.toLowerCase(),name:row.username,score:row.score};
  });
  const result={id:teamId,name:team.name.slice(0,128),avatar:team.imgUrl||'',members,observedFrom,updatedAt:this.clock()};
  this.rosters.set(teamId,result);return result;
 }
 async battle(mapId){
  if(!validMap(mapId))throw Error('Invalid battle map');
  const board=(await this.request('stat/clan-wars/maps/'+mapId+'/leaderboard?limit=50&page=1'))?.leaderboard;
  if(board?.map_id!==mapId)throw Error('Battle map mismatch');
  const startsAt=timestamp(board.segment_started_at),endsAt=timestamp(board.segment_ends_at);
  if(endsAt<=startsAt||!Array.isArray(board.teams)||board.teams.length>50)throw Error('Invalid battle interval or ranking');
  const teams=board.teams.map(row=>{
   if(!positive(row?.team_id)||!nonnegative(row.points)||!positive(row.place)||typeof row.name!=='string')throw Error('Invalid battle score');
   return {id:row.team_id,name:row.name,score:row.points,rank:row.place,avatar:row.avatar||''};
  });
  return {mapId,startsAt,endsAt,teams,total:board.total??teams.length,updatedAt:this.clock(),source:'pixel_world_api'};
 }
 async maps(){
  if(this.mapCache&&this.clock()-this.mapCache.updatedAt<20000)return this.mapCache;
  const maps=(await this.request('stat/clan-wars/maps'))?.maps;
  if(!Array.isArray(maps)||maps.length>100)throw Error('Invalid clan maps');
  const seen=new Set(),result=[];
  for(const original of maps){
   if(!validMap(original?.map_id)||seen.has(original.map_id)||!['battle','ownership'].includes(original.segment_type))throw Error('Invalid clan map');
   seen.add(original.map_id);const startsAt=timestamp(original.segment_started_at),endsAt=timestamp(original.segment_ends_at);
   if(endsAt<=startsAt)throw Error('Invalid map interval');
   result.push({...original,startsAt,endsAt});
  }
  // Keep the four-minute late-match window and 90-second observation margin.
  for(let offset=0;offset<result.length;offset+=4)await Promise.all(result.slice(offset,offset+4).map(async row=>{
   const old=this.lastBattles.get(row.map_id),finalizing=old&&old.data.updatedAt<old.data.endsAt+330000;
   if(!old||old.segmentKey!==row.segment_started_at||row.segment_type==='battle'||finalizing)
    try{this.lastBattles.set(row.map_id,{segmentKey:row.segment_started_at,data:await this.battle(row.map_id)});}catch{}
   row.lastBattle=this.lastBattles.get(row.map_id)?.data||null;
   row.nextBattleStartsAt=row.segment_type==='ownership'?row.endsAt:null;
  }));
  this.mapCache={maps:result,updatedAt:this.clock(),source:'pixel_world_api'};return this.mapCache;
 }
 async playerPage(period,page){
  if(!['day','week','month'].includes(period)||!positive(page))throw Error('Invalid leaderboard request');
  const board=(await this.request('stat/leaderboard/players?range='+period+'&limit=50&page='+page))?.leaderboard,list=board?.list;
  if(board?.range!==period||list?.page!==page||!nonnegative(list.total)||list.total>100000||!Array.isArray(list.players)||list.players.length>50)throw Error('Invalid player pagination');
  return {total:list.total,players:list.players.map(row=>{
   if(!validUuid(row?.uuid)||!positive(row.place)||!nonnegative(row.points)||typeof row.nickname!=='string'||!row.nickname.trim()||row.nickname.length>128)throw Error('Invalid public player');
   return {playerId:row.uuid.toLowerCase(),name:row.nickname,rank:row.place,score:row.points,avatar:typeof row.image_url==='string'&&row.image_url.startsWith('https://')?row.image_url:''};
  })};
 }
 async clanPage(page){
  if(!positive(page))throw Error('Invalid clan page');
  const board=(await this.request('stat/leaderboard/teams?range=month&limit=50&page='+page))?.leaderboard,list=board?.list;
  if(board?.range!=='month'||list?.page!==page||!nonnegative(list.total)||list.total>5000||!Array.isArray(list.teams)||list.teams.length>50)throw Error('Invalid clan pagination');
  const teams=list.teams.filter(row=>row?.deleted!==true).map(row=>{if(!positive(row.team_id))throw Error('Invalid clan ID');return row.team_id;});
  return {total:list.total,teams};
 }
}

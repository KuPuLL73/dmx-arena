// Same source contracts as public_game.py / clan_data.py, with resumable searches.
const periods=['day','week','month'];
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class PublicGameData{
 constructor(client,{state={},clock=Date.now,changed=()=>{},background=()=>{}}={}){
  this.client=client;this.state=state;this.clock=clock;this.changed=changed;this.background=background;
  state.players??={};state.clans??={};state.playerJobs??={};state.clanJobs??={};this.pending=new Map();
 }
 uuid(value){if(typeof value!=='string'||!uuidPattern.test(value))throw Error('Invalid game UUID');return value.toLowerCase();}
 launch(key,callback){
  if(this.pending.has(key))return;
  const job=callback().catch(()=>{}).finally(()=>{this.pending.delete(key);this.changed(this.state);});
  this.pending.set(key,job);this.background(job);
 }
 async playerSearch(uuid,period){
  const key=period+':'+uuid,prior=this.state.players[key],job=this.state.playerJobs[key];
  try{
   const preferred=[prior?.page||1,...periods.map(p=>this.state.players[p+':'+uuid]?.page).filter(Boolean)];
   const pages=job.started?Array.from({length:job.total},(_,i)=>i+1).filter(page=>!job.seen.includes(page)).slice(0,4):[...new Set(preferred)];
   if(!pages.length){this.state.players[key]={status:'not_listed',player:null,period,updatedAt:this.clock()};job.status='not_listed';return;}
   const found=await Promise.all(pages.map(async page=>({page,...await this.client.playerPage(period,page)})));
   for(const result of found){
    job.total=Math.max(1,Math.ceil(result.total/50));job.seen??=[];if(!job.seen.includes(result.page))job.seen.push(result.page);
    const player=result.players.find(row=>row.playerId===uuid);
    if(player){this.state.players[key]={status:'found',player,page:result.page,updatedAt:this.clock(),period};job.status='found';return;}
   }
   job.started=true;job.next=1;while(job.seen.includes(job.next))job.next++;
   job.done=job.seen.length;
   if(job.next>job.total){this.state.players[key]={status:'not_listed',player:null,period,updatedAt:this.clock()};job.status='not_listed';}
  }catch{job.status='error';job.startedAt=this.clock();}
 }
 async clanSearch(uuid){
  const job=this.state.clanJobs[uuid],prior=this.state.clans[uuid];
  try{
   const maps=await this.client.maps();
   const primary=[prior?.id,41,...maps.maps.map(row=>row.owner?.id)].filter(id=>Number.isSafeInteger(id)&&id>0);
   job.seen??=[];let candidates=[...new Set(primary)].filter(id=>!job.seen.includes(id));
   if(!candidates.length)candidates=(job.remaining||[]).filter(id=>!job.seen.includes(id));
   if(!candidates.length){
    job.page??=1;
    if(job.maximum===undefined||job.page<=job.maximum){
     const page=await this.client.clanPage(job.page);
     job.maximum=Math.max(1,Math.ceil(page.total/50));job.page++;
     candidates=[...new Set(page.teams)].filter(id=>!job.seen.includes(id));
    }
   }
   const batch=candidates.slice(0,4);job.remaining=candidates.slice(4);
   const rosters=await Promise.all(batch.map(id=>this.client.roster(id)));
   for(const roster of rosters){
    job.seen.push(roster.id);const member=roster.members.find(row=>row.playerId===uuid);
    if(member){
     this.state.clans[uuid]={status:'found',playerId:uuid,id:roster.id,name:roster.name,avatar:roster.avatar,
      memberName:member.name,memberScore:member.score,observedFrom:roster.observedFrom,updatedAt:roster.updatedAt,source:'pixel_world_api'};
     job.status='found';return;
    }
   }
   if(!batch.length&&job.page>job.maximum){this.state.clans[uuid]={status:'not_found',playerId:uuid,updatedAt:this.clock(),source:'pixel_world_api'};job.status='not_found';}
  }catch{job.status='error';job.startedAt=this.clock();}
 }
 async clan(value,force=false){
  const uuid=this.uuid(value),now=this.clock(),prior=this.state.clans[uuid];let job=this.state.clanJobs[uuid];
  // A shared fresh roster supplies the same observation to all clan members.
  const roster=prior?.id?this.client.rosters.get(prior.id):null;
  if(roster&&now-roster.updatedAt<20000&&roster.updatedAt>=prior.updatedAt){
   const member=roster.members.find(row=>row.playerId===uuid);
   if(member){const result={...prior,memberName:member.name,memberScore:member.score,observedFrom:roster.observedFrom,updatedAt:roster.updatedAt,stale:false,refreshStatus:'found'};this.state.clans[uuid]=result;return result;}
  }
  if(job?.status!=='searching'&&(force||!prior||now-prior.updatedAt>=45000)&&!(job?.status==='error'&&now-job.startedAt<10000&&!force)){
   if(Object.values(this.state.clanJobs).filter(row=>row.status==='searching').length>=8)return {status:'error'};
   job={status:'searching',startedAt:now};this.state.clanJobs[uuid]=job;
  }
  if(job?.status==='searching'){
   this.launch('clan:'+uuid,()=>this.clanSearch(uuid));
   // The usual prior/DMX roster lookup completes in the current invocation.
   await this.pending.get('clan:'+uuid);
  }
  const current=this.state.clans[uuid];job=this.state.clanJobs[uuid];
  return current?.status==='found'?{...current,stale:['searching','error'].includes(job?.status),refreshStatus:job?.status}
   :{status:job?.status||current?.status||'searching',playerId:uuid,source:'pixel_world_api'};
 }
 async lookup(value,force=false){
  const uuid=this.uuid(value),now=this.clock();
  if(Object.values(this.state.playerJobs).filter(row=>row.status==='searching').length>=24&&!periods.some(period=>this.state.playerJobs[period+':'+uuid]?.status==='searching'))throw Error('Public game search queue is full');
  for(const period of periods){
   const key=period+':'+uuid,prior=this.state.players[key];let job=this.state.playerJobs[key];
   if(job?.status!=='searching'&&(force||!prior||now-prior.updatedAt>=45000)&&!(job?.status==='error'&&now-job.startedAt<10000&&!force)){
    job={status:'searching',startedAt:now,done:0,total:null};this.state.playerJobs[key]=job;
   }
   if(job?.status==='searching')this.launch(key,()=>this.playerSearch(uuid,period));
  }
  const clan=await this.clan(uuid,force),rows={},progress={};
  for(const period of periods){const key=period+':'+uuid,row=this.state.players[key],job=this.state.playerJobs[key];
   rows[period]=row?.status==='found'?{...row.player,updatedAt:row.updatedAt,stale:['searching','error'].includes(job?.status)}:null;
   progress[period]=job?{status:job.status,done:job.done??null,total:job.total??null}:{status:row?.status||'searching'};
  }
  const player=Object.values(rows).filter(Boolean).sort((a,b)=>b.updatedAt-a.updatedAt)[0];
  const status=clan.status==='found'||player?'found':Object.values(progress).some(row=>row.status==='searching')||clan.status==='searching'?'searching':Object.values(progress).some(row=>row.status==='error')?'error':'not_listed';
  return {playerId:uuid,name:player?.name||clan.memberName||null,avatar:player?.avatar||null,status,periods:rows,progress,clan,updatedAt:now,source:'pixel_world_api'};
 }
}

import {AsyncLocalStorage} from 'node:async_hooks';
import {GameAuthorization} from './game-auth.js';
import {NotGamesClient} from '../../tgcloud/lib/connector/notgames.js';
import {PixelWorldClient} from '../../tgcloud/lib/connector/pixel-world.js';
import {PublicGameData} from './public-game.js';
import {sqliteFiles,withFiles} from './storage.js';
import {createApplication} from '../generated/application.js';
import {authorized,bridgeRequest,receiptApi,bootstrapFiles} from './protocol.js';
const receipts=new AsyncLocalStorage();
function json(status,value){return Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
async function body(request,limit){
 const reader=request.body?.getReader();if(!reader)throw Error('Request missing');
 let size=0;const parts=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)throw Error('Request too large');parts.push(Buffer.from(value));}}
 finally{reader.releaseLock();}
 return JSON.parse(Buffer.concat(parts).toString('utf8'));
}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/healthz'&&request.method==='GET')return json(200,{ok:true,service:'dmx-js-connector',stage:'application'});
  const supported=['/check','/bridge','/admin/init','/admin/status','/admin/activate','/admin/export'];
  if(!supported.includes(url.pathname)||request.method!=='POST')return json(404,{error:'Not found'});
  const key=url.pathname.startsWith('/admin/')?env.DEPLOY_KEY:env.PROBE_KEY;
  if(!authorized(request,key))return json(403,{error:'Forbidden'});
  return env.CONNECTOR.get(env.CONNECTOR.idFromName('primary')).fetch(request);
 }
};
export class GameConnector{
 constructor(ctx,env){
  this.ctx=ctx;this.env=env;this.queue=Promise.resolve();this.rate=new Map();
  this.ready=ctx.blockConcurrencyWhile(async()=>{
   const http=(url,options={})=>fetch(url,{...options,signal:options.signal||AbortSignal.timeout(30000)});
   this.auth=new GameAuthorization({fetch:http,credentials:{session:env.OPERATOR_SESSION,apiId:Number(env.TELEGRAM_API_ID),apiHash:env.TELEGRAM_API_HASH},state:await ctx.storage.get('game-auth')||{}});
   this.savedAuth=JSON.stringify(this.auth.state);
   this.inventory=new NotGamesClient({fetch:http,token:()=>this.auth.token('notgames')});
   this.game=new PixelWorldClient({fetch:http,token:()=>this.auth.token('pixelworld')});
   this.files=sqliteFiles(ctx.storage);
   const cached=this.files.get('/data/connector-public-cache.json');
   const searchState=cached?JSON.parse(cached):await ctx.storage.get('public-searches')||{};
   if(!cached){this.files.set('/data/connector-public-cache.json',JSON.stringify(searchState));this.files.flush();await ctx.storage.delete('public-searches');}
   this.publicGame=new PublicGameData(this.game,{state:searchState,
    changed:state=>{const snapshot=JSON.stringify(state);ctx.waitUntil(this.serialized(async()=>{this.files.set('/data/connector-public-cache.json',snapshot);this.files.flush();}));},background:job=>ctx.waitUntil(job)});
   if(this.files.get('/data/launch-manifest.json'))this.build();
  });
 }
 build(){
  const connector=async input=>{
   if(input.kind==='inventory')return this.inventory.inventory(input.userId,{force:input.force});
   if(input.kind==='lookupPlayer')return this.publicGame.lookup(input.playerId,input.force);
   if(input.kind==='clanPlayer')return this.publicGame.clan(input.playerId,input.force);
   if(input.kind==='clanWars')return this.game.maps();
   throw Error('Unsupported game operation');
  };
  this.app=withFiles(this.files,()=>createApplication({connector,telegramApi:(method,input)=>{
   const context=receipts.getStore();return receiptApi(context?.receipt,context?.userId)(method,input);
  }}));this.files.flush();
 }
 serialized(callback){const job=this.queue.then(callback,callback);this.queue=job.catch(()=>{});return job;}
 read(name,fallback={}){const data=this.files.get('/data/'+name);return data===undefined?fallback:JSON.parse(data);}
 async persist(){this.files.flush();const serialized=JSON.stringify(this.auth.state);if(serialized!==this.savedAuth){await this.ctx.storage.put('game-auth',this.auth.state);this.savedAuth=serialized;}}
 async observe(){
  if(!this.app)return;
  try{await withFiles(this.files,()=>this.app.monitor());await this.ctx.storage.put('last-monitor',{at:Date.now(),error:false});}
  catch{await this.ctx.storage.put('last-monitor',{at:Date.now(),error:true});}
  finally{await this.persist();}
 }
 async status(){
  const profiles=this.read('profiles.json'),links=this.read('game-links.json'),awards=this.read('game-awards.json'),progress=this.read('game-map-progress.json'),manifest=this.read('launch-manifest.json');
  const active=Object.values(links).filter(row=>row.active!==false);
  const pending=active.filter(row=>!progress[row.playerId]?.last||progress[row.playerId].last.updatedAt<manifest.preparedAt||Date.now()-progress[row.playerId].last.updatedAt>90000);
  return {initialized:!!this.app,mode:this.read('quest-launch.json').mode||'preview',profiles:Object.keys(profiles).length,linkedPlayers:active.length,awards:Object.keys(awards).length,balance:Object.values(awards).reduce((sum,row)=>sum+row.amount,0),pendingBaselines:pending.length,manifest,monitor:await this.ctx.storage.get('last-monitor')||null,storage:this.files.diagnostics()};
 }
 async fetch(request){
  const path=new URL(request.url).pathname;
  if(!authorized(request,path.startsWith('/admin/')?this.env.DEPLOY_KEY:this.env.PROBE_KEY))return json(403,{error:'Forbidden'});
  await this.ready;
  return this.serialized(async()=>{
   try{
    if(path==='/check'){
     const items=await this.inventory.inventory(900000001),clan=await this.game.roster(41),maps=await this.game.maps();
     return json(200,{ok:true,pythonUsed:false,inventoryItems:items.length,clanId:clan.id,maps:maps.maps.length});
    }
    if(path==='/admin/init'){
     if(this.read('launch-manifest.json').activatedAt)throw Error('Live launch already activated; reset is disabled');
     const files=bootstrapFiles(await body(request,5*1024*1024));
     await Promise.allSettled([...this.publicGame.pending.values()]);
     this.files.clear();this.game.rosters.clear();this.game.mapCache=null;
     for(const [name,value] of Object.entries(files))this.files.set('/data/'+name,JSON.stringify(value));
     this.files.flush();this.publicGame.state={players:{},clans:{},playerJobs:{},clanJobs:{}};
     this.files.set('/data/connector-public-cache.json',JSON.stringify(this.publicGame.state));this.files.flush();
     this.build();await this.observe();await this.ctx.storage.setAlarm(Date.now()+20000);
     return json(200,await this.status());
    }
    if(path==='/admin/status')return json(200,await this.status());
    if(path==='/admin/export')return json(200,{files:this.files.export()});
    if(path==='/admin/activate'){
     if(!this.app)throw Error('Launch candidate is missing');
     if(this.read('launch-manifest.json').activatedAt)return json(200,await this.status());
     if(Date.now()-this.read('launch-manifest.json').preparedAt>600000)throw Error('Prepare a fresh launch candidate');
     await this.observe();const status=await this.status();
     if(status.pendingBaselines||status.awards||status.balance)throw Error('Fresh zero-balance baseline is required');
     const manifest={...status.manifest,status:'live',claimsEnabled:true,activatedAt:Date.now()};
     this.files.set('/data/quest-launch.json',JSON.stringify({version:'battle-ladder-v1',mode:'open',pilotUserIds:[]}));
     this.files.set('/data/launch-manifest.json',JSON.stringify(manifest));this.files.flush();
     return json(200,await this.status());
    }
    if(path==='/bridge'){
     if(!this.app)return json(503,{error:'Арена готовится к запуску. Попробуй чуть позже.'});
     const input=bridgeRequest(await body(request,49152));
     const now=Date.now(),old=this.rate.get(input.user.id),rate=old&&now-old.since<60000?old:{since:now,count:0};
     if(++rate.count>90)return json(429,{error:'Слишком много запросов. Попробуй через минуту.'});
     this.rate.set(input.user.id,rate);if(this.rate.size>2000)for(const [id,row] of this.rate)if(now-row.since>60000)this.rate.delete(id);
     const result=await receipts.run({receipt:input.receipt,userId:input.user.id},()=>withFiles(this.files,()=>this.app.handle(input.action,input.input,input.user)));
     return json(result.status,result.data);
    }
    return json(404,{error:'Not found'});
   }catch(error){
    const safe=['Invalid launch files','Invalid launch file data','Invalid clean launch profile','Launch candidate is outdated','Fresh zero-balance baseline is required','Prepare a fresh launch candidate','Live launch already activated; reset is disabled','Launch candidate is missing','Invalid action','Invalid verified identity'];
    return json(503,{error:safe.includes(error?.message)?error.message:'Не удалось получить игровые данные. Попробуй чуть позже.'});
   }finally{await this.persist();}
  });
 }
 async alarm(){
  await this.ready;
  await this.serialized(async()=>{try{await this.observe();}finally{if(this.app)await this.ctx.storage.setAlarm(Date.now()+20000);}});
 }
}

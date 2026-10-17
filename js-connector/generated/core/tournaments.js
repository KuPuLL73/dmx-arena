// Generated from the preserved Node/Python application.
import fs from '../../src/storage.js';
import path from 'node:path';
import crypto from 'node:crypto';
import {playerId} from './domain.js';

function fail(message,status=400){throw Object.assign(Error(message),{status});}
function text(value,max,label){if(typeof value!=='string'||!value.trim()||value.trim().length>max)fail(label);return value.trim();}
const integer=value=>Number.isSafeInteger(value)&&value>=0;
export function organizerIds(value=''){
 const values=value.split(',').map(v=>v.trim()).filter(Boolean);
 if(values.some(v=>!/^\d+$/.test(v)||!Number.isSafeInteger(Number(v))||Number(v)<=0))throw Error('Неверный список организаторов DMX.');
 return new Set(values.map(Number));
}

// Single-process, free-entry pilot. No balance reservations or rewards are issued here.
export class Tournaments {
 constructor(directory,{organizers=new Set(),openCreation=false}={}){
  this.file=path.join(directory,'tournaments.json');this.organizers=organizers;this.openCreation=openCreation;
  try{this.rows=JSON.parse(fs.readFileSync(this.file,'utf8'));if(!this.rows||Array.isArray(this.rows)||typeof this.rows!=='object')throw Error();}
  catch(error){if(error.code==='ENOENT')this.rows={};else throw Error('Хранилище турниров требует восстановления.');}
 }
 canCreate(user){return !!user&&Number.isSafeInteger(user.id)&&(this.openCreation||this.organizers.has(user.id));}
 requireLink(user,link){if(!Number.isSafeInteger(user?.id)||user.id<=0||!link||link.active===false||link.telegramId!==user.id||link.dataVerified!==true)fail('Сначала подключи игровой ID в профиле.');playerId(link.playerId);}
 get(id){if(typeof id!=='string'||!Object.hasOwn(this.rows,id))fail('Турнир не найден.',404);return this.rows[id];}
 change(id,operation){const row=structuredClone(this.get(id));operation(row);row.updatedAt=Date.now();this.commit({...this.rows,[id]:row});return row;}
 commit(next){fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file+'.tmp',JSON.stringify(next),{mode:0o600});fs.renameSync(this.file+'.tmp',this.file);this.rows=next;}
 owner(row,user){if(!this.canCreate(user)||row.organizerId!==user.id)fail('Это действие доступно организатору турнира.',403);}
 create(user,link,input){
  if(!this.canCreate(user))fail('Создание турниров доступно организатору.',403);this.requireLink(user,link);
  if(![4,8].includes(input.capacity))fail('Выбери 4 или 8 участников.');
  if(![1,2].includes(input.concurrentRooms))fail('Одновременно доступны 1 или 2 комнаты.');
  if(Object.values(this.rows).filter(row=>row.organizerId===user.id&&['registration','live'].includes(row.status)).length>=3)fail('Сначала заверши один из своих турниров.');
  if(Object.keys(this.rows).length>=200)fail('Достигнут лимит турниров тестового запуска.');
  const row={id:crypto.randomUUID(),organizerId:user.id,organizerName:link.name,title:text(input.title,60,'Название: от 1 до 60 символов.'),map:text(input.map,64,'Укажи карту до 64 символов.'),rules:text(input.rules,1000,'Укажи правила до 1000 символов.'),capacity:input.capacity,concurrentRooms:input.concurrentRooms,status:'registration',entryFee:0,rewardsEnabled:false,participants:[],rounds:[],createdAt:Date.now(),updatedAt:Date.now(),champion:null};
  this.commit({...this.rows,[row.id]:row});return row;
 }
 join(id,user,link){this.requireLink(user,link);return this.change(id,row=>{
  if(row.status!=='registration')fail('Регистрация уже закрыта.');
  if(row.participants.some(p=>p.telegramId===user.id||p.playerId===link.playerId))fail('Ты уже участвуешь в этом турнире.');
  if(row.participants.length>=row.capacity)fail('Все места заняты.');
  const competing=Object.values(this.rows).some(other=>other.id!==id&&other.status==='live'&&other.participants.some(p=>p.telegramId===user.id||p.playerId===link.playerId));
  if(competing)fail('Сначала заверши текущий турнир.');
  row.participants.push({id:crypto.randomUUID(),telegramId:user.id,playerId:link.playerId,name:link.name,joinedAt:Date.now()});
 });}
 leave(id,user){return this.change(id,row=>{if(row.status!=='registration')fail('После старта выйти из сетки нельзя. Свяжись с организатором.');const index=row.participants.findIndex(p=>p.telegramId===user.id);if(index<0)fail('Ты не зарегистрирован.');row.participants.splice(index,1);});}
 start(id,user){return this.change(id,row=>{
  this.owner(row,user);if(row.status!=='registration')fail('Турнир уже запущен или закрыт.');
  if(row.participants.length!==row.capacity)fail('Для старта нужны все '+row.capacity+' участников.');
  if(row.participants.some(p=>Object.values(this.rows).some(other=>other.id!==id&&other.status==='live'&&other.participants.some(q=>q.telegramId===p.telegramId||q.playerId===p.playerId))))fail('Один из участников ещё играет в другом турнире.');
  const shuffled=[...row.participants];for(let i=shuffled.length-1;i>0;i--){const j=crypto.randomInt(i+1);[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
  for(let count=row.capacity/2,r=0;count>=1;count/=2,r++)row.rounds.push(Array.from({length:count},(_,i)=>({id:crypto.randomUUID(),players:r===0?[shuffled[i*2].id,shuffled[i*2+1].id]:[null,null],status:'pending',ready:[],roomCode:null,result:null})));
  row.status='live';row.startedAt=Date.now();
 });}
 match(row,id){for(let r=0;r<row.rounds.length;r++){const index=row.rounds[r].findIndex(m=>m.id===id);if(index>=0)return {match:row.rounds[r][index],round:r,index};}fail('Матч не найден.',404);}
 room(id,user,matchId,code){return this.change(id,row=>{
  this.owner(row,user);if(row.status!=='live')fail('Турнир сейчас не идёт.');const {match}=this.match(row,matchId);
  if(match.status==='done'||!match.players.every(Boolean))fail('Сначала дождись обоих участников этой пары.');
  const roomCode=text(code,64,'Введи код закрытой комнаты.');if(!/^[a-z0-9_-]{3,64}$/i.test(roomCode))fail('Код комнаты: латинские буквы, цифры, дефис или подчёркивание.');
  if(row.rounds.flat().some(m=>m.id!==matchId&&m.status==='room'&&m.roomCode===roomCode))fail('Эта комната уже используется другой парой.');
  if(match.status!=='room'&&row.rounds.flat().filter(m=>m.status==='room').length>=row.concurrentRooms)fail('Достигнут лимит одновременно активных комнат.');
  match.roomCode=roomCode;match.status='room';match.ready=[];
 });}
 ready(id,user,link,matchId){this.requireLink(user,link);return this.change(id,row=>{
  if(row.status!=='live')fail('Турнир сейчас не идёт.');const {match}=this.match(row,matchId),self=row.participants.find(p=>p.telegramId===user.id&&p.playerId===link.playerId);
  if(!self||!match.players.includes(self.id))fail('Это матч другой пары.',403);
  if(match.status!=='room')fail('Организатор ещё не назначил комнату.');if(!match.ready.includes(self.id))match.ready.push(self.id);
 });}
 result(id,user,matchId,input){return this.change(id,row=>{
  this.owner(row,user);if(row.status!=='live')fail('Турнир сейчас не идёт.');const {match,round,index}=this.match(row,matchId);
  if(match.status==='done')fail('Результат уже зафиксирован.');if(!match.players.every(Boolean))fail('Сначала дождись обоих участников.');
  if(!match.players.includes(input.winnerId))fail('Победителем может быть только участник этой пары.');
  const note=text(input.note,500,'Добавь пояснение к результату до 500 символов.');
  if(!['score','forfeit'].includes(input.kind))fail('Выбери результат боя или техническую победу.');
  let scores=null;if(input.kind==='score'){
   if(match.status!=='room'||match.ready.length!==2)fail('Сначала назначь комнату и дождись готовности обоих игроков.');
   if(!Array.isArray(input.scores)||input.scores.length!==2||input.scores.some(n=>!integer(n)||n>1000000))fail('Укажи два целых неотрицательных счёта.');
   if(input.scores[0]===input.scores[1])fail('При ничьей нужен переигранный матч.');
   if(match.players[input.scores[0]>input.scores[1]?0:1]!==input.winnerId)fail('Победитель не совпадает со счётом.');scores=input.scores;
  }
  match.result={winnerId:input.winnerId,kind:input.kind,scores,note,source:'organizer',confirmedAt:Date.now()};match.status='done';match.roomCode=null;
  if(round===row.rounds.length-1){row.status='completed';row.champion=input.winnerId;row.completedAt=Date.now();}
  else row.rounds[round+1][Math.floor(index/2)].players[index%2]=input.winnerId;
 });}
 cancel(id,user){return this.change(id,row=>{this.owner(row,user);if(!['registration','live'].includes(row.status))fail('Турнир уже закрыт.');row.status='cancelled';row.cancelledAt=Date.now();for(const match of row.rounds.flat()){match.roomCode=null;match.ready=[];}});}
 view(row,user=null){
  const organizer=this.canCreate(user)&&row.organizerId===user?.id,self=row.participants.find(p=>p.telegramId===user?.id);
  return {id:row.id,title:row.title,map:row.map,rules:row.rules,capacity:row.capacity,concurrentRooms:row.concurrentRooms,status:row.status,organizerName:row.organizerName,entryFee:0,rewardsEnabled:false,createdAt:row.createdAt,updatedAt:row.updatedAt,champion:row.champion,isOrganizer:organizer,selfId:self?.id||null,
   participants:row.participants.map(p=>({id:p.id,name:p.name})),rounds:row.rounds.map(matches=>matches.map(m=>({id:m.id,players:m.players,status:m.status,ready:m.ready,result:m.result,roomCode:row.status==='live'&&(organizer||self&&m.players.includes(self.id))?m.roomCode:null})))};
 }
 list(){return Object.values(this.rows).sort((a,b)=>Number(['registration','live'].includes(b.status))-Number(['registration','live'].includes(a.status))||b.createdAt-a.createdAt).slice(0,64).map(row=>this.view(row));}
}

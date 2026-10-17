'use strict';
let tournamentRows=[],tournamentLoading=false,tournamentError='',tournamentRequest=0,tournamentBusy=false,tournamentDetailId=null;
const tournamentStatus={registration:'Регистрация',live:'Идёт турнир',completed:'Завершён',cancelled:'Отменён'};
const tournamentName=(row,id)=>row.participants.find(p=>p.id===id)?.name||'Ожидаем победителя';
async function loadTournaments(silent=false){
 const request=++tournamentRequest;if(!silent){tournamentLoading=true;tournamentError='';render();}
 try{const result=await DMXApi.call('getTournaments');if(request!==tournamentRequest)return;tournamentRows=result.tournaments||[];tournamentError='';}
 catch(error){if(request!==tournamentRequest)return;tournamentError=error.message;}
 finally{if(request===tournamentRequest){tournamentLoading=false;if(page==='tournaments')render();}}
}
function tournamentPage(){
 return title('DMX ARENA','Турниры','Закрытые комнаты · дуэли 1×1 · игра на выбывание.')+
 '<div class="filters">'+(account?.permissions?.canCreateTournament?'<button class="active" data-create-tournament>+ Создать турнир</button>':'')+'<button data-refresh-tournaments '+(tournamentLoading?'disabled':'')+'>Обновить</button><span class="tag">ВХОД БЕСПЛАТНЫЙ</span></div>'+
 (tournamentLoading?'<div class="empty-state compact"><p>Загружаю турниры…</p></div>':tournamentError?'<div class="empty-state"><p>'+esc(tournamentError)+'</p><button class="secondary" data-refresh-tournaments>Попробовать снова</button></div>':tournamentRows.length?'<div class="tournament-grid">'+tournamentRows.map(row=>'<article class="tournament-card"><div class="set-heading"><b>'+esc(row.title)+'</b><span class="tag">'+tournamentStatus[row.status]+'</span></div><p>'+esc(row.map)+' · 1×1</p><div class="tournament-meta"><span>'+row.participants.length+' / '+row.capacity+' участников</span><span>'+row.concurrentRooms+' комн. одновременно</span></div>'+(row.champion?'<p class="tournament-winner">Победитель: '+esc(tournamentName(row,row.champion))+'</p>':'')+'<button class="secondary" data-open-tournament="'+esc(row.id)+'">'+(row.status==='registration'?'Участники и регистрация':'Открыть сетку')+'</button></article>').join('')+'</div>':'<div class="empty-state">'+svg('trophy')+'<h3>Первый кубок впереди</h3><p>Здесь появятся турниры организатора. Подключи игровой ID в профиле, чтобы записаться.</p><button class="secondary" data-go="profile">Мой профиль</button></div>')+
 notice('Пилотные турниры проходят без вступительных взносов. Размеры призов DMX определим вместе с экономикой. Результаты подтверждает организатор.');
}
function showTournament(row){
 const active=['registration','live'].includes(row.status);
 let html='<h2 class="modal-title">'+esc(row.title)+'</h2><p class="modal-subtitle">'+esc(row.map)+' · '+tournamentStatus[row.status]+' · '+row.participants.length+' / '+row.capacity+' участников</p><p class="tournament-rules">'+esc(row.rules)+'</p><p class="data-time">Организатор: '+esc(row.organizerName)+' · Вход бесплатный</p>';
 if(row.champion)html+='<div class="tournament-champion">'+svg('trophy')+'<span>Победитель<b>'+esc(tournamentName(row,row.champion))+'</b></span></div>';
 if(row.status==='registration'){
  html+='<div class="tournament-participants">'+row.participants.map((p,i)=>'<div><span>'+String(i+1).padStart(2,'0')+'</span><b>'+esc(p.name)+'</b>'+(p.id===row.selfId?'<small>Ты</small>':'')+'</div>').join('')+(row.participants.length?'':'<p>Пока никто не записался.</p>')+'</div>';
  if(row.selfId)html+='<p class="modal-subtitle">Ты зарегистрирован. Перед стартом можно выйти.</p><button class="secondary" data-leave-tournament="'+row.id+'">Выйти из турнира</button>';
  else if(account?.link&&row.participants.length<row.capacity)html+='<button class="primary" data-join-tournament="'+row.id+'">Участвовать</button>';
  else if(!account?.link)html+='<p class="modal-subtitle">Для участия подключи игровой ID в профиле.</p>';
  if(row.isOrganizer)html+='<div class="tournament-controls"><button class="primary" data-start-tournament="'+row.id+'" '+(row.participants.length!==row.capacity?'disabled':'')+'>Сформировать сетку и начать</button><small>Старт, когда заняты все '+row.capacity+' мест. Пары определяются случайно.</small></div>';
 }else if(row.rounds.length){
  html+='<div class="tournament-bracket">'+row.rounds.map((matches,r)=>'<section><h3>'+(['Финал','Полуфинал','Четвертьфинал'][row.rounds.length-r-1]||'Раунд '+(r+1))+'</h3>'+matches.map((match,i)=>{
   const mine=row.selfId&&match.players.includes(row.selfId),done=match.status==='done',ready=match.ready.includes(row.selfId);
   return '<article class="duel-card"><small>МАТЧ '+(i+1)+' · '+(done?'Завершён':match.status==='room'?'Комната назначена':'Ожидание')+'</small>'+match.players.map((id,p)=>'<div class="duel-player '+(match.result?.winnerId===id?'winner':'')+'"><b>'+esc(tournamentName(row,id))+'</b><span>'+(match.result?.scores?number(match.result.scores[p]):'—')+'</span></div>').join('')+
    (match.roomCode?'<div class="duel-room"><span>Код комнаты</span><code>'+esc(match.roomCode)+'</code><small>Введи его в закрытых матчах Pixel World.</small></div>':'')+
    (match.status==='room'&&active?'<p class="duel-note">Готовы: '+match.ready.length+' / 2'+(mine&&ready?' · Ты готов':'')+'</p>':'')+
    (mine&&match.status==='room'&&!ready&&active?'<button class="primary" data-tournament-ready="'+match.id+'" data-tournament-id="'+row.id+'">Я готов к бою</button>':'')+
    (row.isOrganizer&&!done&&match.players.every(Boolean)&&active?'<div class="duel-actions"><button class="secondary" data-tournament-room="'+match.id+'" data-tournament-id="'+row.id+'">'+(match.roomCode?'Изменить комнату':'Назначить комнату')+'</button><button class="secondary" data-tournament-result="'+match.id+'" data-tournament-id="'+row.id+'">Зафиксировать результат</button></div>':'')+
    (match.result?'<p class="duel-note">'+(match.result.kind==='forfeit'?'Техническая победа. ':'')+'Подтверждено организатором.</p><p class="duel-note">'+esc(match.result.note)+'</p>':'')+'</article>';
  }).join('')+'</section>').join('')+'</div>';
 }
 if(row.isOrganizer&&active)html+='<button class="text-button" data-cancel-tournament="'+row.id+'">Отменить турнир</button>';
 modal('DMX ARENA',html,[{label:'Обновить',secondary:true,run:()=>openTournament(row.id)},{label:'Готово',secondary:true,run:()=>$('#dialog').close()}]);tournamentDetailId=row.id;
}
async function openTournament(id,poll=false){
 try{const row=account?await DMXApi.call('getTournament',{id}):tournamentRows.find(row=>row.id===id);if(poll&&(tournamentDetailId!==id||!$('#dialog').open||page!=='tournaments'))return;if(!row)throw Error('Турнир не найден.');showTournament(row);}
 catch(error){toast(error.message);}
}
async function tournamentCommand(name,input,message){
 if(tournamentBusy)return false;tournamentBusy=true;const buttons=[...document.querySelectorAll('#dialog button')],disabled=buttons.map(b=>b.disabled);buttons.forEach(b=>b.disabled=true);
 try{const row=await DMXApi.call(name,input);showTournament(row);loadTournaments(true);toast(message);return true;}
 catch(error){toast(error.message);return false;}
 finally{tournamentBusy=false;buttons.forEach((b,i)=>{if(b.isConnected)b.disabled=disabled[i];});}
}
function createTournament(){
 if(!account?.link){toast('Сначала подключи игровой ID в профиле.');return;}tournamentDetailId=null;
 modal('СОЗДАТЬ ТУРНИР','<h2 class="modal-title">Новый кубок</h2><div class="tournament-form"><label>Название<input id="tournamentTitle" maxlength="60" value="Кубок DMX"></label><label>Карта<input id="tournamentMap" maxlength="64" placeholder="Например, Дворец"></label><div class="tournament-form-row"><label>Участники<select id="tournamentCapacity"><option value="8">8 участников</option><option value="4">4 участника</option></select></label><label>Комнаты одновременно<select id="tournamentConcurrent"><option value="1">1 комната</option><option value="2">2 комнаты</option></select></label></div><label>Правила<textarea id="tournamentRules" maxlength="1000" rows="4" placeholder="Режим боя, переигровки, неявка, спорные ситуации"></textarea></label></div>'+notice('Создаётся регистрация. Вход бесплатный, начисления DMX пока выключены.'),[{label:'Открыть регистрацию',run:()=>tournamentCommand('createTournament',{title:$('#tournamentTitle').value,map:$('#tournamentMap').value,rules:$('#tournamentRules').value,capacity:Number($('#tournamentCapacity').value),concurrentRooms:Number($('#tournamentConcurrent').value)},'Регистрация открыта.')},{label:'Отмена',secondary:true,run:()=>$('#dialog').close()}]);
}
function tournamentRoom(id,matchId){
 tournamentDetailId=null;modal('ЗАКРЫТАЯ КОМНАТА','<h2 class="modal-title">Код для пары</h2><p class="modal-subtitle">Создай закрытую комнату в Pixel World и укажи её код. Он будет виден только тебе и участникам этой пары.</p><label>Код комнаты<input id="tournamentRoomCode" maxlength="64" autocomplete="off" spellcheck="false"></label>'+notice('После изменения кода оба игрока заново подтверждают готовность.'),[{label:'Назначить комнату',run:()=>tournamentCommand('setTournamentRoom',{id,matchId,roomCode:$('#tournamentRoomCode').value},'Комната назначена.')},{label:'Назад',secondary:true,run:()=>openTournament(id)}],()=>openTournament(id));
}
async function tournamentResult(id,matchId){
 try{
  const row=await DMXApi.call('getTournament',{id}),match=row.rounds.flat().find(m=>m.id===matchId);if(!match)return;
  tournamentDetailId=null;const canScore=match.status==='room'&&match.ready.length===2;
  modal('РЕЗУЛЬТАТ ДУЭЛИ','<h2 class="modal-title">Кто проходит дальше</h2><div class="tournament-form"><label>Результат<select id="tournamentResultKind">'+(canScore?'<option value="score">Бой завершён</option>':'')+'<option value="forfeit">Техническая победа / неявка</option></select></label><label>Победитель<select id="tournamentWinner">'+match.players.map(p=>'<option value="'+p+'">'+esc(tournamentName(row,p))+'</option>').join('')+'</select></label>'+(canScore?'<div class="tournament-form-row">'+match.players.map((p,i)=>'<label>'+esc(tournamentName(row,p))+'<input id="tournamentScore'+i+'" type="number" min="0" max="1000000" inputmode="numeric" placeholder="Счёт"></label>').join('')+'</div>':'')+'<label>Пояснение<textarea id="tournamentResultNote" maxlength="500" rows="3" placeholder="Результат боя или причина технической победы"></textarea></label></div>'+notice('Ты подтверждаешь результат и продвижение по сетке. Выплата DMX пока не производится.'),[{label:'Подтвердить результат',run:()=>{
   const kind=$('#tournamentResultKind').value;if(kind==='score'&&[0,1].some(i=>!$('#tournamentScore'+i).value.trim())){toast('Укажи счёт обоих игроков.');return;}
   return tournamentCommand('confirmTournamentResult',{id,matchId,kind,winnerId:$('#tournamentWinner').value,scores:kind==='score'?[0,1].map(i=>Number($('#tournamentScore'+i).value)):null,note:$('#tournamentResultNote').value},'Результат сохранён.');
  }},{label:'Назад',secondary:true,run:()=>openTournament(id)}],()=>openTournament(id));
 }catch(error){toast(error.message);}
}
function cancelTournament(id){tournamentDetailId=null;modal('ОТМЕНА ТУРНИРА','<h2 class="modal-title">Отменить турнир?</h2><p class="modal-subtitle">Регистрация и активные комнаты закроются. Запись турнира сохранится.</p>',[{label:'Отменить турнир',run:()=>tournamentCommand('cancelTournament',{id},'Турнир отменён.')},{label:'Назад',secondary:true,run:()=>openTournament(id)}],()=>openTournament(id));}
function tournamentClick(data){
 if('createTournament'in data)createTournament();else if('refreshTournaments'in data)loadTournaments();else if(data.openTournament)openTournament(data.openTournament);
 else if(data.joinTournament)tournamentCommand('joinTournament',{id:data.joinTournament},'Ты участвуешь в турнире.');else if(data.leaveTournament)tournamentCommand('leaveTournament',{id:data.leaveTournament},'Ты вышел из регистрации.');
 else if(data.startTournament)tournamentCommand('startTournament',{id:data.startTournament},'Сетка сформирована. Турнир начат.');else if(data.tournamentRoom)tournamentRoom(data.tournamentId,data.tournamentRoom);
 else if(data.tournamentReady)tournamentCommand('readyTournamentMatch',{id:data.tournamentId,matchId:data.tournamentReady},'Готовность подтверждена.');else if(data.tournamentResult)tournamentResult(data.tournamentId,data.tournamentResult);else if(data.cancelTournament)cancelTournament(data.cancelTournament);else return false;
 return true;
}
window.addEventListener('load',()=>setInterval(()=>{if(document.visibilityState==='visible'&&page==='tournaments'&&!tournamentBusy){loadTournaments(true);if(tournamentDetailId&&$('#dialog').open)openTournament(tournamentDetailId,true);}},15000));

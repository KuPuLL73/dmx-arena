'use strict';
// DMX: verified Telegram identity, owned inventory and server-verified game points.
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={home:'<path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8"/>',sets:'<path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/>',quests:'<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6M9 12h6M9 16h3"/>',community:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',trophy:'<path d="M7 3h10v5a5 5 0 0 1-10 0V3ZM7 5H3v3a4 4 0 0 0 5 4M17 5h4v3a4 4 0 0 1-5 4M12 13v5M8 21h8M9 18h6"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>'};
const svg=key=>'<svg class="pixel-icon" viewBox="0 0 24 24" aria-hidden="true">'+(icons[key]||icons.sets)+'</svg>';
const SLOTS=['primary','backup','melee','special','head'];
const LABELS={primary:'Основное',backup:'Вспомогательное',melee:'Ближний бой',special:'Специальное',head:'Голова'};
let slotRules={},catalogInfo={},publicModels=[],skinPresentation={backdrops:{},symbols:[]},pickerSlot=null,pickerMode='owned',pickerSearch='',catalogBrowsing=false;
const slotOf=row=>row?.slot==='Mask'?'head':slotRules[row?.collection]||slotRules[row?.slot]||(SLOTS.includes(row?.slot)?row.slot:null);
function normalizeSet(set){const slots={};let needsReview=!!set.needsReview;for(const [key,id] of Object.entries(set.slots||{})){const slot=SLOTS.includes(key)?key:key==='Mask'?'head':slotRules[key];if(slot&&!slots[slot])slots[slot]=id;else needsReview=true;}return {...set,slots,needsReview};}
const NAV=[['home','Главная'],['quests','Задания'],['top','Топ игроков'],['profile','Профиль']];
Object.assign(icons,{
 home:'<path d="M10 3h4v2h2v2h2v2h3v3h-3v9h-5v-7h-2v7H6v-9H3V9h3V7h2V5h2Z"/>',
 sets:'<path d="M3 3h8v8H3ZM13 3h8v8h-8ZM3 13h8v8H3ZM13 13h8v8h-8Z"/>',
 quests:'<path d="M5 2h14v20H5Zm2 4v2h2V6Zm4 0v2h6V6ZM7 11v2h2v-2Zm4 0v2h6v-2ZM7 16v2h2v-2Zm4 0v2h4v-2Z" fill-rule="evenodd"/>',
 trophy:'<path d="M7 2h10v3h5v7h-3v2h-4v3h-1v3h4v2H6v-2h4v-3H9v-3H5v-2H2V5h5ZM4 7v3h3V7Zm13 0v3h3V7Z"/>',
 info:'<path d="M5 2h14v2h3v16h-3v2H5v-2H2V4h3ZM11 6v2h2V6Zm0 4v8h2v-8Z" fill-rule="evenodd"/>',
 arrow:'<path d="M13 3h3v3h3v3h3v6h-3v3h-3v3h-3v-6H2V9h11Z"/>'
});icons.top=icons.trophy;icons.tournaments='<path d="M3 2h8v8H3ZM13 2h8v8h-8ZM6 10v3h5v4H7v5h10v-5h-4v-4h5v-3h-2v1H8v-1Z"/>';icons.battles='<path d="M3 2h4v2h2v2h2v2h2v2h2v2h2v2h4v3h-3v4h-3v-4h-2v-2h-2v-2H9v-2H7V9H5V7H3Zm14 0h4v5h-2v2h-2v2h-2V9h-2V7h2V5h2ZM7 13h2v2h2v2H9v4H6v-4H3v-3h4Z"/>';
const KEY='dmx.player-hub.v1';
let catalog=[],catalogReady=false,page='home',draft=null,filter='all',dialogBack=null,toastTimer,member=null,memberLoading=false,profileTab='inventory',homePicker=false;
let state={name:'Игрок',sets:[],active:null,bookmarks:[]};
let account=null,ownedInventory=[],ranking=[],accountLoading=true,accountError='',topLoading=false,topError='',topUpdated=null,topRequest=0,topGroup='players',topTimer=null,lookupTimer=null,gameTimer=null,lookupSerial=0;
let clanMaps=null,battleMapId=null,battleTimer=null,battleBusy=false,battleError='',battleRequest=0,battlePhaseSnapshot='';
let clanView=null,clanLoading=false,clanError='',clanRequest=0,memberRequest=0,memberBack='top';
const locale=()=>window.DMXI18n?.locale()||'ru-RU';
const number=value=>Number(value||0).toLocaleString(locale());
const updated=value=>value?new Date(value).toLocaleTimeString(locale(),{hour:'2-digit',minute:'2-digit'}):'—';
function applyAccount(result){
 account=result;if(result.settings?.language)window.DMXI18n?.setLanguage(result.settings.language,false);accountLoading=false;accountError='';ownedInventory=result.inventory||[];
 for(const row of ownedInventory){row.slot=slotOf(row);const index=catalog.findIndex(x=>x.id===row.id);if(index<0)catalog.push(row);else catalog[index]=row;}
 if(Array.isArray(result.bookmarks)){state.bookmarks=result.bookmarks.map(normalizeSet);for(const set of state.bookmarks)importPreviewItems(set);}state.name=result.user.name;state.sets=(result.sets||[]).map(normalizeSet);state.active=result.active||null;persist();render();clearTimeout(gameTimer);if(result.gameStats?.pending)gameTimer=setTimeout(()=>connectProfile(),5000);
}
async function connectProfile(refresh=false){
 if(connectProfile.pending)return;connectProfile.pending=true;
 if(!account){accountLoading=true;render();}
 try{applyAccount(await DMXApi.call('getProfile',{refresh}));}
 catch(error){accountLoading=false;accountError=error.message;if(!account){ownedInventory=[];state.sets=[];state.active=null;}render();if(refresh)toast(error.message);}
 finally{connectProfile.pending=false;}
}
window.addEventListener('online',()=>{if(accountError&&telegram?.initData)connectProfile();if(['home','battles','quests','profile'].includes(page))refreshBattles();});
function scheduleTop(){clearTimeout(topTimer);if(page==='top'&&!document.hidden)topTimer=setTimeout(()=>$('#dialog').open?scheduleTop():loadTop({quiet:true}),30000);}
async function loadTop({quiet=false}={}){
 clearTimeout(topTimer);const request=++topRequest,group=topGroup;topLoading=!quiet||!topUpdated;topError='';if(!quiet)render();
 try{const result=await DMXApi.call('getLeaderboard',{group});if(request!==topRequest)return;ranking=result.players||[];topUpdated=result.updatedAt;}
 catch(error){if(request!==topRequest)return;topError=topUpdated?'Не удалось обновить. Повторим автоматически.':'Рейтинг временно недоступен. Повторим автоматически.';}
 finally{if(request===topRequest){topLoading=false;if(page==='top'){const focusedGroup=document.activeElement?.dataset.topGroup;render();if(focusedGroup)document.querySelector('[data-top-group="'+focusedGroup+'"]')?.focus({preventScroll:true});scheduleTop();}}}
}
document.addEventListener('visibilitychange',()=>{clearTimeout(topTimer);if(!document.hidden&&page==='top')loadTop({quiet:true});});
document.addEventListener('keydown',event=>{const tab=event.target.closest?.('[data-top-group]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const group=event.key==='Home'?'players':event.key==='End'?'clans':tab.dataset.topGroup==='players'?'clans':'players';const target=document.querySelector('[data-top-group="'+group+'"]');target?.click();document.querySelector('[data-top-group="'+group+'"]')?.focus();});
async function action(name,input={},message){
 if(action.busy)return;action.busy=true;
 const buttons=[...document.querySelectorAll('#dialogActions button,button[data-sync-game],button[data-claim],button[data-equip]')];const disabled=buttons.map(b=>b.disabled);buttons.forEach(b=>b.disabled=true);
 try{applyAccount(await DMXApi.call(name,input));if(message)toast(message);return true;}
 catch(error){toast(error.message);return false;}
 finally{action.busy=false;buttons.forEach((b,i)=>{if(b.isConnected)b.disabled=disabled[i];});}
}
function ownedSet(set){return !!account&&account.inventoryStatus==='connected'&&set&&!set.needsReview&&Object.keys(set.slots||{}).length>0&&Object.entries(set.slots).every(([slot,id])=>ownedInventory.some(row=>row.id===id&&row.slot===slot&&row.owned&&row.source==='notgames'));}
const telegram=window.Telegram?.WebApp;
function syncTelegramBack(){if(!telegram?.initData)return;if($('#dialog').open||page!=='home')telegram.BackButton?.show();else telegram.BackButton?.hide();}
function syncViewport(){document.documentElement.style.setProperty('--dmx-viewport-height',(window.visualViewport?.height||innerHeight)+'px');document.documentElement.style.setProperty('--dmx-nav-height',($('#mobileNav')?.getBoundingClientRect().height||0)+'px');}
syncViewport();window.addEventListener('resize',syncViewport);window.visualViewport?.addEventListener('resize',syncViewport);
if(telegram?.initData){
 telegram.ready();telegram.expand();
 if(telegram.isVersionAtLeast?.('6.1'))telegram.setBackgroundColor?.('#0d0b0d');
 if(telegram.isVersionAtLeast?.('6.9'))telegram.setHeaderColor?.('#0d0b0d');
 if(telegram.isVersionAtLeast?.('7.10'))telegram.setBottomBarColor?.('#0d0b0d');
 telegram.BackButton?.onClick(()=>$('#dialog').open?close():go(page==='member'?memberBack:page==='clan'?'top':'home'));
 telegram.onEvent?.('viewportChanged',syncViewport);
}
const examples=[{id:'sample-night',name:'Night shift',slots:{'Ak-69':'ak690',"Chef's Knife":'chefsknife0',Mask:'chicken2'},author:'DMX Studio',sample:true},{id:'sample-gold',name:'Golden hour',slots:{'Ak-69':'ak692',"Chef's Knife":'chefsknife1',Mask:'dogs0',RPG:'rpg0'},author:'DMX Studio',sample:true}];
const defaultQuests=[
 {id:'clan_arms',title:'К оружию',description:'Набери 1 000 очков за одну клановую битву.',reward:null,target:1000,progress:null,available:false,kind:'clan_war'},
 {id:'clan_contribution',title:'Боевой вклад',description:'Набери 2 000 очков за одну клановую битву.',reward:null,target:2000,progress:null,available:false,kind:'clan_war'},
 {id:'clan_power',title:'Ударная сила',description:'Набери 3 000 очков за одну клановую битву.',reward:null,target:3000,progress:null,available:false,kind:'clan_war'},
 {id:'world',title:'Весь мир',description:'Набери 1000 очков в часы клановой битвы на каждой карте.',reward:null,target:null,progress:0,available:false,hint:'Прогресс новых очков считаем по расписанию после привязки ID.'},
 {id:'clan_ownership_ladder',title:'Контроль территорий',description:'Удержите 3 / 4 / 5 / 6 карт во владении клана к концу дня.',reward:null,target:6,progress:null,available:false,stages:[3,4,5,6],hint:'Захват и защита подходят. Общий фонд делят до 10 лучших участников DMX по вкладу за день. Суммы готовятся.'}
];
const item=id=>catalog.find(row=>row.id===id);
function skinView(row){
 const model=publicModels.find(value=>value.collection===row.collection&&value.name===(row.model||row.name)),backdrop=skinPresentation.backdrops[row.collection]?.find(value=>value.name===row.backdrop),symbol=skinPresentation.symbols.find(value=>value.name===row.symbol);
 const background=backdrop?.bgColor&&/^[a-z0-9#(),.%\s-]+$/i.test(backdrop.bgColor)?backdrop.bgColor:'#242427';
 return {image:model?.image||row.image,background,symbol:symbol?.image||'',rarity:{model:row.traitRarity?.model??model?.modelPercent,symbol:row.traitRarity?.symbol??symbol?.percent,backdrop:row.traitRarity?.backdrop??backdrop?.percent}};
}
function skinArt(row,className=''){
 const view=skinView(row),composite=className!=='detail-art'&&['notgames','public_profile'].includes(row.source)&&typeof row.image==='string'&&row.image.startsWith('https://');
 // The working market uses each verified NFT's icon_url directly in its grid.
 // It already contains the official skin, backdrop and exact symbol pattern.
 return '<span class="skin-card-art '+className+'" style="background:'+esc(view.background)+'">'+(!composite&&view.symbol?'<span class="skin-pattern'+(row.backdrop==='Black'?' is-light':'')+'" style="background-image:url(&quot;'+esc(view.symbol)+'&quot;)" aria-hidden="true">'+'<i></i>'.repeat(12)+'</span>':'')+'<img class="'+(composite?'nft-composite':'')+'" loading="lazy" src="'+esc(composite?row.image:view.image)+'" alt="'+esc(row.name)+'">'+(row.serial&&className!=='detail-art'?'<span class="skin-serial">#'+esc(row.serial)+'</span>':'')+'</span>';
}
function skinCopy(row){return '<span class="skin-card-copy"><b>'+esc(row.collection)+'</b><small>'+esc(row.name)+'</small></span>';}
function validSet(value){
 if(!value||typeof value.name!=='string'||!value.name.trim()||value.name.length>32||!value.slots||typeof value.slots!=='object'||Array.isArray(value.slots))return false;
 const entries=Object.entries(value.slots);return entries.length>0&&entries.length<=SLOTS.length&&entries.every(([slot,id])=>SLOTS.includes(slot)&&item(id)?.slot===slot);
}
function load(){try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved){for(const bookmark of (Array.isArray(saved.bookmarks)?saved.bookmarks.slice(0,30):[]))importPreviewItems(bookmark);state.name=typeof saved.name==='string'?saved.name.slice(0,24):'Игрок';state.sets=Array.isArray(saved.sets)?saved.sets.map(normalizeSet).filter(s=>validSet(s)&&typeof s.id==='string').slice(0,20):[];state.active=state.sets.some(s=>s.id===saved.active)?saved.active:null;state.bookmarks=Array.isArray(saved.bookmarks)?saved.bookmarks.map(normalizeSet).filter(validSet).slice(0,30):[];}}catch{toast('Не удалось прочитать сохранение. Приложение открыто без него.');}}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch{toast('Хранилище браузера недоступно: изменения останутся только до закрытия.');return false;}}
function toast(text){$('#toast').textContent=window.DMXI18n?.t(text)||text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3500);}
function go(next){if(next==='battles')next='quests';if(page==='home'&&next==='quests'){const maps=DMXLobby.homeMaps(warMaps());battleMapId=(maps.find(m=>m.map_id===battleMapId)||maps[0])?.map_id||null;}if(next==='tournaments')return;homePicker=false;clearTimeout(topTimer);if(page==='top'&&next!=='top')++topRequest;page=next;filter='all';render();if(next==='top')loadTop({quiet:!!topUpdated});if(['home','battles','quests','profile'].includes(next))refreshBattles();else clearTimeout(battleTimer);window.scrollTo({top:0,behavior:'instant'});}
function photoAvatar(name,url,extra=''){let src='';try{const u=new URL(url);if(u.protocol==='https:'&&!u.username&&!u.password)src=u.href;}catch{}return '<span class="profile-photo '+extra+'"><span>'+esc((name||'D').slice(0,1).toUpperCase())+'</span>'+(src?'<img src="'+esc(src)+'" alt="Фото '+esc(name)+'" referrerpolicy="no-referrer">':'')+'</span>';}
function clanAvatar(clan,extra=''){let src='';try{const u=new URL(clan?.avatar);if(u.protocol==='https:'&&u.hostname==='static.pw.game'&&u.pathname.startsWith('/teams/')&&!u.username&&!u.password)src=u.href;}catch{}return '<span class="clan-avatar '+extra+'"><span>'+svg('community')+'</span>'+(src?'<img src="'+esc(src)+'" alt="Значок клана '+esc(clan.name)+'" referrerpolicy="no-referrer">':'')+'</span>';}
function nav(){const selected=page==='sets'?'profile':['member','clan'].includes(page)?'top':page;for(const target of ['#sideNav','#mobileNav'])$(target).innerHTML=NAV.map(([key,label])=>'<button class="nav-button '+(selected===key?'active':'')+'" data-go="'+key+'">'+svg(key==='profile'?'info':key)+'<span>'+label+'</span></button>').join('');$('#profileShortcut').innerHTML=photoAvatar(state.name,account?.user?.photoUrl);}
const title=(small,name,description='')=>'<div class="page-title"><div><span class="eyebrow">'+small+'</span><h1>'+name+'</h1>'+(description?'<p>'+description+'</p>':'')+'</div></div>';
const notice=text=>'<div class="notice">'+svg('info')+'<span>'+text+'</span></div>';
function thumbs(set){return '<div class="set-preview">'+SLOTS.map(slot=>{const row=item(set.slots[slot]);return row?'<button class="skin-thumb" data-item="'+esc(row.id)+'" aria-label="Осмотреть '+esc(row.name)+'">'+skinArt(row)+skinCopy(row)+'</button>':'<span class="skin-thumb empty"><span>+</span><small>Нет скина</small></span>';}).join('')+'</div>';}
function card(set,kind='own'){return '<article class="set-card"><div class="set-heading"><b data-i18n-skip>'+esc(set.name)+'</b><span class="tag">'+(kind==='own'?(set.needsReview?'ПРОВЕРЬ СЕТ':state.active===set.id?'НАДЕТ':'МОЙ СЕТ'):(set.sample?'ПРИМЕР':'СОХРАНЁН'))+'</span></div>'+thumbs(set)+'<div class="card-actions">'+(kind==='own'?'<button data-equip="'+esc(set.id)+'" '+(state.active===set.id||!ownedSet(set)?'disabled':'')+'>'+(state.active===set.id?'Надет':'Надеть')+'</button><button data-edit="'+esc(set.id)+'">Изменить</button><button data-share="'+esc(set.id)+'">Поделиться ↗</button>':'<button data-open-public="'+esc(set.id)+'">Посмотреть сет</button><button data-bookmark="'+esc(set.id)+'">'+(state.bookmarks.some(s=>s.id===set.id)?'Убрать':'Сохранить')+'</button>')+'</div></article>';}
function questCard(q){
 const percent=q.target?Math.min(100,Math.floor(q.progress/q.target*100)):0;
 const status=q.claimed?'Получено':q.reason?'Недоступно':q.kind==='clan_war'&&!q.available?(account?.link?'Ждём вклад в битве':'Укажи ID'):q.progress===null?'Правила готовятся':!q.available?(account?.link?'Проверяем вклад':'Укажи ID'):number(q.progress)+' / '+number(q.target)+(q.unit?' '+q.unit:'');
 return '<article class="quest-card"><div class="quest-top"><span>'+svg('quests')+'</span><small>'+(q.claimEnabled?'ЗАДАНИЕ':'ЧЕРНОВИК')+'</small></div><div class="quest-content"><h3>'+esc(q.title)+'</h3><p>'+esc(q.description)+'</p>'+(q.reason||q.hint?'<small class="quest-reason">'+esc(q.reason||q.hint)+'</small>':'')+(!q.claimEnabled&&window.DMXQuestGuide?.rewardLabels[q.id]?'<div class="quest-proposal">Проект: '+esc(DMXQuestGuide.rewardLabels[q.id])+'</div>':'')+'</div><div class="quest-end"><div class="quest-reward">'+(q.reward==null?'СКОРО':'+'+q.reward)+' <small>$DMX</small></div><div class="progress"><i style="width:'+percent+'%"></i></div><div class="quest-bottom"><span>'+status+'</span></div>'+(q.claimEnabled&&q.available&&!q.claimed&&q.progress>=q.target?'<button class="primary claim-button" data-claim="'+q.id+'">Забрать</button>':'')+(q.id==='world'&&account?.link?'<button class="text-button map-progress-button" data-map-progress>Прогресс по картам ↗</button>':'')+'</div></article>';
}
const MAP_LABELS={boxes_level:'Коробки',city_level:'Город',flying_ship_level:'Летающий корабль',jungle_level:'Джунгли',lost_city_level:'Затерянный город',medieval_level:'Средневековье',not_factory_level:'NOT Factory',panelka_level:'Панелька',silent_floor_level:'Тихий этаж',temple_level:'Дворец',victory_street_level:'Улица победы'};
function mapPhoto(id,className='map-photo'){return Object.hasOwn(MAP_LABELS,id)?'<img class="'+className+'" src="art/maps/'+id+'.jpg" alt="'+esc(mapName(id))+' — карта Pixel World" loading="lazy" decoding="async" width="1024" height="512">':'<span class="'+className+' map-placeholder">Pixel World</span>';}
const mapName=id=>MAP_LABELS[id]||String(id||'Карта').replace(/_level$/,'').replace(/_/g,' ');
const battleTime=value=>value?new Date(value).toLocaleString(locale(),{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'—';
function clanPanel(stats){
 const maps=stats.clanWars?.maps;
 if(!Array.isArray(maps))return notice('Клановые войны временно недоступны.');
 return '<details class="clan-panel"><summary>Расписание и битвы <span>'+maps.length+' карт</span></summary><p class="schedule-note">Время на твоём устройстве. Расписание загружается из игры.</p><div class="clan-grid">'+maps.map(map=>'<article class="clan-map"><div><b>'+esc(mapName(map.map_id))+'</b><span class="tag">'+(map.segment_type==='battle'?'БОЙ':'КОНТРОЛЬ')+'</span></div><p>'+esc(map.owner?.name||'Битва за карту')+'</p><small>'+(map.segment_type==='battle'?'Битва: '+battleTime(map.startsAt)+' — '+battleTime(map.endsAt):'Начало битвы: '+battleTime(map.nextBattleStartsAt||map.endsAt))+'</small>'+(map.lastBattle?'<button class="text-button" data-battle-map="'+esc(map.map_id)+'">'+(map.segment_type==='battle'?'Текущая битва ↗':'Итоги последней битвы ↗')+'</button>':'')+'</article>').join('')+'</div></details>';
}
function battleResults(id){
 const map=warMaps().find(row=>row.map_id===id),battle=map?.lastBattle;if(!battle)return;
 const clanId=account?.gameStats?.clan?.id;
 modal('КЛАНОВАЯ БИТВА','<h2 class="modal-title">'+esc(mapName(id))+'</h2><p class="modal-subtitle">'+battleTime(battle.startsAt)+' — '+battleTime(battle.endsAt)+'</p><div class="ranking-list">'+battle.teams.map(row=>'<button class="ranking-row clan-ranking-row" data-clan="'+row.id+'"><b class="rank-place">'+row.rank+'</b>'+clanAvatar(row)+'<span class="ranking-name"><b data-i18n-skip>'+esc(row.name)+'</b><small>'+(row.id===clanId?'Твой клан':'Очки клановой битвы')+'</small></span><strong>'+number(row.score)+'</strong></button>').join('')+'</div>'+(battle.total>battle.teams.length?notice('Показаны первые '+battle.teams.length+' кланов из '+battle.total+'.'):'')+'<p class="data-time">Данные игры · '+updated(battle.updatedAt)+'. Нажми на клан, чтобы увидеть участников DMX.</p>',[{label:'Готово',secondary:true,run:()=>$('#dialog').close()}]);
}
function showMapProgress(){
 const stats=account?.gameStats,progress=stats?.mapProgress,rows=progress?.maps||[];
 modal('ВЕСЬ МИР','<h2 class="modal-title">Твои очки по картам</h2><p class="modal-subtitle">1000 очков на каждой карте. Считаем новые изменения очков участника клана в часы её битвы после привязки профиля.</p>'+(!rows.length?notice('Загружаем расписание и данные твоего клана.'):'<div class="map-progress-list">'+rows.map(row=>'<div><b>'+esc(mapName(row.mapId))+'</b><span>'+number(row.score)+' / '+number(row.target)+(row.complete?' ✓':'')+'</span></div>').join('')+'</div>')+notice('Изменения на границе битв или после перерыва в наблюдении ждут подтверждения и в карты не зачисляются.')+(progress?.startedAt?'<p class="data-time">Наблюдение с '+battleTime(progress.startedAt)+'</p>':''),[{label:'Готово',secondary:true,run:()=>$('#dialog').close()}]);
}
function gamePanel(){
 const linked=!!account?.link,stats=account?.gameStats,clan=stats?.clan,maps=stats?.clanWars?.maps||[];
 const personal=account?.quests?.find(q=>q.id==='clan_power'),knownClan=clan?.status==='found'&&!clan.stale;
 const owned=knownClan&&maps.length?maps.filter(map=>DMXLobby.phase(map)==='ownership'&&map.owner?.id===clan.id).length:null;
 const values=[['Вклад за одну битву',personal?.available?number(personal.progress):'—','Учтено после начала наблюдения'],['Карты клана',owned===null?'—':number(owned),'Сейчас во владении'],['Карты с вкладом',stats?.mapProgress?.available?number(stats.mapProgress.completed)+' / '+number(stats.mapProgress.total):'—','От 1 000 очков на карте']];
 return '<section class="account-link"><div class="section-head"><div><h2>Pixel World</h2><p>'+(linked?esc(account.link.name):'Укажи ID, чтобы связать игру с Telegram')+'</p></div><button class="secondary" data-link-player>'+(linked?'Игровой ID':'Привязать ID')+'</button></div>'+
 (linked?'<div class="player-id"><span class="tag">СВЯЗАН С TELEGRAM</span><code>'+esc(account.link.playerId)+'</code></div><p class="data-time">Telegram ID: '+account.user.id+'</p>':'')+
 (stats?.error?notice(esc(stats.error)):'')+
 (linked?'<div class="player-clan"><span>Клан</span><b>'+esc(clan?.status==='found'?clan.name:clan?.status==='searching'?'Ищем по игровому ID':'Пока не найден')+'</b>'+(clan?.stale?'<small>Обновляем данные…</small>':'')+'</div>':'')+
 (linked?'<div class="stat-grid game-numbers">'+values.map(([label,value,hint])=>'<div class="stat-card"><small>'+label+'</small><b>'+value+'</b><span>'+hint+'</span></div>').join('')+'</div><p class="data-time">Клановые войны · '+updated(stats?.clanWars?.updatedAt)+'</p><div class="inline-actions"><button class="primary" data-go="battles">Клановые битвы</button><button class="secondary" data-sync-game>Обновить вклад</button><button class="text-button" data-unlink-game>Отключить ID</button></div>'+clanPanel(stats||{}):'<div class="empty-state compact"><h3>Твой игровой профиль</h3><p>Введи игровой ID. Найдём ник и клан, затем свяжем профиль с твоим Telegram.</p></div>')+'</section>';
}

function graffiti(kind,extra=''){return '<span class="dmx-graffiti graffiti-'+kind+' '+extra+'" aria-hidden="true">'+(['mask','tag'].includes(kind)?'':svg(({swords:'battles',duel:'tournaments',island:'home',trophy:'trophy'})[kind]||'sets'))+'</span>';}
function warMaps(){return account?.gameStats?.clanWars?.maps||clanMaps?.maps||[];}
function chosenBattle(){return DMXLobby.select(warMaps(),battleMapId);}
function phaseLabel(map){return {live:'ИДЁТ БИТВА',upcoming:'СКОРО БИТВА',ownership:'КОНТРОЛЬ',expired:'ОБНОВЛЯЕМ',unknown:'НЕТ РАСПИСАНИЯ'}[DMXLobby.phase(map)];}
function countdown(target){if(!Number.isSafeInteger(target))return '—';let seconds=Math.max(0,Math.ceil((target-Date.now())/1000));const hours=Math.floor(seconds/3600);seconds%=3600;return (hours?String(hours).padStart(2,'0')+':':'')+String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}
function clockMarkup(map){const phase=DMXLobby.phase(map),target=phase==='live'?map.endsAt:phase==='ownership'?map.nextBattleStartsAt||map.endsAt:phase==='upcoming'?map.startsAt:null;return '<div class="war-clock"><span>'+(phase==='live'?'До конца битвы':target?'До начала битвы':'Ждём расписание')+'</span><b'+(target?' data-countdown="'+target+'"':'')+'>'+countdown(target)+'</b></div>';}
function battleGoal(map,compact=false){
 const stats=account?.gameStats,g=DMXLobby.contribution(stats,map),phase=DMXLobby.phase(map);
 let subtitle=!account?'Открой DMX в Telegram':!account.link?'Привяжи игровой ID':stats?.clan?.status!=='found'?'Найдём твой клан в игре':phase==='live'?'Твой вклад в текущую битву':map?'Подготовься к следующей битве':'Ожидаем расписание игры';
 const activeGoal=phase==='live',progress=g.available?Math.min(100,g.score/g.target*100):0;
 return '<section class="battle-goal'+(compact?' compact-goal':'')+'"><div class="goal-kicker"><span>ТВОЯ ЦЕЛЬ</span>'+graffiti('swords')+'</div><h2>'+(g.completed?'Мощный вклад':activeGoal?'Вперёд, за клан':'Готовность к бою')+'</h2><p class="goal-subtitle">'+esc(subtitle)+'</p><div class="goal-total"><strong>'+number(g.target)+'</strong><span>очков клановой войны</span></div><div class="goal-map">'+(map?esc(mapName(map.map_id)):'Выбери карту сражения')+'</div><div class="goal-progress" role="progressbar" aria-label="Учтённый вклад в этой битве" aria-valuemin="0" aria-valuemax="'+g.target+'"'+(g.available?' aria-valuenow="'+Math.min(g.target,g.score)+'"':'')+'><i style="width:'+progress+'%"></i></div><div class="goal-progress-caption"><b>'+(g.available?number(g.score)+' / '+number(g.target):'Вклад пока не определён')+'</b><span>'+(g.completed?'Цель достигнута':g.available?'ещё '+number(Math.max(0,g.target-g.score)):'из данных игры')+'</span></div><div class="goal-stages">'+[1000,2000,3000].map(n=>'<span class="'+(g.available&&g.score>=n?'complete':n===g.target?'current':'')+'">'+(g.available&&g.score>=n?'✓ ':'')+number(n)+'</span>').join('')+'</div><p class="goal-note">'+(g.available?'Учтено с '+updated(g.observedSince)+'. Вклад до наблюдения сюда не включён.':'Новый вклад учитывается в часы одной битвы. При пересечении расписаний ждём подтверждения.')+'</p>'+(compact?'':'<button class="primary" data-go="'+(account?.link?'battles':'profile')+'">'+(account?.link?'Клановые битвы':'Подключить игру')+' '+svg('arrow')+'</button>')+'</section>';
}
function equippedPortrait(){
 const active=state.sets.find(s=>s.id===state.active),verified=ownedSet(active);
 const models={};if(verified)for(const slot of SLOTS){const row=ownedInventory.find(r=>r.id===active.slots[slot]);if(row){const clean=publicModels.find(r=>r.collection===row.collection&&r.name===(row.model||row.name));models[slot]={id:row.id,name:row.name,collection:row.collection,src:skinView(row).image,clean:!!clean,gameModel:row.gameModel};}}
 return {active:verified?active:null,models};
}
function lobbyPage(){
 const active=state.sets.find(s=>s.id===state.active),set=ownedSet(active)?active:null,count=set?Object.keys(set.slots).length:0;
 const maps=DMXLobby.homeMaps(warMaps()),map=maps.find(m=>m.map_id===battleMapId)||maps[0]||null,g=DMXLobby.contribution(account?.gameStats,map),labels={primary:'Основное',backup:'Вспомогат.',melee:'Ближний бой',special:'Специальное',head:'Маска'},percent=g.available?Math.min(100,g.score/g.target*100):0;
 const phase=DMXLobby.phase(map);
 const timeline=DMXLobby.homeTimeline(warMaps());
 const cards=timeline.map(({kind,map:m})=>{
  const label=kind==='live'?'ИДЁТ БИТВА':kind==='previous'?'ПРОШЛАЯ БИТВА':'СЛЕДУЮЩАЯ БИТВА';
  if(!m)return '<div class="home-map-card home-map-placeholder" data-map-phase="'+kind+'"><span class="home-map-status">'+label+'</span><span class="home-map-copy"><b>'+(kind==='previous'?'Прошлая карта':'Следующая карта')+'</b><small>'+(kind==='previous'?'Нет данных':'Ждём расписание')+'</small></span></div>';
  const previous=kind==='previous',live=kind==='live',results=Array.isArray(m.lastBattle?.teams),target=live?m.endsAt:m.segment_type==='ownership'?m.nextBattleStartsAt||m.endsAt:m.startsAt;
  const timing=previous?(results?'Итоги ↗':'Битва завершена'):(live?'До конца':'До начала')+' · <span data-countdown="'+target+'">'+countdown(target)+'</span>';
  return '<button class="home-map-card '+(m.map_id===map?.map_id&&!previous?'selected':'')+'" data-map-phase="'+kind+'" '+(previous?(results?'data-battle-map="'+esc(m.map_id)+'"':'disabled'):'data-home-map="'+esc(m.map_id)+'"')+'>'+mapPhoto(m.map_id)+'<span class="home-map-status '+(live?'is-live':'')+'">'+label+'</span><span class="home-map-copy"><b>'+esc(mapName(m.map_id))+'</b><small>'+timing+'</small></span></button>';
 }).join('');
 const battleOverview='<section class="home-battles"><div class="home-section-heading"><h2>'+(phase==='live'?'Битвы сейчас':'Клановые битвы')+'</h2>'+'</div>'+(cards?'<div class="home-map-strip '+(timeline.length===1?'single':'timeline')+'">'+cards+'</div>':'<div class="home-maps-empty">'+(battleError?'Не удалось загрузить расписание.':'Ожидаем расписание из игры.')+'<button class="text-button" data-refresh-battles '+(battleBusy?'disabled':'')+'>'+(battleBusy?'Обновляю…':'Обновить ↻')+'</button></div>')+(phase==='live'?'<button class="primary home-play" data-play-map="'+esc(map.map_id)+'">Играть '+svg('arrow')+'</button>':'')+'</section>';
 const homeBoard=account?.questBoard?.maps?.find(b=>b.mapId===map?.map_id&&b.battle?.startsAt===map?.startsAt&&b.battle?.endsAt===map?.endsAt);let goalText=homeBoard?.canClaim?'Цель достигнута. Проверяем автоматическое начисление $DMX.':homeBoard?.status==='collected'?'За эту битву начислено '+number(homeBoard.totalPaid)+' $DMX. Новая битва — новая лестница.':accountLoading?'Загружаем профиль и твои скины…':!account?'Открой бота и нажми кнопку DMX.':!account.link?'Привяжи игровой ID, чтобы учитывать вклад.':g.completed?'Все три ступени пройдены. '+number(g.score)+' очков в этой битве.':g.available?number(g.score)+' / '+number(g.target)+' · осталось '+number(g.target-g.score):phase==='live'?'Битва идёт. Ждём подтверждённый вклад.':map?'Следи за расписанием и готовь свой сет.':'Ожидаем расписание клановых битв.';
 if(g.pendingScore&&phase==='live')goalText+=' Ещё '+number(g.pendingScore)+' очков без подтверждения карты.';
 const goalAction=account?.link?'Задания':account?'Подключить игру':'Открыть Telegram';
 const goalButton=!account&&!accountLoading&&!telegram?.initData?'<a class="text-button" href="https://t.me/DMXARENABOT" target="_blank" rel="noopener">'+goalAction+' ↗</a>':'<button class="text-button" data-go="'+(account?.link?'battles':'profile')+'" '+(accountLoading?'disabled':'')+'>'+goalAction+' ↗</button>';
 const goalPanel='<section class="home-brief"><div class="home-brief-heading"><span class="eyebrow">'+(g.completed?'ЦЕЛЬ ДОСТИГНУТА':'ЗАДАНИЯ')+(map?' / '+esc(mapName(map.map_id)):'')+'</span></div><div class="brief-target"><strong>'+number(g.target)+'</strong><span>очков<br>клановой войны</span></div><div class="goal-progress" role="progressbar" aria-label="Учтённый вклад в битве" aria-valuemin="0" aria-valuemax="'+g.target+'"'+(g.available?' aria-valuenow="'+Math.min(g.score,g.target)+'"':'')+'><i style="width:'+percent+'%"></i></div><p>'+esc(goalText)+'</p>'+goalButton+(accountError&&telegram?.initData?'<div class="home-connection-error" role="status"><span>'+esc(accountError)+'</span><button class="text-button" data-retry-profile>Повторить ↻</button></div>':'')+'</section>';
 const connectLabel='<span><b>Подключить игру</b><small>UID Pixel World</small></span>'+svg('arrow');
 const connectControl=!account&&!accountLoading&&!telegram?.initData?'<a class="home-connect-button" href="https://t.me/DMXARENABOT" target="_blank" rel="noopener">'+connectLabel+'</a>':'<button class="home-connect-button" data-link-player '+(accountLoading||!account?'disabled':'')+'>'+connectLabel+'</button>';
 const homeGoal=account?.link?goalPanel:'<section class="home-connect">'+connectControl+(accountError&&telegram?.initData?'<div class="home-connection-error" role="status"><span>'+esc(accountError)+'</span><button class="text-button" data-retry-profile>Повторить ↻</button></div>':'')+'</section>';
 return '<section class="home-equipment" aria-busy="'+accountLoading+'"><div class="home-overview">'+battleOverview+homeGoal+'</div><div class="home-loadout"><div class="equipment-heading"><h1>Твой сет</h1><span class="equipment-total" aria-label="Бонус за надетые скины">+'+(count*10)+'%<small>К НАГРАДАМ</small></span></div><div class="home-slots">'+SLOTS.map(slot=>{
  const row=set?ownedInventory.find(r=>r.id===set.slots[slot]):null;
  return '<article class="home-slot '+(row?'equipped':'empty')+'" data-equipment-slot="'+slot+'">'+(!row?'<div class="home-slot-label" title="'+LABELS[slot]+'">'+labels[slot]+'</div>':'')+'<div class="home-slot-tile"><button class="home-slot-select" '+(row?'data-home-inspect="'+slot+'"':'data-home-slot="'+slot+'"')+(accountLoading?' disabled':'')+' aria-label="'+esc((row?'Осмотреть скин':'Добавить скин')+': '+LABELS[slot])+'">'+(row?skinArt(row):'<span class="skin-card-art empty-art"><span>+</span></span>')+'</button></div></article>';
 }).join('')+'</div>'+(account?.inventoryError?'<p class="equipment-error">Не удалось проверить скины. <button class="text-button" data-retry-profile data-refresh-inventory>Обновить ↻</button></p>':'')+'</div></section>';
}
function reservedSkin(id,setId){return state.sets.some(s=>s.id!==setId&&Object.values(s.slots||{}).includes(id));}
function chooseHomeSkin(slot){
 if(!account){go('profile');return;}
 if(account.inventoryStatus!=='connected'){toast('Обнови инвентарь в профиле.');return;}
 homePicker=true;const active=state.sets.find(s=>s.id===state.active),id=ownedSet(active)?active.slots[slot]:null,rows=ownedInventory.filter(r=>r.slot===slot&&r.owned&&r.source==='notgames'&&!reservedSkin(r.id,active?.id));
 modal('ТВОЙ СЕТ','<h2 class="modal-title">'+LABELS[slot]+'</h2><p class="modal-subtitle">Каждый надетый скин добавляет +10% к наградам DMX.</p><div class="picker-grid home-skin-choices">'+rows.map(row=>'<button class="skin-choice '+(id===row.id?'selected':'')+'" data-equip-item="'+esc(row.id)+'" data-target-slot="'+slot+'" aria-label="Надеть '+esc(row.name)+'">'+skinArt(row)+skinCopy(row)+'<small>'+(id===row.id?'НАДЕТО':'Надеть · +10%')+'</small></button>').join('')+'</div>'+(!rows.length?'<p class="modal-subtitle">Нет свободных скинов для этого слота. Скин из другого сета сначала нужно убрать оттуда.</p>':''),[...(id?[{label:'Снять скин',secondary:true,run:async()=>{if(await action('equipSlot',{slot,itemId:null},'Скин снят.'))$('#dialog').close();}}]:[]),{label:'Закрыть',secondary:true,run:()=>$('#dialog').close()}]);
}
function profileSkin(row,slot='',equipped=false){return row?'<button class="profile-skin '+(equipped?'is-equipped':'')+'" data-item="'+esc(row.id)+'" aria-label="Осмотреть '+esc(row.collection+' '+row.name)+'">'+skinArt(row)+'<span class="profile-skin-name">'+esc(row.name)+'</span>'+(equipped?'<small>НАДЕТО</small>':'<small>'+esc(row.serial?'#'+row.serial:row.collection)+'</small>')+'</button>':'<button class="profile-skin empty" '+(page==='profile'&&equipped?'data-home-slot="'+slot+'"':'disabled')+' aria-label="'+esc(LABELS[slot])+'"><span class="skin-card-art empty-art">+</span><span class="profile-skin-name">'+LABELS[slot]+'</span><small>Нет скина</small></button>';}
function marketProfile(view=null){
 const own=!view,data=view||{name:account?.link?.name||(window.DMXI18n?.t('Игрок')||'Игрок'),photoUrl:account?.user?.photoUrl,inventory:ownedInventory,sets:state.sets,active:state.active,dmx:account?.dmx,updatedAt:null,clan:account?.link?account.gameStats?.clan:null};
 if(!own&&data.private)return '<section class="market-profile private-profile"><button class="text-button page-back" data-member-back>← Рейтинг</button><div class="market-profile-banner">'+photoAvatar(data.name,data.photoUrl)+'<div><h1 data-i18n-skip>'+esc(data.name)+'</h1></div></div><div class="private-profile-notice"><span aria-hidden="true">▣</span><h2>Приватный профиль</h2><p>Игрок скрыл свои скины, сеты и игровую статистику.</p></div></section>';
 const rows=data.inventory||[],sets=data.sets||[],candidate=sets.find(s=>s.id===data.active),active=own?(ownedSet(candidate)?candidate:null):candidate;
 const ids=new Set(Object.values(active?.slots||{})),usedIds=new Set(sets.flatMap(s=>Object.values(s.slots||{}))),other=rows.filter(r=>!usedIds.has(r.id));
 let content='<section class="profile-inventory"><div class="section-head"><div><h2>Надетый сет</h2><p'+(active?.name?' data-i18n-skip':'')+'>'+esc(active?.name||(own?'Выбери скины на главной':'Нет надетого сета'))+'</p></div><span class="profile-bonus">+'+(ids.size*10)+'%</span></div><div class="profile-skin-grid equipped-row">'+SLOTS.map(slot=>profileSkin(rows.find(r=>r.id===active?.slots[slot]),slot,true)).join('')+'</div>';
 const savedSets=sets.filter(s=>s.id!==active?.id);
 if(savedSets.length)content+='<div class="section-head"><h2>Сохранённые сеты</h2></div>'+savedSets.map(s=>'<article class="profile-saved-set"><div class="section-head"><b data-i18n-skip>'+esc(s.name)+'</b>'+(own?'<div><button class="text-button" data-equip="'+esc(s.id)+'" '+(!ownedSet(s)?'disabled':'')+'>Надеть</button><button class="text-button" data-edit="'+esc(s.id)+'">Изменить</button></div>':'')+'</div><div class="profile-skin-grid">'+SLOTS.map(slot=>profileSkin(rows.find(r=>r.id===s.slots[slot]),slot)).join('')+'</div></article>').join('');
 if(own)content+='<button class="secondary profile-add-set" data-create>+ Добавить сет</button>';
 content+='<div class="section-head"><h2>Другие скины</h2><small>'+other.length+'</small></div>'+(other.length?'<div class="profile-skin-grid other-skins">'+other.map(r=>profileSkin(r)).join('')+'</div>':'<p class="profile-empty">'+(rows.length?'':'Пока нет подтверждённых скинов.')+'</p>');
 content+='</section>';
 return '<section class="market-profile">'+(!own?'<button class="text-button page-back" data-member-back>← '+(memberBack==='clan'?'Участники клана':'Рейтинг')+'</button>':'')+'<div class="market-profile-banner">'+photoAvatar(data.name,data.photoUrl)+'<div><h1 data-i18n-skip>'+esc(data.name)+'</h1>'+(data.clan?.id?'<button class="profile-clan-link" data-clan="'+data.clan.id+'">'+clanAvatar(data.clan)+'<span>'+esc(data.clan.name)+' ↗</span></button>':(data.clan?.name?'<p>'+esc(data.clan.name)+'</p>':''))+(own&&account?'<small class="profile-telegram-id"><span>Telegram ID:</span><span>'+account.user.id+'</span></small>':'')+'</div>'+(own?'<button class="text-button" data-settings>Настройки</button>':'')+'</div>'+profileCounters(rows,sets,data,own)+''+(!account&&own&&!accountLoading?'<div class="connection-strip"><span>Войди через Telegram для сохранения профиля.</span><a class="secondary" href="https://t.me/DMXARENABOT">Войти</a></div>':'')+content+(own&&account?.inventoryError?notice(esc(account.inventoryError)):'')+'</section>';
}
async function openMember(id){
 if(id===account?.user?.profileId){go('profile');return;}const request=++memberRequest;memberBack=page==='clan'?'clan':'top';profileTab='inventory';member=null;memberLoading=true;go('member');
 try{const result=await DMXApi.call('getPublicProfile',{id});if(page!=='member'||request!==memberRequest)return;member=result;for(const row of result.inventory||[])if(!item(row.id))catalog.push({...row,owned:false,source:'public_profile'});}
 catch(error){if(request===memberRequest)toast(error.message);}finally{if(request===memberRequest){memberLoading=false;if(page==='member')render();}}
}
async function openClan(id){
 const clanId=Number(id);if(!Number.isSafeInteger(clanId)||clanId<1)return;
 $('#dialog').close();const request=++clanRequest;clanLoading=true;clanError='';clanView=null;go('clan');
 try{const result=await DMXApi.call('getClanMembers',{id:clanId});if(page!=='clan'||request!==clanRequest)return;clanView=result;}
 catch(error){if(request===clanRequest)clanError=error.message;}
 finally{if(request===clanRequest){clanLoading=false;if(page==='clan'){render();if(clanError)$('#main').insertAdjacentHTML('beforeend','<button class="secondary" data-clan="'+clanId+'">Повторить ↻</button>');}}}
}
function playerRows(rows){return rows.map(row=>{
 const identity=photoAvatar(row.name,row.photoUrl,'ranking-photo')+'<span class="ranking-name" data-i18n-skip title="'+esc(row.name)+'">'+esc(row.name)+'</span>';
 return '<article class="ranking-row player-ranking-row"><b class="rank-place">'+row.rank+'</b>'+(row.profileId?'<button class="ranking-profile-link ranking-player" data-member="'+esc(row.profileId)+'" aria-label="Профиль '+esc(row.name)+'">'+identity+'</button>':'<span class="ranking-player">'+identity+'</span>')+'<strong class="ranking-balance">'+number(row.score)+'<small>$DMX</small></strong></article>';
}).join('');}
function clanPage(){
 const back='<button class="text-button page-back" data-go="top">← Рейтинг</button>';
 if(!clanView)return back+notice(clanLoading?'Загружаем участников клана…':esc(clanError||'Клан недоступен.'));
 const clan=clanView.clan;return '<section class="clan-page">'+back+'<div class="clan-profile-heading">'+clanAvatar(clan,'large')+'<div><span class="eyebrow">КЛАН PIXEL WORLD</span><h1>'+esc(clan.name)+'</h1><p>'+number(clan.members)+' участников в DMX</p></div></div><div class="clan-profile-score"><strong>'+number(clan.score)+' <small>$DMX</small></strong><span>Всего DMX у участников клана</span></div><div class="section-head"><h2>Игроки в нашем приложении</h2></div>'+(clanView.players.length?'<div class="ranking-list">'+playerRows(clanView.players)+'</div>':'<div class="empty-state"><h3>Участников DMX пока нет</h3><p>Игроки появятся здесь после привязки игрового ID и определения клана.</p></div>')+'</section>';
}
function profileCounters(rows,sets,data,own){
 const stats=own?account?.gameStats?.mapProgress?.territoryStats:data.activity?.territoryStats,known=!!stats?.observedSince;
 const icons={skins:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',sets:'m3 7 9-4 9 4-9 4zM3 12l9 4 9-4M3 17l9 4 9-4',dmx:'M8 3h8l5 5v8l-5 5H8l-5-5V8zM9 8h4l3 4-3 4H9z',captures:'M5 21V3h14v10H5M9 3v10'};
 const values=[['skins','Скинов',number(rows.length)],['sets','Сетов',number(sets.length)],['dmx','$DMX',number(data.dmx?.balance)],['captures','Захвачено карт',known?number(stats.total):'—']];
 return '<div class="profile-counters" role="list">'+values.map(([key,label,value])=>'<div class="profile-stat" data-stat="'+key+'" role="listitem"'+(key==='captures'?' title="'+esc(known?'При личном вкладе от 1 000. Учёт DMX с '+battleTime(stats.observedSince)+'. История до наблюдения не восстановлена.':'Учёт начнётся после подключения игры.')+'"':'')+'><div class="profile-stat-value"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+icons[key]+'"/></svg><b'+(value.length>6?' class="stat-long"':'')+'>'+value+'</b></div><span class="profile-stat-label">'+label+'</span></div>').join('')+'</div>';
}
function clanTabs(){return '<div class="clan-tabs"><div role="tablist" aria-label="Раздел клана">'+[['battles','Битвы'],['quests','Задания']].map(([key,label])=>'<button role="tab" aria-selected="'+(page===key)+'" class="'+(page===key?'active':'')+'" data-go="'+key+'">'+label+'</button>').join('')+'</div><button class="text-button" data-go="top">Рейтинг ↗</button></div>';}
function battlePage(){
 const maps=warMaps(),selected=chosenBattle(),clan=account?.gameStats?.clan,now=Date.now(),live=maps.filter(m=>DMXLobby.phase(m,now)==='live'),owned=clan?.status==='found'?maps.filter(m=>DMXLobby.phase(m,now)==='ownership'&&m.owner?.id===clan.id).length:null;
 const phase=DMXLobby.phase(selected,now),board=selected?.lastBattle;
 const matching=board&&board.startsAt===selected?.startsAt&&board.endsAt===selected?.endsAt;
 const currentRow=phase==='live'&&matching?board.teams?.find(r=>r.id===clan?.id):null;
 const mapButtons=maps.map(map=>'<button class="map-tile '+(map.map_id===selected?.map_id?'selected':'')+'" data-select-map="'+esc(map.map_id)+'" aria-pressed="'+(map.map_id===selected?.map_id)+'">'+mapPhoto(map.map_id)+'<span class="map-tile-copy"><span class="map-tile-top"><b>'+esc(mapName(map.map_id))+'</b><i class="'+(DMXLobby.phase(map,now)==='live'?'live':'')+'"></i></span><small>'+phaseLabel(map)+'</small><span class="map-owner">'+esc(map.owner?.name||'Владелец не определён')+'</span></span></button>').join('');
 return '<div class="war-heading"><div>'+title('DMX / WAR ROOM','Клановые битвы','Следи за картами. Сражайся за свой клан.')+'</div>'+graffiti('swords')+'</div><div class="war-toolbar"><span><i></i>'+live.length+' '+(live.length===1?'битва':'битв')+' сейчас</span><button class="text-button" data-refresh-battles '+(battleBusy?'disabled':'')+'>'+(battleBusy?'Обновляю…':'Обновить ↻')+'</button></div>'+(battleError?'<p class="war-error" role="status">'+esc(battleError)+'</p>':'')+
 (!maps.length?'<div class="empty-state"><h3>Загружаем карты</h3><p>Расписание и результаты появятся из игры.</p></div>':'<div class="war-layout"><section class="current-war"><div class="war-photo">'+mapPhoto(selected.map_id)+'</div><div class="war-overview-top"><span class="war-badge '+(phase==='live'?'live':'')+'">'+phaseLabel(selected)+'</span><span class="eyebrow">КЛАНОВАЯ ВОЙНА</span></div><h2>'+esc(mapName(selected.map_id))+'</h2><p class="war-owner">Владелец: <b>'+esc(selected.owner?.name||'Пока не определён')+'</b></p>'+clockMarkup(selected)+'<div class="war-score"><span>Твой клан</span><b>'+esc(clan?.status==='found'?clan.name:'Привяжи игровой ID')+'</b><div><strong>'+(currentRow?number(currentRow.score):'—')+'</strong><small>'+(currentRow?'очков · место '+currentRow.rank:phase==='live'?'Пока нет строки твоего клана в таблице':'Очки появятся во время битвы')+'</small></div></div><p class="war-schedule">'+(phase==='live'||phase==='upcoming'?'Битва: '+battleTime(selected.startsAt)+' — '+battleTime(selected.endsAt):phase==='ownership'?'Следующая битва: '+battleTime(selected.nextBattleStartsAt||selected.endsAt):'Ждём новое расписание из игры')+'</p>'+(board?'<button class="secondary" data-battle-map="'+esc(selected.map_id)+'">'+(phase==='live'&&matching?'Таблица текущей битвы':'Итоги последней битвы')+' ↗</button>':'')+'<p class="data-time">Из игры · '+updated(account?.gameStats?.clanWars?.updatedAt||clanMaps?.updatedAt)+'</p></section>'+battleGoal(selected,true)+'</div><div class="section-head"><div><h2>Карты сражений</h2><p>Выбери карту для цели и результатов.</p></div></div><div class="war-maps">'+mapButtons+'</div>')+
 '<div class="clan-control"><div><small>ТВОЙ КЛАН</small><b>'+esc(clan?.status==='found'?clan.name:'Подключи свой профиль')+'</b><p>'+(owned!==null?'Сейчас во владении: '+owned+' из '+maps.length+' карт.':'Узнаем клан по твоему игровому ID.')+'</p></div><button class="secondary" data-go="'+(account?.link?'quests':'profile')+'">'+(account?.link?'Цели клана':'Подключить игру')+' ↗</button></div><button class="clan-island war-island" data-clan-island>'+graffiti('island')+'<span><b>Остров клана</b><small>Здесь появится остров, когда функция станет доступна в игре.</small></span><em>SOON</em></button>';
}
function clanIsland(){modal('ОСТРОВ КЛАНА','<div class="island-preview">'+graffiti('island')+'<span class="soon-label">SOON</span><h2 class="modal-title">Остров клана</h2><p class="modal-subtitle">Будущий дом твоего клана.<br>Подключим остров, когда он появится в Pixel World.</p></div>',[{label:'В штаб',secondary:true,run:()=>{$('#dialog').close();go('home');}}]);}
function playMap(mapId){
 const map=warMaps().find(m=>m.map_id===mapId);
 if(DMXLobby.phase(map)!=='live'){toast('Битва уже завершилась. Обновляем расписание.');render();refreshBattles();return;}
 const url='https://t.me/pixelworld/play';
 if(telegram?.openTelegramLink)telegram.openTelegramLink(url);else window.open(url,'_blank','noopener');
}
function scheduleBattles(){clearTimeout(battleTimer);if(catalogReady&&!document.hidden&&['home','battles','quests','profile'].includes(page))battleTimer=setTimeout(()=>refreshBattles(),30000);}
async function refreshBattles(){
 if(!catalogReady||battleBusy||document.hidden)return;scheduleBattles();
 const request=++battleRequest,uuid=account?.link?.playerId,userId=account?.user?.id;battleBusy=true;battleError='';
 try{
  const result=await DMXApi.call(uuid?'syncClanBattles':'getClanMaps');
  if(request!==battleRequest||uuid!==account?.link?.playerId||userId!==account?.user?.id)return;
  if(uuid&&result?.clanWars?.source==='pixel_world_api'){const {quests,questBoard,dmx,...stats}=result;const previous=account.dmx?.balance||0;account.gameStats={...account.gameStats,...stats};if(dmx){account.dmx=dmx;if(dmx.balance>previous)toast('+'+number(dmx.balance-previous)+' $DMX за выполнение целей');}if(questBoard)account.questBoard=questBoard;if(Array.isArray(quests))account.quests=quests;}
  else if(!uuid&&result?.source==='pixel_world_api'&&Array.isArray(result.maps))clanMaps=result;
 }catch(error){battleError='Не удалось обновить битвы. '+error.message;}
 finally{battleBusy=false;if(request===battleRequest&&['home','battles','quests','profile'].includes(page))render();scheduleBattles();}
}
function warPhaseSignature(){return warMaps().map(map=>map.map_id+':'+DMXLobby.phase(map)).join('|');}
setInterval(()=>{if(document.hidden)return;for(const element of document.querySelectorAll('[data-countdown]'))element.textContent=countdown(Number(element.dataset.countdown));if(['home','battles','quests','profile'].includes(page)&&warPhaseSignature()!==battlePhaseSnapshot){render();refreshBattles();}},1000);
document.addEventListener('visibilitychange',()=>{clearTimeout(battleTimer);if(!document.hidden&&['home','battles','quests','profile'].includes(page))refreshBattles();});


function render(){
 const homeMapScroll=document.querySelector('.home-map-strip')?.scrollLeft||0,mapScroll=document.querySelector('.map-strip')?.scrollLeft||0,openGuides=[...document.querySelectorAll('.quest-guide[open]')].map(node=>node.querySelector('summary')?.textContent);
 nav();$('#coins b').textContent=number(account?.dmx?.balance);document.documentElement.style.setProperty('--dmx-balance-chars',String($('#coins b').textContent.length));
 const qs=(account?.quests||defaultQuests).filter(q=>!['warmup','tempo'].includes(q.id)),stats=account?.gameStats;
 let html='';
 if(page==='home'){
  html=lobbyPage();
 }else if(page==='quests'){
  html=questsPage(qs.length?qs:defaultQuests,stats);
 }else if(page==='sets'){
  const inspiration=[...examples,...state.bookmarks.filter(s=>!examples.some(e=>e.id===s.id))];
  html=title('LOADOUT STUDIO','Сеты','Твои скины. Твои сочетания.')+'<div class="filters">'+[['all','Мои'],['saved','Образцы']].map(([key,label])=>'<button class="'+(filter===key?'active':'')+'" data-filter="'+key+'">'+label+'</button>').join('')+'<button data-browse-skins>Каталог скинов ↗</button></div>'+
  (filter==='saved'?'<div class="set-grid">'+inspiration.map(s=>card(s,'public')).join('')+'</div>':'<div class="section-head"><div><h2>Твои игровые сеты</h2><p>'+state.sets.length+' / 20 сетов · '+ownedInventory.length+' скинов</p></div><button class="primary" data-create>+ Создать</button></div>'+
  (state.sets.length?'<div class="set-grid">'+state.sets.map(s=>card(s)).join('')+'</div>':'<div class="empty-state">'+svg('sets')+'<h3>С чистого листа</h3><p>'+(accountLoading?'Загружаю твой инвентарь…':account?'Выбери предметы из своего инвентаря NotGames.':'Открой DMX в Telegram, чтобы создавать свои сеты.')+'</p><button class="secondary" data-go="profile">Открыть профиль</button></div>'))+
  (account?.inventoryError?notice(esc(account.inventoryError)):'')+notice('Сет сохраняется в DMX. Экипировку в самой игре он пока не меняет.');
 }else if(page==='tournaments'){
  html=notice('Турниры · SOON');
 }else if(page==='top'){
  html='<section class="dmx-ranking"><div class="page-title ranking-heading"><h1>Рейтинг</h1></div>'+
  '<div class="ranking-tabs" role="tablist" aria-label="Рейтинг DMX">'+[['players','Игроки'],['clans','Кланы']].map(([key,label])=>'<button type="button" id="rating-tab-'+key+'" role="tab" aria-selected="'+(topGroup===key)+'" aria-controls="rating-list" tabindex="'+(topGroup===key?0:-1)+'" class="'+(topGroup===key?'active':'')+'" data-top-group="'+key+'">'+label+'</button>').join('')+'</div><div id="rating-list" role="tabpanel" aria-labelledby="rating-tab-'+topGroup+'" aria-busy="'+topLoading+'">'+
  (topLoading?'<p class="ranking-empty">Загружаю рейтинг…</p>':ranking.length?'<div class="ranking-list">'+ranking.map(row=>topGroup==='clans'?'<button class="ranking-row clan-ranking-row" data-clan="'+row.clanId+'"><b class="rank-place">'+row.rank+'</b>'+clanAvatar(row)+'<span class="ranking-name"><b data-i18n-skip>'+esc(row.name)+'</b><small>'+number(row.members)+' участников DMX</small></span><strong>'+number(row.score)+'<small>$DMX</small></strong></button>':playerRows([row])).join('')+'</div>':'<p class="ranking-empty">'+(topGroup==='clans'?'Здесь появятся кланы участников DMX.':'Здесь появятся участники DMX и их заработанные очки.')+'</p>')+(topError?'<p class="ranking-error" role="status">'+esc(topError)+'</p>':'')+'</div></section>';
 }else if(page==='clan'){
  html=clanPage();
 }else if(page==='member'){
  html=member?marketProfile(member):notice(memberLoading?'Загружаю профиль…':'Профиль недоступен.');
 }else{
  html=marketProfile();
 }
 $('#main').innerHTML=html;document.body.dataset.page=page;window.DMXI18n?.apply();syncTelegramBack();
 if(page==='home'&&document.querySelector('.home-map-strip'))document.querySelector('.home-map-strip').scrollLeft=homeMapScroll;
 if(page==='quests'){for(const guide of document.querySelectorAll('.quest-guide'))guide.open=openGuides.includes(guide.querySelector('summary')?.textContent);const strip=document.querySelector('.map-strip');if(strip)strip.scrollLeft=mapScroll;}
 if(page==='profile'&&accountError&&telegram?.initData)document.querySelector('.market-profile-banner')?.insertAdjacentHTML('afterend','<div class="home-connection-error profile-connection-error" role="status"><span>'+esc(accountError)+'</span><button class="text-button" data-retry-profile>Повторить ↻</button></div>');
 syncViewport();
 if(['home','battles','quests','profile'].includes(page)){battlePhaseSnapshot=warPhaseSignature();scheduleBattles();}
}
function allPublic(){return [...examples,...state.sets.filter(s=>s.published).map(s=>({...s,author:state.name})),...state.bookmarks.filter(s=>!examples.some(e=>e.id===s.id)&&!state.sets.some(e=>e.id===s.id))];}
function questsPage(qs,stats){return releasedQuestsPage(stats);}
function previewQuestBoard(){return {mode:'preview',claimsEnabled:false,status:'waiting_data',stages:[{title:'К оружию',target:1000,cumulative:10},{title:'Боевой вклад',target:2000,cumulative:25},{title:'Ударная сила',target:3000,cumulative:50}],totalPaid:0,skinBonusPercent:0,totalEarned:0,maps:[]};}
function releasedQuestsPage(){
 const board=account?.questBoard||previewQuestBoard(),guide=window.DMXQuestGuide,missions=board.missions,missionRows=missions?.rows||[],subscription=board.subscription||{claimed:false};
 const bonusPercent=account?.equipmentBonus?.percent??board.skinBonusPercent??0;
 const row=(goal,reward,options={})=>'<article class="task-row'+(options.active?' active-task':'')+(options.claimed?' task-complete':'')+'"'+(options.id?' data-quest-id="'+esc(options.id)+'"':'')+'><div class="task-goal"><h3>'+esc(goal)+'</h3>'+(options.hint?'<small class="task-progress">'+esc(options.hint)+'</small>':'')+(options.progress!==undefined?'<small class="task-progress">'+(options.claimed?'Выполнено ✓':number(options.progress)+' / '+number(options.target))+'</small>':'')+'</div><div class="task-reward"><b>'+esc(reward)+'</b><small>$DMX</small></div></article>';
 const active=board.stages.map((stage,index)=>row(number(stage.target)+' очков за битву',number(stage.base??[10,25,50][index]),{active:true})).join('');
 const daily=(guide?.dailyMaps||[]).map(goal=>'<section class="task-group daily-map-group" data-daily-map-count="'+goal.maps+'"><div class="task-group-heading"><h2>На '+goal.maps+' картах</h2></div><div class="task-list">'+[1000,2000,3000].map((target,i)=>{
  const id='daily_maps_'+goal.maps+'_'+target,progress=missionRows.find(r=>r.id===id);
  return row('По '+number(target)+' очков на '+goal.maps+' картах',number(goal.rewards[i]),{id,...(missions?.enabled&&progress?progress:{})});
 }).join('')+'</div></section>').join('');
 const descriptions={
  'Недельный маршрут':'По 1 000 очков на 5 / 10 картах за неделю',
  'Большой вклад':'10 000 очков за неделю',
  'Масштабный вклад':'25 000 очков за неделю',
  'Победа на карте':'Победить на карте · топ-5 по вкладу от 1 000',
  'Захват / защита':'Захватить или защитить карту · вклад от 1 000'
 };
 const labels=['За неделю','За победу'];
 const groups=(guide?.groups||[]).slice(1).map((group,i)=>'<section class="task-group'+(missions?.enabled?'':' planned-group')+'"><div class="task-group-heading"><h2>'+labels[i]+'</h2>'+(missions?.enabled?'':'<span class="task-soon">Скоро</span>')+'</div><div class="task-list">'+group.quests.map(([name,condition,reward])=>{
  const matches=missionRows.filter(r=>r.title===name),progress=matches.find(r=>!r.claimed)||matches.at(-1),periodic=i===1;
  return row(descriptions[name]||condition,reward,{...(missions?.enabled&&progress&&!periodic?progress:{}),...(name==='Победа на карте'?{hint:'Ящики, Панелька, Город — 100; остальные — 50.'}:{})});
 }).join('')+'</div></section>').join('');
 const social='<section class="task-group social-quest">'+row('Подписаться на @DMX_Core','100',{claimed:subscription.claimed})+(subscription.claimed?'<p class="task-social-done">Награда получена ✓</p>':'<div class="task-social-actions"><a class="secondary" href="https://t.me/DMX_Core" target="_blank" rel="noopener" data-subscribe>Подписаться ↗</a><button class="primary" data-check-subscription '+(!account||!board.claimsEnabled?'disabled':'')+'>Проверить подписку</button></div><small class="task-social-note">Один раз · без бонуса сета</small>')+'</section>';
 const nickname=missionRows.find(r=>r.id==='nickname_dmx'),dismissed=!!account?.dismissedQuests?.includes('nickname_dmx'),nicknameQuest='<section class="task-group nickname-quest">'+row('Добавить DMX в ник в игре','50',{id:'nickname_dmx',...(nickname||{})})+(!nickname?.claimed?'<div class="task-social-actions"><button class="primary" data-check-nickname '+(!account?.link||!board.claimsEnabled?'disabled':'')+'>Проверить ник</button><button class="secondary" data-dismiss-nickname="'+(!dismissed)+'" '+(!account?'disabled':'')+'>'+(dismissed?'Вернуть задание':'Отказаться')+'</button></div><small class="task-social-note">Один раз · без бонуса сета</small>':'')+'</section>';
 const oneTime=[{html:social,claimed:subscription.claimed},{html:nicknameQuest,claimed:nickname?.claimed,dismissed}],pendingOneTime=oneTime.filter(q=>!q.claimed&&!q.dismissed).map(q=>q.html).join(''),completedOneTime=oneTime.filter(q=>q.claimed).map(q=>q.html).join(''),dismissedOneTime=oneTime.filter(q=>!q.claimed&&q.dismissed).map(q=>q.html).join('');
 return '<section class="quest-page simple-quests"><div class="simple-quests-heading"><h1>Задания</h1>'+(bonusPercent?'<span class="task-bonus">+'+bonusPercent+'% к повторяемым игровым заданиям</span>':'')+'</div>'+pendingOneTime+(!account?.link?'<button class="task-connect" data-link-player>Привязать игру <span>→</span></button>':'')+'<section class="task-group"><div class="task-group-heading"><h2>На каждой карте</h2></div><div class="task-list">'+active+'</div></section>'+((board.error||battleError)?'<p class="task-error" role="status">'+esc(board.error||battleError)+'</p>':'')+daily+groups+(completedOneTime?'<section class="completed-quests"><div class="task-group-heading"><h2>Выполненные</h2></div>'+completedOneTime+'</section>':'')+(dismissedOneTime?'<section class="deferred-quests"><div class="task-group-heading"><h2>Отложенные</h2></div>'+dismissedOneTime+'</section>':'')+'</section>';
}
function combinedBattles(){
 const maps=warMaps(),map=chosenBattle(),clan=account?.gameStats?.clan,phase=DMXLobby.phase(map),board=map?.lastBattle;
 const matching=board&&board.startsAt===map?.startsAt&&board.endsAt===map?.endsAt;
 const row=phase==='live'&&matching?board.teams?.find(r=>r.id===clan?.id):null;
 const cards=maps.map(m=>'<button class="map-tile '+(m.map_id===map?.map_id?'selected':'')+'" data-select-map="'+esc(m.map_id)+'" aria-pressed="'+(m.map_id===map?.map_id)+'">'+mapPhoto(m.map_id)+'<span class="map-tile-copy"><span class="map-tile-top"><b>'+esc(mapName(m.map_id))+'</b><i class="'+(DMXLobby.phase(m)==='live'?'live':'')+'"></i></span><small>'+phaseLabel(m)+'</small><span class="map-owner">'+esc(m.owner?.name||'Владелец не определён')+'</span></span></button>').join('');
 return '<section class="combined-battles"><div class="war-toolbar"><span>'+(clan?.status==='found'?esc(clan.name):'Клановые битвы')+'</span><button class="text-button" data-refresh-battles '+(battleBusy?'disabled':'')+'>'+(battleBusy?'Обновляю…':'Обновить ↻')+'</button></div>'+(battleError?'<p class="war-error" role="status">'+esc(battleError)+'</p>':'')+
 (map?'<div class="war-layout"><section class="current-war"><div class="war-photo">'+mapPhoto(map.map_id)+'<span class="war-badge '+(phase==='live'?'live':'')+'">'+phaseLabel(map)+'</span></div><h2>'+esc(mapName(map.map_id))+'</h2><p class="war-owner">Владелец: <b>'+esc(map.owner?.name||'Пока не определён')+'</b></p>'+clockMarkup(map)+(row?'<div class="war-score"><span>Твой клан</span><div><strong>'+number(row.score)+'</strong><small>очков · место '+row.rank+'</small></div></div>':'')+'<p class="war-schedule">'+(phase==='live'||phase==='upcoming'?battleTime(map.startsAt)+' — '+battleTime(map.endsAt):phase==='ownership'?'Начало: '+battleTime(map.nextBattleStartsAt||map.endsAt):'Ждём расписание игры')+'</p>'+(board?'<button class="secondary" data-battle-map="'+esc(map.map_id)+'">'+(phase==='live'&&matching?'Результаты битвы':'Последние результаты')+' ↗</button>':'')+'</section>'+battleGoal(map,true)+'</div>':'<div class="empty-state"><h3>'+(battleError?'Расписание пока недоступно':'Загружаем карты')+'</h3><p>Расписание и результаты появятся из игры.</p></div>')+
 (cards?'<div class="quest-map-heading"><h2>Карты</h2><small>Выбери сражение</small></div><div class="war-maps map-strip">'+cards+'</div>':'')+'</section>';
}
function showEconomy(){
 const guide=window.DMXQuestGuide;if(!guide)return;
 const table=(heads,rows)=>'<table class="economy-table"><thead><tr>'+heads.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
 modal('ЭКОНОМИКА DMX','<div class="economy-guide"><h2 class="modal-title">За что получаем $DMX</h2>'+notice(account?.questBoard?.claimsEnabled?'Задания открыты. Игровые награды начисляются автоматически.':'Открой DMX в Telegram, чтобы выполнять задания.')+
 '<p>DMX — внутренние очки приложения. Личный и клановый рейтинг накопительный, без сезонов.</p><h3>Лестница каждой карты</h3><p>1 000 / 2 000 / 3 000 личных очков за одну битву дают 10 / 25 / 50 $DMX суммарно. Доплаты без сета: 10 + 15 + 25. На каждой карте отдельный прогресс. В новой битве той же карты цели начинаются заново; дневного лимита и сброса нет.</p><h3>Бонус надетого сета</h3><p>Бонус сета действует на повторяемые игровые задания: +10% за свой надетый скин, максимум +50%. Одноразовые задания без бонуса: подписка — 100 DMX, DMX в нике — 50 DMX. Награда каждого задания округляется вниз до целого DMX. Проверяем владение скинами при начислении; уже полученные награды не пересчитываются.</p><h3>Подписка</h3><p>Подписка @DMX_Core — 100 DMX один раз после проверки Telegram. Повторная подписка не даёт второй награды.</p><h3>Ежедневные и недельные цели</h3><p>Ежедневные цели на 2, 3 и 5 картах доступны одновременно. На каждой карте нужен вклад 1 000 / 2 000 / 3 000 за одну битву. Награды: 5 / 10 / 15, 10 / 25 / 50 и 25 / 50 / 75 DMX соответственно. Каждая из девяти целей оплачивается отдельно один раз в день — до 265 DMX.</p><p>Недельный маршрут: по 1 000 на 5 разных картах — 100 DMX; на 10 — ещё 150, всего 250. Отдельные задания: 10 000 очков за неделю — 250 DMX, 25 000 — ещё 500 DMX. Все недельные награды вместе — до 1 000 DMX.</p><h3>Победы</h3><p>Победа при личном вкладе от 1 000 — 10 DMX за захват или защиту. Топ-5 DMX победившего клана по учтённому вкладу дополнительно получает 100 DMX на Ящиках, Панельке и в Городе, 50 DMX — на остальных картах. Нужны итог битвы и подтверждённый владелец.</p>'+table(['Карта','Награда'],guide.mapRewards.map(([name,reward])=>[name,reward+' DMX']))+
 '<h3>Учёт и периоды</h3><p>Дополнительные цели учитывают завершённые битвы после запуска. Начисление — через 5 минут 30 секунд после завершения: ждём окончания последних матчей и обновления данных. День — с 00:00 UTC, неделя — с понедельника 00:00 UTC. Незачтённая из-за задержки награда сохраняется за своим периодом.</p><p>Считаем безопасно наблюдённый личный вклад. При пропусках и пересечениях битв неподтверждённые очки не зачисляются. Историю до наблюдения не восстанавливаем.</p><h3>Размер наград</h3><p>За полностью пройденную выигранную битву участник топ-5 получает 110–160 DMX без сета или 165–240 с полным сетом. К этому добавляются выполненные дневные, недельные и разовые цели. Общего дневного лимита нет.</p><p>Фонды владения клана и турниры пока не начисляются.</p><p><a href="economy-review.md" target="_blank" rel="noopener">Все задания и полные правила ↗</a></p></div>',[{label:'Понятно',secondary:true,run:()=>$('#dialog').close()}]);
}
function modal(label,html,buttons=[],back=null){dialogBack=back;$('#dialogLabel').textContent=label;$('#dialogBody').innerHTML=html;$('#dialogActions').innerHTML='';for(const spec of buttons){const b=document.createElement('button');b.type='button';b.className=spec.secondary?'secondary':'primary';b.textContent=spec.label;b.onclick=spec.run;$('#dialogActions').append(b);}if(!$('#dialog').open)$('#dialog').showModal();$('#dialogBody').scrollTop=0;syncTelegramBack();window.DMXI18n?.apply();}
function close(){if(dialogBack){const back=dialogBack;dialogBack=null;back();}else $('#dialog').close();}
function editor(set=null){if(!account||account.inventoryStatus!=='connected'){toast('Откройте DMX в Telegram и обновите инвентарь NotGames в профиле.');return;}draft={id:set?.id||crypto.randomUUID(),name:set?.name||'',slots:{...(set?.slots||{})},published:!!set?.published};editorRender();}
function stashName(){if($('#setName'))draft.name=$('#setName').value;}
function editorRender(){
 modal('LOADOUT STUDIO','<div class="loadout-heading"><div><h2 class="modal-title">Собери свой сет</h2><p class="modal-subtitle">Выбери пять предметов для игры.</p></div></div><label>Название сета<input id="setName" maxlength="32" placeholder="Например, Night shift" value="'+esc(draft.name)+'"></label><div class="slots-grid loadout-grid">'+SLOTS.map(slot=>{const row=item(draft.slots[slot]);return '<article class="slot loadout-slot '+(row?'filled':'')+'"><button class="slot-face" '+(row?'data-inspect-slot="'+slot+'"':'data-slot="'+slot+'"')+' type="button" aria-label="'+LABELS[slot]+(row?': осмотреть '+esc(row.name):': выбрать скин')+'">'+(row?skinArt(row)+skinCopy(row):'<span class="skin-card-art empty-art">+</span><span class="skin-card-copy"><b>'+LABELS[slot]+'</b><small>Выбрать скин</small></span>')+'</button><div class="slot-controls"><button data-slot="'+slot+'">'+(row?'Заменить':'Выбрать')+'</button><button data-clear="'+slot+'" '+(row?'':'disabled')+' aria-label="Убрать: '+LABELS[slot]+'">×</button></div></article>';}).join('')+'</div>'+(state.sets.some(s=>s.id===draft.id)?'<button class="text-button" data-delete="'+esc(draft.id)+'">Удалить сет</button>':''),[{label:'Сохранить сет',run:saveDraft},{label:'Отмена',secondary:true,run:()=>$('#dialog').close()}]);
}
async function saveDraft(){stashName();if(!validSet(draft)){toast('Укажи название и выбери хотя бы один свой скин.');return;}if(await action('saveSet',draft,'Сет сохранён.'))$('#dialog').close();}
function picker(slot,reset=true){stashName();pickerSlot=slot;if(reset){catalogBrowsing=false;pickerMode=ownedInventory.some(s=>s.slot===slot)?'owned':'catalog';pickerSearch='';}modal('ВЫБОР СКИНА','<h2 class="modal-title">'+LABELS[slot]+'</h2><div class="filters">'+[['owned','Мои скины'],['catalog','Все скины']].map(([key,label])=>'<button class="'+(pickerMode===key?'active':'')+'" data-picker-mode="'+key+'">'+label+'</button>').join('')+'</div><label>Поиск<input id="skinSearch" type="search" placeholder="Скин или коллекция" value="'+esc(pickerSearch)+'"></label><div id="skinChoices" class="picker-grid skin-choices"></div><p class="data-time">'+number(catalogInfo.total)+' моделей · '+catalogInfo.collections?.length+' коллекций · каталог '+battleTime(catalogInfo.updatedAt)+'</p>',[{label:'К конструктору',secondary:true,run:editorRender}],editorRender);renderChoices();}
function renderChoices(){
 let rows=pickerMode==='owned'?ownedInventory.filter(s=>s.slot===pickerSlot):catalog.filter(s=>s.slot===pickerSlot&&(s.source==='public_catalog'||s.source==='notgames'));
 if(pickerSearch)rows=rows.filter(s=>(s.name+' '+s.collection).toLowerCase().includes(pickerSearch.toLowerCase()));
 $('#skinChoices').innerHTML=rows.length?rows.map(s=>'<article class="picker-card skin-choice"><button class="choice-art" data-preview-choice="'+esc(s.id)+'" aria-label="Осмотреть '+esc(s.name)+'">'+skinArt(s)+skinCopy(s)+'</button>'+(s.owned&&s.source==='notgames'&&!catalogBrowsing?'<button class="secondary" data-pick="'+esc(s.id)+'" '+(reservedSkin(s.id,draft?.id)?'disabled':'')+'>'+(reservedSkin(s.id,draft?.id)?'В другом сете':'Выбрать')+'</button>':'<span class="choice-status">'+(s.onSale?'Есть в продаже':'Каталог')+'</span>')+'</article>').join(''):'<div class="picker-empty">'+(pickerSearch?'Ничего не найдено.':pickerMode==='owned'?'Пока нет твоих скинов этой категории. Посмотри «Все скины».':'В этой категории пока нет скинов.')+'</div>';
}
function browseSkinCatalog(slot='primary',reset=true){catalogBrowsing=true;pickerSlot=slot;pickerMode='catalog';if(reset)pickerSearch='';modal('SKIN CATALOG','<h2 class="modal-title">Каталог скинов</h2><p class="modal-subtitle">'+number(catalogInfo.total)+' моделей · '+catalogInfo.collections.length+' коллекций</p><div class="filters">'+SLOTS.map(key=>'<button class="'+(key===slot?'active':'')+'" data-catalog-slot="'+key+'">'+LABELS[key]+'</button>').join('')+'</div><label>Поиск<input id="skinSearch" type="search" placeholder="Скин или коллекция" value="'+esc(pickerSearch)+'"></label><div id="skinChoices" class="picker-grid skin-choices"></div><p class="data-time">Каталог обновлён: '+battleTime(catalogInfo.updatedAt)+'</p>',[{label:'Готово',secondary:true,run:()=>$('#dialog').close()}]);renderChoices();}
function detail(id,options={}){const row=item(id);if(!row)return;const back=options.back||null,buttons=[];
 if(options.homeSlot&&row.owned&&row.source==='notgames')buttons.push({label:'Заменить скин',run:()=>chooseHomeSkin(options.homeSlot)},{label:'Снять',secondary:true,run:async()=>{if(await action('equipSlot',{slot:options.homeSlot,itemId:null},'Скин снят.'))$('#dialog').close();}});
 if(options.slot&&draft){if(row.owned&&row.source==='notgames'&&!reservedSkin(row.id,draft.id)&&draft.slots[options.slot]!==row.id)buttons.push({label:'Выбрать скин',run:()=>{draft.slots[options.slot]=row.id;editorRender();}});else if(draft.slots[options.slot]===row.id)buttons.push({label:'Заменить',run:()=>picker(options.slot)});}
 buttons.push({label:back?'Назад':'Готово',secondary:true,run:back||(()=>$('#dialog').close())});
 const view=skinView(row),isOwned=row.source==='notgames'&&row.owned;
 const attribute=(label,value,percent)=>'<div class="skin-attribute"><dt>'+esc(label)+'</dt><dd>'+esc(value)+(Number.isFinite(percent)?'<em>'+number(percent)+'%</em>':'')+'</dd></div>';
 modal('SKIN PREVIEW','<section class="skin-detail"><div class="skin-detail-hero" style="background:'+esc(view.background)+'">'+skinArt(row,'detail-art')+'<h2 class="modal-title">'+esc(row.name)+(row.serial?'<small> #'+esc(row.serial)+'</small>':'')+'</h2><p>'+esc(row.collection)+'</p></div><dl class="skin-attributes">'+attribute('Коллекция',row.collection)+attribute('Модель',row.model||row.name,view.rarity.model)+(isOwned?attribute('Символ',row.symbol||'Нет данных',view.rarity.symbol)+attribute('Фон',row.backdrop||'Нет данных',view.rarity.backdrop)+attribute('Номер',row.serial?'#'+row.serial:'Нет данных'):'')+(row.issued||row.supply?attribute('Выпуск',number(row.issued||row.supply)):'')+attribute('Статус',isOwned?'В твоём инвентаре':row.source==='shared_preview'?'Образец сета':row.onSale?'Модель есть в продаже':'Каталог')+'</dl></section>',buttons,back);
}
function openPublic(set){if(!set)return;modal('COMMUNITY LOADOUT','<h2 class="modal-title">'+esc(set.name)+'</h2><p class="modal-subtitle">'+esc(set.author||'Игрок')+(set.sample?' · пример DMX Studio':' · образец сета')+'</p>'+thumbs(set)+notice('Сохранение образца не передаёт скины и не даёт бонусов.'),[{label:state.bookmarks.some(s=>s.id===set.id)?'Убрать из сохранённых':'Сохранить образец',run:async()=>{await bookmark(set);$('#dialog').close();}}]);}
async function bookmark(set){
 if(!set||!validSet(set))return;const saved=state.bookmarks.some(s=>s.id===set.id);
 if(account){
  const input={...set,author:set.author||state.name,items:Object.values(set.slots).map(id=>item(id)).filter(Boolean).map(({id,name,slot,collection,image})=>({id,name,slot,collection,image}))};
  await action(saved?'removeBookmark':'saveBookmark',saved?{id:set.id}:input,saved?'Образец убран из сохранённых.':'Образец сохранён в профиле.');return;
 }
 if(saved){state.bookmarks=state.bookmarks.filter(s=>s.id!==set.id);persist();render();toast('Образец убран из сохранённых.');return;}
 if(state.bookmarks.length>=30){toast('Можно сохранить до 30 образцов.');return;}
 state.bookmarks.push({...set,slots:{...set.slots}});persist();render();toast('Образец сохранён на этом устройстве.');
}
async function equipLinked(id){const set=state.sets.find(s=>s.id===id);if(!ownedSet(set)){toast('Обнови инвентарь: в этом сете есть недоступные предметы.');return;}await action('equipSet',{id},'Активный сет выбран в DMX.');}
function deleteLinked(id){const set=state.sets.find(s=>s.id===id);if(!set)return;modal('УДАЛЕНИЕ СЕТА','<h2 class="modal-title">Удалить '+esc(set.name)+'?</h2><p class="modal-subtitle">Предметы останутся в твоём инвентаре.</p>',[{label:'Удалить',run:async()=>{if(await action('deleteSet',{id},'Сет удалён.'))$('#dialog').close();}},{label:'Отмена',secondary:true,run:()=>editor(set)}]);}
function linkPlayer(suggested=''){
 if(!account){toast(accountLoading?'Профиль ещё загружается.':'Открой DMX через Telegram.');return;}
 clearInterval(lookupTimer);lookupSerial++;
 modal('ПРИВЯЗКА ИГРОВОГО ID','<h2 class="modal-title">Подключить Pixel World</h2><div class="uid-help"><h3>Где найти UID?</h3><ol><li>Открой <a href="https://pw.game/" target="_blank" rel="noopener">Pixel World ↗</a> и перейди в свой профиль.</li><li>Скопируй UID (ID игрока) — длинный код с дефисами.</li><li>Вставь его ниже и нажми «Найти игрока».</li></ol></div><label>UID Pixel World<input id="gamePlayerId" maxlength="36" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Вставь UID из профиля Pixel World" value="'+esc(account.reservedPlayerId||suggested||account.link?.playerId||'')+'"></label><p class="data-time">Твой Telegram ID: '+account.user.id+'</p><div id="playerLookup"></div>',[
 {label:'Найти игрока',run:findPlayer},
 ...(account.link?[{label:'Отключить ID',secondary:true,run:unlinkGame}]:[]),
 {label:'Отмена',secondary:true,run:()=>$('#dialog').close()}
 ]);
 $('#gamePlayerId').focus({preventScroll:true});
}
async function findPlayer(){
 const uuid=$('#gamePlayerId')?.value.trim();
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid||'')){toast('Введи полный ID игрока.');return;}
 const serial=++lookupSerial;clearInterval(lookupTimer);$('#playerLookup').innerHTML='<p class="modal-subtitle">Ищем ID в таблице игры…</p>';
 const button=$('#dialogActions button');button.disabled=true;
 async function search(poll=false){
  try{
   const result=await DMXApi.call('lookupPlayer',{playerId:uuid,poll});
   if(serial!==lookupSerial||!$('#gamePlayerId')||!$('#dialog').open)return;
   if(result.name){
    clearInterval(lookupTimer);
    modal('ИГРОК НАЙДЕН','<div class="lookup-player"><span class="avatar">'+esc(result.name.slice(0,1).toUpperCase())+'</span><div><h2>'+esc(result.name)+'</h2><p>'+esc(result.playerId)+'</p></div></div><p class="modal-subtitle">Связать этот игровой профиль с твоим Telegram ID '+account.user.id+'?</p><div class="summary-grid">'+[['Ник',result.name],['Клан',result.clan?.status==='found'?result.clan.name:'Уточняется']].map(([label,value])=>'<div><span>'+label+'</span><b>'+esc(value)+'</b></div>').join('')+'</div>',[
     {label:'Привязать к Telegram',run:async()=>{if(await action('linkPlayer',{playerId:result.playerId},'Игровой ID привязан к Telegram.'))$('#dialog').close();}},
     {label:'Другой ID',secondary:true,run:()=>linkPlayer(uuid)}
    ]);
   }else if(result.status==='searching'){
    $('#playerLookup').innerHTML='<p class="modal-subtitle">Проверяем таблицы игры. Это может занять некоторое время.</p>';
   }else{
    clearInterval(lookupTimer);button.disabled=false;$('#playerLookup').innerHTML='<p class="modal-subtitle">'+(result.status==='not_listed'?'Этот ID пока не найден в игре. Проверь ID или сыграй матч, затем повтори поиск.':'Не удалось загрузить таблицу игры. Попробуй ещё раз.')+'</p>';
   }
  }catch(error){if(serial===lookupSerial){clearInterval(lookupTimer);button.disabled=false;toast(error.message);}}
 }
 await search();if(serial===lookupSerial&&$('#playerLookup')&&button.disabled){const until=Date.now()+300000;let busy=false;lookupTimer=setInterval(async()=>{if(!$('#dialog').open||!$('#playerLookup')){clearInterval(lookupTimer);return;}if(Date.now()>until){clearInterval(lookupTimer);button.disabled=false;$('#playerLookup').innerHTML='<p class="modal-subtitle">Поиск ещё идёт. Попробуй найти игрока снова через минуту.</p>';return;}if(busy)return;busy=true;try{await search(true);}finally{busy=false;}},2000);}
}
function unlinkGame(){modal('ИГРОВОЙ ID','<h2 class="modal-title">Отключить ID?</h2><p class="modal-subtitle">Сеты и $DMX сохранятся. Этот ID останется закреплён за твоим Telegram-аккаунтом: его можно подключить снова только здесь.</p>',[{label:'Отключить',run:async()=>{if(await action('unlinkGame',{},'Игровой ID отключён.'))$('#dialog').close();}},{label:'Отмена',secondary:true,run:()=>$('#dialog').close()}]);}

function encode(set){const text=JSON.stringify({name:set.name,slots:set.slots,author:state.name,items:Object.values(set.slots).map(id=>item(id)).filter(Boolean).map(({id,name,collection,slot,image})=>({id,name,collection,slot,image}))});return btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function importPreviewItems(set){
 if(!set||typeof set!=='object')return;
 if(!Array.isArray(set.items)||set.items.length>32)return;
 for(const value of set.items){
  if(!value||typeof value.id!=='string'||value.id.length>100||typeof value.name!=='string'||value.name.length>128||typeof value.collection!=='string'||value.collection.length>64||typeof value.slot!=='string'||value.slot.length>64)continue;
  let image='';if(typeof value.image==='string'&&value.image.length<2048){if(/^assets\/[a-f0-9]+\.png$/.test(value.image))image=value.image;else try{const url=new URL(value.image);if(url.protocol==='https:')image=url.href;}catch{}}
  if(!item(value.id)){catalog.push({...value,slot:slotOf(value),image,owned:false,source:'shared_preview'});}
 }
}
function importHash(){if(!location.hash.startsWith('#set='))return;try{let b=location.hash.slice(5);if(b.length>16000)throw Error();const raw=atob(b.replace(/-/g,'+').replace(/_/g,'/'));const decoded=normalizeSet(JSON.parse(new TextDecoder().decode(Uint8Array.from(raw,c=>c.charCodeAt(0)))));importPreviewItems(decoded);if(!validSet(decoded))throw Error();let hash=2166136261;for(const char of b)hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;const set={...decoded,id:'shared-'+hash.toString(16),author:typeof decoded.author==='string'?decoded.author.slice(0,24):'Игрок'};page='sets';filter='saved';render();openPublic(set);}catch{toast('Ссылка на сет повреждена или несовместима.');}}
function share(set){if(!set)return;set.published=true;persist();render();const url=new URL(location.href);url.hash='set='+encode(set);modal('ПОДЕЛИТЬСЯ СЕТОМ','<h2 class="modal-title">'+esc(set.name)+'</h2><p class="modal-subtitle">По этой ссылке можно посмотреть сет и сохранить его как образец. Она не подтверждает владение скинами.</p><label>Ссылка<input id="shareLink" readonly value="'+esc(url.href)+'"></label>',[{label:'Скопировать ссылку',run:async()=>{try{await navigator.clipboard.writeText(url.href);toast('Ссылка скопирована.');}catch{$('#shareLink').select();toast('Выделил ссылку — скопируй её вручную.');}}},{label:'Снять публикацию',secondary:true,run:()=>{set.published=false;persist();render();$('#dialog').close();toast('Убрано из локальной ленты. Уже отправленные ссылки остаются образцами.');}}]);}
function settings(){
 const prefs=account?.settings||{language:window.DMXI18n?.language||'en',privateProfile:false};
 modal('НАСТРОЙКИ','<div class="settings-panel"><h2 class="modal-title">Настройки профиля</h2><label>UID Pixel World<div class="settings-uid"><input id="settingsPlayerId" value="'+esc(account?.link?.playerId||account?.reservedPlayerId||'')+'" placeholder="Не указан" readonly><button class="secondary" data-settings-uid '+(!account?'disabled':'')+'>'+(account?.link?'Открыть UID':'Добавить UID')+'</button></div></label><label>Язык<select id="profileLanguage"><option value="ru" '+(prefs.language==='ru'?'selected':'')+'>Русский</option><option value="en" '+(prefs.language==='en'?'selected':'')+'>English</option></select></label><label class="settings-privacy"><span><b>Приватный профиль</b><small>Скины, сеты и игровая статистика видны только тебе. Ник и баланс остаются в рейтинге.</small></span><input id="privateProfile" type="checkbox" '+(prefs.privateProfile?'checked':'')+' '+(!account?'disabled':'')+'></label></div>',[
 {label:'Сохранить',run:async()=>{
  const language=$('#profileLanguage').value,privateProfile=$('#privateProfile').checked;
  if(account){
   if(action.busy)return;action.busy=true;const button=$('#dialogActions button');button.disabled=true;
   try{const result=await DMXApi.call('saveSettings',{language,privateProfile});account.settings=result.settings;account.user.name=result.user.name;state.name=result.user.name;window.DMXI18n?.setLanguage(result.settings.language);persist();render();toast('Настройки сохранены.');}
   catch(error){toast(error.message);return;}finally{action.busy=false;button.disabled=false;}
  }
  else{window.DMXI18n?.setLanguage(language);persist();render();}
  $('#dialog').close();
 }},{label:'Отмена',secondary:true,run:()=>$('#dialog').close()}]);
}

document.addEventListener('click',event=>{
 const subscribe=event.target.closest('[data-subscribe]');if(subscribe&&telegram?.openTelegramLink){event.preventDefault();telegram.openTelegramLink('https://t.me/DMX_Core');return;}
 const b=event.target.closest('button');if(!b||b.disabled)return;const d=b.dataset;
 if(d.playMap){playMap(d.playMap);return;}
 if('dismissNickname'in d){if(action.busy||!account)return;action.busy=true;b.disabled=true;DMXApi.call('setQuestDismissed',{id:'nickname_dmx',dismissed:d.dismissNickname==='true'}).then(result=>{account.dismissedQuests=result.dismissedQuests;render();}).catch(error=>toast(error.message)).finally(()=>{action.busy=false;if(b.isConnected)b.disabled=false;});return;}
 if('checkSubscription'in d){if(action.busy)return;action.busy=true;b.disabled=true;DMXApi.call('checkSubscription').then(result=>{account.dmx=result.dmx;account.questBoard=result.questBoard;render();toast('Подписка подтверждена. Награда — 100 DMX.');}).catch(error=>toast(error.message)).finally(()=>{action.busy=false;if(b.isConnected)b.disabled=false;});return;}
 if(d.homeInspect){const set=state.sets.find(s=>s.id===state.active);if(ownedSet(set))detail(set.slots[d.homeInspect],{homeSlot:d.homeInspect});}else if(d.homeSlot)chooseHomeSkin(d.homeSlot);else if(d.equipItem)action('equipSlot',{slot:d.targetSlot,itemId:d.equipItem},'Скин надет.').then(ok=>{if(ok)$('#dialog').close();});else if(d.profileTab){profileTab=d.profileTab;render();}else if(d.member)openMember(d.member);
 else if(d.go)go(d.go);else if('create'in d)editor();else if(d.edit)editor(state.sets.find(s=>s.id===d.edit));else if(d.equip)equipLinked(d.equip);
 else if(d.share)share(state.sets.find(s=>s.id===d.share));else if(d.item)detail(d.item);else if(d.slot)picker(d.slot);else if(d.inspectSlot){stashName();detail(draft.slots[d.inspectSlot],{back:editorRender,slot:d.inspectSlot});}else if(d.previewChoice)detail(d.previewChoice,{back:()=>catalogBrowsing?browseSkinCatalog(pickerSlot,false):picker(pickerSlot,false),slot:catalogBrowsing?null:pickerSlot});else if('browseSkins'in d)browseSkinCatalog();else if(d.catalogSlot)browseSkinCatalog(d.catalogSlot);else if(d.pickerMode){pickerMode=d.pickerMode;picker(pickerSlot,false);}
 else if(d.pick){const row=item(d.pick);if(!row||reservedSkin(row.id,draft.id))return;draft.slots[row.slot]=row.id;editorRender();}else if(d.clear){stashName();delete draft.slots[d.clear];editorRender();}
 else if(d.filter){filter=d.filter;render();}else if(d.openPublic)openPublic(allPublic().find(s=>s.id===d.openPublic));else if(d.bookmark)bookmark(allPublic().find(s=>s.id===d.bookmark));
 else if('settingsUid'in d)linkPlayer(account?.link?.playerId||account?.reservedPlayerId||'');else if('economy'in d)showEconomy();else if('settings'in d)settings();else if(d.delete)deleteLinked(d.delete);else if('linkPlayer'in d)linkPlayer();else if('unlinkGame'in d)unlinkGame();
 else if('retryProfile'in d){b.disabled=true;connectProfile('refreshInventory'in d);}
 else if('refreshInventory'in d){b.disabled=true;connectProfile(true).then(()=>{if(account?.inventoryStatus==='connected')toast('Инвентарь обновлён.');});}
 else if('checkNickname'in d)action('syncGame',{refresh:true},'Ник проверен.');else if('syncGame'in d)action('syncGame',{refresh:true},'Статистика обновлена из игры.');else if(d.claim)action('syncGame',{refresh:true},'Вклад проверен. Награды начисляются автоматически.');
 else if(d.topGroup&&d.topGroup!==topGroup){topGroup=d.topGroup;ranking=[];topUpdated=null;loadTop();}else if(d.homeMap){battleMapId=d.homeMap;render();const m=warMaps().find(m=>m.map_id===d.homeMap);if(m?.lastBattle?.teams)battleResults(d.homeMap);else if(m){modal('КЛАНОВАЯ БИТВА','<h2 class="modal-title">'+esc(mapName(m.map_id))+'</h2><div class="war-photo">'+mapPhoto(m.map_id)+'</div><p class="modal-subtitle">'+phaseLabel(m)+' · '+battleTime(m.nextBattleStartsAt||m.startsAt)+'</p>',[{label:'Готово',secondary:true,run:()=>$('#dialog').close()}]);}}else if(d.battleMap)battleResults(d.battleMap);else if('mapProgress'in d)showMapProgress();
 else if(d.clan){openClan(d.clan);}else if('memberBack'in d){go(memberBack);}else if(d.selectMap){battleMapId=d.selectMap;render();}else if('clanIsland'in d)clanIsland();else if('refreshBattles'in d)refreshBattles();
});
document.addEventListener('input',event=>{if(event.target.id==='skinSearch'){pickerSearch=event.target.value;renderChoices();}});

document.addEventListener('error',event=>{if(event.target.matches?.('.profile-photo img,.clan-avatar img'))event.target.hidden=true;},true);
document.addEventListener('click',event=>{if(event.target.closest('[data-reload-app]'))location.reload();});
$('#closeDialog').onclick=close;$('#dialog').addEventListener('cancel',event=>{if(dialogBack){event.preventDefault();close();}});$('#profileShortcut').onclick=()=>go('profile');
$('#dialog').addEventListener('close',()=>{syncTelegramBack();clearInterval(lookupTimer);lookupSerial++;});
window.addEventListener('hashchange',()=>{if(catalog.length)importHash();});
render();
Promise.all(['catalog.json','slot-rules.json','catalog-info.json','skin-presentation.json'].map(file=>fetch(file,{signal:AbortSignal.timeout(30000)}).then(r=>{if(!r.ok)throw Error();return r.json();}))).then(([rows,rules,info,presentation])=>{slotRules=rules;catalogInfo=info;skinPresentation=presentation;publicModels=rows.map(row=>({...row}));catalog=rows;catalogReady=true;for(const sample of examples)sample.slots=normalizeSet(sample).slots;load();render();connectProfile().then(()=>{refreshBattles();importHash();const hint=telegram?.initDataUnsafe?.start_param?.replace(/^player_/,'')||new URLSearchParams(location.hash.slice(1)).get('player');if(hint&&account){go('profile');linkPlayer(hint);}});}).catch(()=>{$('#main').innerHTML='<div class="empty-state"><h3>Не удалось загрузить скины</h3><p>Проверь соединение и попробуй ещё раз.</p><button class="secondary" data-reload-app>Повторить загрузку ↻</button></div>';});

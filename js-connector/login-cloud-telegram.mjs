// Local-only device login. No messages, passwords or session keys are logged.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import QRCode from 'qrcode';
import {TelegramClient} from 'teleproto';
import {StringSession} from 'teleproto/sessions';
import {Logger,LogLevel} from 'teleproto/extensions/Logger';
import {loadOperatorSession} from './operator-session.mjs';
import {saveCloudSession} from './cloud-session-vault.mjs';
import {signInWithQr,loginErrorCode} from './src/qr-login.js';
const port=8095,host='127.0.0.1:'+port,origin='http://'+host;
const urlFile=new URL('../artifacts/cloud-telegram-login-url.txt',import.meta.url);
let prefix='/'+crypto.randomBytes(24).toString('hex');
if(process.argv.includes('--resume')&&fs.existsSync(urlFile)){
 const previous=new URL(fs.readFileSync(urlFile,'utf8').trim());
 if(previous.origin!==origin||!/^\/[a-f0-9]{48}$/.test(previous.pathname))throw Error('Invalid local login address');
 prefix=previous.pathname;
}
const nonce=crypto.randomBytes(24).toString('base64');
const state={phase:'starting',qr:null,hint:'',error:''};let resolvePassword,started=false,client,controller;
const page=`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DMX Arena · подключение игры</title>
<style nonce="${nonce}">body{background:#130e17;color:#fff0f3;font:16px system-ui;max-width:560px;margin:40px auto;padding:20px}h1{font-size:26px}p{line-height:1.5;color:#d5c4cf}img{width:260px;background:white;padding:12px;border-radius:10px}input,button{padding:14px;font-size:16px;width:100%;box-sizing:border-box;margin:8px 0}input{background:#241b2b;color:white;border:1px solid #795568}button{background:#b83050;color:white;border:0}small{display:block;color:#bba9b5;line-height:1.5}.hidden{display:none}</style>
<h1>Подключение игры для DMX Arena</h1><p>Нужен отдельный вход Telegram для облачной проверки скинов и очков. Лучше использовать служебный аккаунт, с которого вы уже открывали NotGames и Pixel World.</p>
<p>В Telegram на телефоне откройте <b>Настройки → Устройства → Подключить устройство</b> и отсканируйте код.</p><p id="status">Подготавливаю QR-код…</p><img id="qr" alt="QR-код входа в Telegram" hidden>
<form id="password" class="hidden"><label>Облачный пароль Telegram</label><p id="hint"></p><input id="secret" type="password" autocomplete="current-password" required><button>Продолжить</button></form>
<button id="retry" class="hidden">Получить новый QR-код</button>
<small>Это полноценная сессия Telegram, как вход нового устройства. Приложение использует её для входа в игровые сервисы. Сессию можно отозвать в разделе «Устройства». Пароль не сохраняется; ключ новой сессии хранится зашифрованно локально и затем в секретах вашего Cloudflare. Резервная Python-версия использует отдельную сессию.</small>
<script nonce="${nonce}">const base=location.pathname;let done=false;async function poll(){if(done)return;try{const s=await(await fetch(base+'/state')).json();document.getElementById('status').textContent=s.phase==='done'?'Подключение готово. Можно вернуться в чат.':s.error||(s.phase==='starting'?'Подготавливаю QR-код…':s.phase==='password'?'Введите облачный пароль Telegram в поле ниже.':'Ожидаю подтверждение в Telegram…');const image=document.getElementById('qr');image.hidden=!s.qr||s.phase!=='qr';if(s.qr)image.src=s.qr;document.getElementById('password').classList.toggle('hidden',s.phase!=='password');document.getElementById('retry').classList.toggle('hidden',s.phase!=='failed');document.getElementById('hint').textContent=s.hint?'Подсказка: '+s.hint:'';done=s.phase==='done';}catch{document.getElementById('status').textContent='Нет связи с локальным окном подключения. Вернитесь в чат.';}if(!done)setTimeout(poll,1500)}document.getElementById('retry').onclick=async()=>{await fetch(base+'/retry',{method:'POST'});};document.getElementById('password').onsubmit=async e=>{e.preventDefault();const input=document.getElementById('secret'),password=input.value;input.value='';await fetch(base+'/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});};poll();</script></html>`;
function reply(res,status,value,type='application/json; charset=utf-8'){
 res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff',
 'Content-Security-Policy':`default-src 'none'; img-src data:; connect-src 'self'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`});res.end(typeof value==='string'?value:JSON.stringify(value));
}
async function begin(){
 if(started||state.phase==='done')return;started=true;controller=new AbortController();Object.assign(state,{phase:'starting',qr:null,hint:'',error:''});
 let stage='configuration';
 try{
 const {apiId,apiHash}=loadOperatorSession();
 client=new TelegramClient(new StringSession(),apiId,apiHash,{baseLogger:new Logger(LogLevel.NONE),connectionRetries:2,requestRetries:4,autoReconnect:false,floodSleepThreshold:0,timeout:15,deviceModel:'DMX Arena cloud',appVersion:'1.0'});
  stage='connection';
  await client.connect();
  stage='confirmation';
  await signInWithQr(client,{apiId,apiHash},{signal:controller.signal,
   qrCode:async({token})=>{state.qr=await QRCode.toDataURL('tg://login?token='+Buffer.from(token).toString('base64url'),{width:320,margin:2});state.phase='qr';state.error='';},
   password:async hint=>{state.phase='password';state.qr=null;state.hint=String(hint||'');return new Promise(resolve=>{resolvePassword=resolve;});},
   passwordError:async()=>{state.error='Неверный облачный пароль. Попробуйте ещё раз в этом окне.';}
  });
  stage='saving';
  saveCloudSession(client.session.save());state.phase='done';state.qr=null;state.hint='';state.error='';console.log('Independent Telegram cloud session saved encrypted. No credentials printed.');
 }catch(error){
  state.phase='failed';state.qr=null;state.hint='';
  const code=loginErrorCode(error);
  state.error='Вход прервался. Нажмите «Получить новый QR-код». Код: '+code;
  console.log(JSON.stringify({event:'device-login-failed',stage,code}));
 }finally{resolvePassword=null;await client?.destroy();started=false;}
}
const server=http.createServer(async(req,res)=>{
 if(req.headers.host!==host)return reply(res,403,{error:'Forbidden'});
 const path=new URL(req.url,origin).pathname;
 if(req.method==='GET'&&path===prefix){reply(res,200,page,'text/html; charset=utf-8');begin().catch(()=>{state.phase='failed';});return;}
 if(req.method==='GET'&&path===prefix+'/state')return reply(res,200,state);
 if(req.method==='POST'&&path===prefix+'/retry'){
  if(req.headers.origin!==origin)return reply(res,403,{error:'Forbidden'});
  if(state.phase!=='failed'||started)return reply(res,409,{error:'Login already active'});
  reply(res,200,{ok:true});begin();return;
 }
 if(req.method==='POST'&&path===prefix+'/password'){
  if(req.headers.origin!==origin)return reply(res,403,{error:'Forbidden'});
  let body='',size=0;for await(const part of req){size+=part.length;if(size>4096)return reply(res,413,{error:'Too large'});body+=part;}
  try{const {password}=JSON.parse(body);if(state.phase!=='password'||!resolvePassword||typeof password!=='string'||!password||password.length>1024)return reply(res,400,{error:'Invalid input'});
   const resolve=resolvePassword;resolvePassword=null;state.phase='checking';resolve(password);return reply(res,200,{ok:true});
  }catch{return reply(res,400,{error:'Invalid input'});}
 }
 return reply(res,404,{error:'Not found'});
});
server.listen(port,'127.0.0.1',()=>{
 const url=origin+prefix;fs.writeFileSync(new URL('../artifacts/cloud-telegram-login-url.txt',import.meta.url),url,{mode:0o600});console.log('Local Telegram device login: '+url);
});
setTimeout(()=>{controller?.abort();resolvePassword?.('');server.close();client?.destroy();},60*60*1000).unref();

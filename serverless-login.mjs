import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
function cli(args,input){
 return new Promise((resolve,reject)=>{
  const env={...process.env,TGCLOUD_ASSUME_TTY:'1',NO_COLOR:'1'};delete env.TGCLOUD_TOKEN;delete env.TGCLOUD_DEBUG;delete env.TG_CLOUD_API_URL;delete env.TGCLOUD_BETA;
  const child=spawn(process.execPath,[path.join(root,'node_modules/@tgcloud/cli/bin/tgcloud.js'),...args],{cwd:root,env,windowsHide:true,stdio:['pipe','pipe','pipe']});
  let output='',bytes=0;const timeout=setTimeout(()=>child.kill(),60000);
  child.stdout.on('data',value=>{bytes+=value.length;if(bytes>65536)child.kill();else output+=value;});
  child.stderr.on('data',()=>{});child.stdin.on('error',()=>{});
  child.on('error',()=>{clearTimeout(timeout);reject(Error('Не удалось запустить вход.'));});
  child.on('close',code=>{clearTimeout(timeout);code===0?resolve(output):reject(Error('Telegram не подтвердил вход. Проверь токен CLI Access нового бота и повтори.'));});
  child.stdin.end(input?input+'\n':undefined);
 });
}
async function officialLogin(token){
 await cli(['login'],token);
 await cli(['run','endpoints/launchIdentity','{}']);
 fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});
 fs.writeFileSync(path.join(root,'artifacts/telegram-login-status.json'),JSON.stringify({username:'DMXARENABOT',verifiedAt:Date.now()}));
}
const page=nonce=>`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DMX Arena — подключение Telegram</title><style>
*{box-sizing:border-box}body{margin:0;background:#100d11;color:#f8edf1;font:16px/1.6 system-ui,sans-serif;padding:28px 18px}main{max-width:540px;margin:5vh auto;background:#241923;border:1px solid #814254;padding:28px}h1{margin:0 0 16px;font-size:28px}p{color:#d4bdc9}label{display:block;margin:22px 0 8px}input,button{width:100%;padding:14px;font:inherit;border:1px solid #8d526a}input{background:#140f17;color:#fff}button{background:#b62d4b;color:#fff;margin-top:16px;font-weight:700;cursor:pointer}button:disabled{opacity:.6;cursor:wait}small{display:block;margin-top:18px;color:#b9a2af}#status{white-space:pre-line}a{color:#ffb4c5}
</style><main><h1>Подключить DMX Arena</h1><p>В <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer">BotFather</a> выбери <b>@DMXARENABOT → Serverless → CLI Access → Access token</b>.</p><p>Нужен токен вида <b>app…:…</b>. Обычный токен бота сюда не подходит.</p><form id="login" autocomplete="off"><label for="token">Токен CLI Access</label><input id="token" name="token" type="password" autocomplete="off" spellcheck="false" required placeholder="app…:…"><button id="submit">Подключить бота</button></form><p id="status" role="status"></p><small>Токен получает локальный инструмент входа и сохраняет официальный Telegram CLI на этом компьютере. В чат токен не отправляется. Эта форма не публикует приложение и не обнуляет очки.</small></main><script nonce="${nonce}">
const form=document.querySelector('#login'),field=document.querySelector('#token'),button=document.querySelector('#submit'),status=document.querySelector('#status');
form.addEventListener('submit',async event=>{event.preventDefault();button.disabled=true;status.textContent='Подключаемся к Telegram и проверяем нового бота…';const token=field.value;field.value='';try{const response=await fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})}),result=await response.json();status.textContent=result.message;if(response.ok){form.hidden=true;return;}}catch{status.textContent='Не удалось завершить вход. Повтори попытку.';}button.disabled=false;});
</script></html>`;

export function loginServer({login=officialLogin}={}){
 const capability=randomBytes(24).toString('hex'),route='/'+capability,nonce=randomBytes(18).toString('base64');let busy=false,connected=false;
 return http.createServer(async(req,res)=>{
  const origin='http://127.0.0.1:'+res.socket.localPort;
  const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY',"Content-Security-Policy":"default-src 'none'; script-src 'nonce-"+nonce+"'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
  const json=(code,message)=>{res.writeHead(code,{...headers,'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({message}));};
  if(req.headers.host!==new URL(origin).host||req.url!==route)return json(404,'Страница недоступна.');
  if(req.method==='GET'){res.writeHead(200,{...headers,'Content-Type':'text/html; charset=utf-8'});return res.end(page(nonce));}
  if(req.method!=='POST')return json(405,'Метод недоступен.');
  if(req.headers.origin!==origin||req.headers['content-type']!=='application/json')return json(403,'Открой локальную форму входа.');
  if(busy)return json(409,'Вход уже выполняется.');
  if(connected)return json(200,'@DMXARENABOT подключён. Можно вернуться в чат.');
  busy=true;
  let body='';
  try{
   for await(const part of req){body+=part;if(Buffer.byteLength(body)>4096)return json(413,'Некорректный токен.');}
   let token=JSON.parse(body).token?.trim();body='';
   if(typeof token!=='string'||!/^app\d+:[A-Za-z0-9_-]+$/.test(token))return json(400,'Нужен токен app…:… из Serverless → CLI Access.');
   await login(token);token='';connected=true;
   json(200,'@DMXARENABOT подключён и проверен. Вернись в чат — продолжим перенос.');
  }catch{json(400,'Не удалось подтвердить @DMXARENABOT. Проверь токен CLI Access нового бота и повтори.');}
  finally{busy=false;}
 }).on('listening',function(){this.loginUrl='http://127.0.0.1:'+this.address().port+route;});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const server=loginServer();server.listen(8093,'127.0.0.1',()=>{
  fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});fs.writeFileSync(path.join(root,'artifacts/telegram-login-url.txt'),server.loginUrl);
  console.log('Local DMX Arena login is ready on port 8093.');
 });
}

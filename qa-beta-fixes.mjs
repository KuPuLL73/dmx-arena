import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const dist=path.resolve('dist'),types={'.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ttf':'font/ttf','.html':'text/html'};
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname,file=path.resolve(dist,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(dist+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file));});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
fs.mkdirSync('artifacts',{recursive:true});fs.mkdirSync('docs/screenshots',{recursive:true});
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||undefined,headless:true}),origin='http://127.0.0.1:'+server.address().port;
try{
 for(const [telegramLanguage,expected,manual] of [['ru','ru'],['en','en'],['de','en'],[undefined,'en'],['en','ru','ru']]){
  let preference=manual,dismissed=[];const errors=[];
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'en-US'});
  await context.route('https://telegram.org/js/telegram-web-app.js',route=>route.fulfill({body:''}));
  await context.addInitScript(code=>{window.Telegram={WebApp:{initData:'synthetic-only',initDataUnsafe:{user:{language_code:code}},ready(){},expand(){},isVersionAtLeast(){return true;},setHeaderColor(){},setBackgroundColor(){},setBottomBarColor(){},onEvent(){},BackButton:{show(){},hide(){},onClick(){}}}};},telegramLanguage);
  await context.route('**/api/*',route=>{
   const name=new URL(route.request().url()).pathname.split('/').pop(),input=route.request().postDataJSON()||{};
   const language=preference||(/^ru(?:[-_]|$)/i.test(telegramLanguage||'')?'ru':'en');let result;
   if(name==='setQuestDismissed'){dismissed=input.dismissed?['nickname_dmx']:[];result={dismissedQuests:dismissed};}
   else if(name==='saveSettings'){preference=input.language;result={settings:{language:preference,privateProfile:input.privateProfile},user:{name:'Игрок'}};}
   else if(name==='getClanMaps')result={maps:[]};
   else if(name==='getClanMembers')result={clan:{id:5,name:'OLD_LEGION',members:2,score:150},players:[{rank:1,name:'First',score:100},{rank:2,name:'Second',score:50}]};
   else result={user:{id:777,name:'Игрок',profileId:'public'},settings:{language,privateProfile:false},link:null,inventory:[],inventoryStatus:'connected',sets:[],active:null,dismissedQuests:dismissed,dmx:{balance:0},gameStats:{status:'id_required'},questBoard:{stages:[{target:1000},{target:2000},{target:3000}],claimsEnabled:true,subscription:{claimed:false},missions:{enabled:true,rows:[{id:'nickname_dmx',title:'Добавить DMX в ник в игре',claimed:false,progress:0,target:1}]}}};
   return route.fulfill({json:result});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin,{waitUntil:'networkidle'});await page.waitForFunction(()=>account?.inventoryStatus==='connected');
  assert.equal(await page.evaluate(()=>DMXI18n.language),expected);
  await page.locator('#mobileNav [data-go="profile"]').click();assert.ok(!(await page.locator('.market-profile-banner').textContent()).includes('Участник DMX'));
  if(expected==='en'&&!manual)await page.screenshot({path:'docs/screenshots/profile.png'});
  await page.locator('#mobileNav [data-go="quests"]').click();await page.locator('[data-dismiss-nickname="true"]').click();
  await page.locator('.deferred-quests .nickname-quest').waitFor();assert.deepEqual(dismissed,['nickname_dmx']);
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>account?.dismissedQuests?.includes('nickname_dmx'));
  await page.locator('#mobileNav [data-go="quests"]').click();assert.equal(await page.locator('.deferred-quests .nickname-quest').count(),1);
  await page.locator('[data-dismiss-nickname="false"]').click();await page.waitForFunction(()=>!document.querySelector('.deferred-quests'));assert.deepEqual(dismissed,[]);
  if(expected==='en'&&!manual){await page.evaluate(()=>{for(const node of document.querySelectorAll('*'))if(node.scrollTop)node.scrollTop=0;window.scrollTo(0,0);});await page.screenshot({path:'docs/screenshots/quests.png'});}
  await page.evaluate(()=>openClan(5));await page.locator('.clan-profile-score').waitFor();
  assert.ok((await page.locator('.clan-profile-score strong').textContent()).includes('150'));assert.equal(await page.locator('.clan-page .data-time').count(),0);
  if(expected==='en')await page.waitForFunction(()=>document.querySelector('.clan-profile-score').textContent.includes('Total DMX'));
  if(expected==='en'&&!manual)await page.screenshot({path:'docs/screenshots/clan.png'});
  await page.screenshot({path:'artifacts/beta-fixes-'+String(telegramLanguage||'default')+(manual?'-manual':'')+'.png'});
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('Beta UI: unlinked profile, clan total/footer, persistent decline/restore, Telegram language detection, English default and manual priority PASS.');
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}

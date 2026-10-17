import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {handleStart,arenaButton,WELCOME_TEXT,RETURN_TEXT,WELCOME_TEXT_RU,RETURN_TEXT_RU,APP_LINK,APP_URL,CLAIM_SQL,COMPLETE_SQL,RELEASE_SQL} from './tgcloud/lib/welcome.js';

// Exercise the production SQL in SQLite, including concurrent claims and retries.
const python=String.raw`
import sqlite3,json,sys
q=json.load(sys.stdin)
d=sqlite3.connect(':memory:')
d.execute('CREATE TABLE dmx_bot_visits(user_id INTEGER PRIMARY KEY,last_message_id INTEGER NOT NULL,last_attempt_at INTEGER NOT NULL,welcomed_at INTEGER)')
def claim(uid,msg,now):
 return d.execute(q['claim'],dict(uid=uid,message=msg,now=now,expired=now-60000)).fetchone()
def complete(uid,msg,attempt):
 d.execute(q['complete'],dict(uid=uid,message=msg,attempt=attempt,now=attempt+1))
assert claim(42,1,100000)==(None,)
assert claim(42,1,100001) is None
assert claim(42,2,100001) is None
complete(42,1,100000)
assert claim(42,1,100002) is None
assert claim(42,2,100003)==(100001,)
d.execute(q['release'],dict(uid=42,message=2,attempt=100003,retry=1))
assert claim(42,2,100004)==(100001,)
complete(42,2,100004)
assert claim(42,1,100005) is None
assert claim(99,1,200000)==(None,)
d.execute(q['release'],dict(uid=99,message=1,attempt=200000,retry=0))
assert claim(99,1,200001)==(None,)
assert claim(99,1,260002)==(None,)
# An expired worker cannot complete or release a newer worker's attempt.
complete(99,1,200001)
assert d.execute('SELECT welcomed_at FROM dmx_bot_visits WHERE user_id=99').fetchone()==(None,)
print('SQLite first-start, duplicate, lease and retry checks passed')
`;
const result=execFileSync(process.env.PYTHON || (process.platform==='win32'?'python':'python3'),['-c',python],{
 input:JSON.stringify({claim:CLAIM_SQL,complete:COMPLETE_SQL,release:RELEASE_SQL}),encoding:'utf8'});
process.stdout.write(result);

const base={chat:{id:42,type:'private'},from:{id:42,language_code:'ru'},message_id:1,text:'/start'};
const sent=[],events=[];
let first=true,duplicate=false,fail=false;
const deps={
 claim:async()=>{events.push('claim');return duplicate?null:{welcomed_at:first?null:100};},
 complete:async()=>{events.push('complete');first=false;},release:async()=>events.push('release'),
 button:async language=>({text:language==='ru'?'Открыть арену':'Open arena',url:APP_LINK}),
 send:async value=>{if(fail)throw new Error('network');sent.push(value);},now:()=>100000
};
assert.deepEqual(await handleStart(base,deps),{handled:true,first:true});
assert.equal(sent[0].text,WELCOME_TEXT_RU);
assert.equal(sent[0].text,'Добро пожаловать в DMX Arena!\n\nОткрой приложение и привяжи UID Pixel World. Выбери свои скины для сета, выполняй задания и зарабатывай DMX в клановых битвах.\n\nНажми «Открыть арену», чтобы начать.');
assert.equal(sent[0].reply_markup.inline_keyboard[0][0].text,'Открыть арену');
assert.equal(sent[0].reply_markup.inline_keyboard[0][0].url,'https://t.me/DMXARENABOT');
await handleStart({...base,message_id:2,text:'/start@DMXARENABOT referral'},deps);
assert.equal(sent[1].text,RETURN_TEXT_RU);
duplicate=true;
assert.equal((await handleStart(base,deps)).duplicate,true);
assert.equal(sent.length,2);
const before=events.length;
for(const message of [
 {...base,text:'/starting'}, {...base,text:'/start@anotherbot'}, {...base,text:'/help'},
 {...base,chat:{id:-42,type:'group'}}, {...base,from:{id:42,is_bot:true}},
 {...base,from:{id:99}}, {...base,message_id:undefined}, {...base,text:undefined}
])assert.equal((await handleStart(message,deps)).handled,false);
assert.equal(events.length,before);
duplicate=false;fail=true;first=true;
await assert.rejects(handleStart(base,deps),/network/);
assert.equal(events.at(-1),'release');
fail=false;
assert.equal((await handleStart(base,deps)).first,true);
const card=readFileSync('LAUNCH-COPY.md','utf8');
assert.ok(card.includes(WELCOME_TEXT_RU));
for(const code of [undefined,'en','de','fr']){
 first=true;await handleStart({...base,from:{id:42,language_code:code}},deps);
 assert.equal(sent.at(-1).text,WELCOME_TEXT);assert.equal(sent.at(-1).reply_markup.inline_keyboard[0][0].text,'Open arena');
 await handleStart({...base,from:{id:42,language_code:code},message_id:3},deps);assert.equal(sent.at(-1).text,RETURN_TEXT);
}
first=true;await handleStart({...base,from:{id:42,language_code:'ru-RU'}},deps);assert.equal(sent.at(-1).text,WELCOME_TEXT_RU);
for(const language of ['ru','en']){
 let configured;
 const button=await arenaButton({getChatMenuButton:async()=>({type:'default'}),setChatMenuButton:async input=>{configured=input;}},42,language);
 assert.deepEqual(button,{text:language==='ru'?'Открыть арену':'Open arena',web_app:{url:APP_URL}});
 assert.equal(configured.chat_id,42);assert.equal(configured.menu_button.text,button.text);
}
assert.equal((await arenaButton({getChatMenuButton:async()=>{throw Error('unavailable');},setChatMenuButton:async()=>{throw Error('unavailable');}},42,'en')).web_app.url,APP_URL);
console.log('Welcome text, repeat entry, private /start and delivery failure checks passed');

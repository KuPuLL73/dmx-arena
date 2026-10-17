// Official Wrangler secret upload through stdin, with no secret CLI arguments.
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import crypto from 'node:crypto';
import {loadOperatorSession,decodeOperatorSession} from './operator-session.mjs';
const values={};
for(const line of fs.readFileSync(new URL('.dev.vars',import.meta.url),'utf8').split(/\r?\n/)){
 const at=line.indexOf('=');if(at<0)continue;
 const name=line.slice(0,at);if(['OPERATOR_SESSION','TELEGRAM_API_ID','TELEGRAM_API_HASH','PROBE_KEY','DEPLOY_KEY'].includes(name))values[name]=JSON.parse(line.slice(at+1));
}
const vault=new URL('../.data/cloud-operator/',import.meta.url);
const session=decodeOperatorSession(fs.readFileSync(new URL('master.key',vault),'utf8'),fs.readFileSync(new URL('session.enc',vault),'utf8'));
if(values.OPERATOR_SESSION&&session!==values.OPERATOR_SESSION)throw Error('Cloud session binding does not match encrypted provisioning');
values.OPERATOR_SESSION=session;
if(Object.keys(values).length!==5)throw Error('Provisioning credentials missing');
const original=loadOperatorSession().session;
if(crypto.timingSafeEqual(Buffer.from(original.slice(1),'base64').subarray(-256),Buffer.from(session.slice(1),'base64').subarray(-256)))throw Error('Cloud authorization must be separate from Python fallback');
const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','secret','bulk'],{cwd:new URL('.',import.meta.url),stdio:['pipe','pipe','pipe'],windowsHide:true});
let output='';child.stdout.on('data',part=>{output+=part;});child.stderr.on('data',()=>{});
child.stdin.end(JSON.stringify(values));
child.once('error',()=>{console.error('Secret provisioning could not start');process.exitCode=1;});
child.once('close',code=>{if(code===0)console.log('Five connector secrets uploaded through Wrangler; no secret values printed.');else{console.error('Secret provisioning failed; no credentials printed.');process.exitCode=1;}output='';});

// Creates an ignored local development secret file, never command-line secrets.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {loadOperatorSession} from './operator-session.mjs';
const file=new URL('.dev.vars',import.meta.url);
const git='git';
if(!execFileSync(git,['check-ignore','js-connector/.dev.vars'],{cwd:new URL('..',import.meta.url),encoding:'utf8'}).trim())throw Error('Secret file must be ignored');
if(fs.existsSync(file))throw Error('Local development credentials already exist; refusing to overwrite.');
const credentials=loadOperatorSession();
const values={OPERATOR_SESSION:credentials.session,TELEGRAM_API_ID:String(credentials.apiId),TELEGRAM_API_HASH:credentials.apiHash,PROBE_KEY:crypto.randomBytes(32).toString('base64url')};
fs.writeFileSync(file,Object.entries(values).map(([name,value])=>name+'='+JSON.stringify(value)).join('\n')+'\n',{flag:'wx',mode:0o600});
console.log('Ignored local development credentials prepared. No secrets printed.');

// Local provisioning only. Never import this file into the Worker or frontend.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
export function decodeOperatorSession(keyString,encrypted){
 const key=Buffer.from(keyString.trim(),'base64url'),token=Buffer.from(encrypted.trim(),'base64url');
 if(key.length!==32||token.length<73||token[0]!==0x80)throw Error('Invalid encrypted operator session');
 const signature=token.subarray(-32),expected=crypto.createHmac('sha256',key.subarray(0,16)).update(token.subarray(0,-32)).digest();
 if(!crypto.timingSafeEqual(signature,expected))throw Error('Operator session integrity check failed');
 const decipher=crypto.createDecipheriv('aes-128-cbc',key.subarray(16),token.subarray(9,25));
 const plain=Buffer.concat([decipher.update(token.subarray(25,-32)),decipher.final()]);
 try{
  const value=JSON.parse(plain.toString('utf8'));
  if(typeof value.string_session!=='string'||!/^1[A-Za-z0-9_+/=-]+$/.test(value.string_session)||value.string_session.length>4096)throw Error('Invalid operator session');
  return value.string_session;
 }finally{plain.fill(0);key.fill(0);}
}
export function loadOperatorSession(directory=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../pixelworld_escrow_bot')){
 const values={};
 for(const line of fs.readFileSync(path.join(directory,'.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){
  const index=line.indexOf('=');if(index<0||line.trim().startsWith('#'))continue;
  values[line.slice(0,index).trim()]=line.slice(index+1).trim().replace(/^['"]|['"]$/g,'');
 }
 const key=values.SESSION_ENCRYPTION_KEY||fs.readFileSync(path.join(directory,values.MASTER_KEY_FILE||'secrets/master.key'),'utf8');
 const encrypted=fs.readFileSync(path.join(directory,values.ENCRYPTED_TELETHON_SESSION_FILE||'secrets/telethon_session.enc'),'utf8');
 return {session:decodeOperatorSession(key,encrypted),apiId:Number(values.TELEGRAM_API_ID||0),apiHash:values.TELEGRAM_API_HASH||''};
}

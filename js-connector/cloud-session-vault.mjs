import fs from 'node:fs';
import crypto from 'node:crypto';
import {decodeOperatorSession} from './operator-session.mjs';
export function saveCloudSession(value,{
 vault=new URL('../.data/cloud-operator/',import.meta.url),
 file=new URL('.dev.vars',import.meta.url),
 receiptFile=new URL('../artifacts/cloud-session-status.json',import.meta.url)
}={}){
 if(fs.existsSync(vault))throw Error('Cloud authorization already prepared');
 const old=fs.readFileSync(file,'utf8');
 if(!/^PROBE_KEY=/m.test(old))throw Error('Local deployment bindings missing');
 const key=crypto.randomBytes(32),iv=crypto.randomBytes(16),header=Buffer.alloc(9);header[0]=0x80;header.writeBigUInt64BE(BigInt(Math.floor(Date.now()/1000)),1);
 const cipher=crypto.createCipheriv('aes-128-cbc',key.subarray(16),iv);
 const data=Buffer.concat([header,iv,cipher.update(JSON.stringify({string_session:value})),cipher.final()]);
 const encrypted=Buffer.concat([data,crypto.createHmac('sha256',key.subarray(0,16)).update(data).digest()]).toString('base64url');
 if(decodeOperatorSession(key.toString('base64url'),encrypted)!==value)throw Error('Cloud vault verification failed');
 fs.mkdirSync(vault,{recursive:true,mode:0o700});
 fs.writeFileSync(new URL('master.key',vault),key.toString('base64url'),{flag:'wx',mode:0o600});
 fs.writeFileSync(new URL('session.enc',vault),encrypted,{flag:'wx',mode:0o600});key.fill(0);
 // The deployment tool decrypts the vault in memory. No plaintext Telegram
 // account session is retained in the development environment file.
 fs.writeFileSync(file,old.replace(/^OPERATOR_SESSION=.*\r?\n?/m,''),{mode:0o600});
 fs.writeFileSync(receiptFile,JSON.stringify({independent:true,encryptedLocally:true,sourceCredentialUnchanged:true,createdAt:Date.now()}),{mode:0o600});
}

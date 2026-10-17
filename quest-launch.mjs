import fs from 'node:fs';
import path from 'node:path';
export const LADDER_VERSION='battle-ladder-v1';
export function validateLaunch(input){
 if(!input||!['preview','pilot','open'].includes(input.mode))throw Error('Выбери режим запуска заданий.');
 const pilotUserIds=input.mode==='pilot'?input.pilotUserIds||[]:[];
 if(!Array.isArray(pilotUserIds)||pilotUserIds.length>100||pilotUserIds.some(id=>!Number.isSafeInteger(id)||id<=0||id>=2**52)||new Set(pilotUserIds).size!==pilotUserIds.length)throw Error('Некорректный список тестовой группы.');
 if(input.mode==='pilot'&&!pilotUserIds.length)throw Error('Укажи участников тестовой группы.');
 return {version:LADDER_VERSION,mode:input.mode,pilotUserIds};
}
export class QuestLaunch{
 constructor(directory){this.file=path.join(directory,'quest-launch.json');}
 read(){try{return validateLaunch(JSON.parse(fs.readFileSync(this.file,'utf8')));}catch(error){if(error.code==='ENOENT')return validateLaunch({mode:'preview'});throw Error('Настройки запуска заданий требуют проверки. Начисления остановлены.');}}
 save(input){const policy=validateLaunch(input);fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file+'.tmp',JSON.stringify(policy),{mode:0o600});fs.renameSync(this.file+'.tmp',this.file);return policy;}
}
export function launchView(policy,userId){const claimsEnabled=policy.mode==='open'||policy.mode==='pilot'&&policy.pilotUserIds.includes(userId);return {version:LADDER_VERSION,mode:policy.mode,claimsEnabled,phase:claimsEnabled?'first_release':'preview'};}

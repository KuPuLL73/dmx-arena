// The legacy manual-claim economy stays disabled. Live ladders and missions use explicit launch policies.
// DMX totals and rankings accumulate over the account's entire history.
export const ECONOMY=Object.freeze({phase:'draft',claimsEnabled:false,rewards:Object.freeze({})});

export function skinReward(base,count=0){
 if(!Number.isSafeInteger(base)||base<0||!Number.isInteger(count)||count<0||count>5)throw Error('Неверная награда или бонус сета.');
 const result=BigInt(base)*BigInt(100+count*10)/100n;
 if(result>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Награда слишком большая.');
 return Number(result); // DMX points are whole numbers; round down once.
}

// Ranked recipients must come from confirmed DMX membership and daily contribution.
// This calculation does not issue awards or enable the draft economy.
export function splitClanFund(fund,rankedTelegramIds){
 if(!Number.isSafeInteger(fund)||fund<0||!Array.isArray(rankedTelegramIds)||rankedTelegramIds.some(id=>!Number.isSafeInteger(id)||id<=0||id>=2**52)||new Set(rankedTelegramIds).size!==rankedTelegramIds.length)throw Error('Invalid clan fund or recipients.');
 const recipients=rankedTelegramIds.slice(0,10);if(!recipients.length)return [];
 const amount=Math.floor(fund/recipients.length),remainder=fund%recipients.length;
 return recipients.map((userId,index)=>({userId,rank:index+1,amount:amount+(index<remainder?1:0)}));
}

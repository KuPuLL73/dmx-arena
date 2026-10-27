// Every deployed copy of DMX Arena: the live bot and the test bot.
// The Telegram side picks its copy by the bot it actually runs in (getMe);
// the Worker picks its copy by the DMX_INSTANCE variable. An unknown bot gets
// no copy at all, so a misconfigured deployment stops instead of reaching live data.
export const INSTANCES=Object.freeze({
 production:Object.freeze({
  name:'production',
  botUsername:'DMXARENABOT',
  botId:8760866719,
  appUrl:'https://app8760866719.tgcloud.ai/',
  workerOrigin:'https://dmx-arena-connector.dmx-arena-js-connector.workers.dev',
  channelId:-1003360145165
 }),
 test:Object.freeze({
  name:'test',
  botUsername:'pwtrade_bot',
  // Unknown until confirmed. While null, the subscription quest cannot be verified on this copy.
  botId:null,
  // Telegram Serverless hosts every bot at app<bot id>.tgcloud.ai.
  appUrl:null,
  // Assumes the test Worker lives on the same Cloudflare account; confirm after its first deploy.
  workerOrigin:'https://dmx-arena-connector-test.dmx-arena-js-connector.workers.dev',
  // The live channel for now; subscription checks on the test copy come later.
  channelId:-1003360145165
 })
});

export function instanceByName(name){
 const value=name===undefined||name===null||name===''?'production':name;
 if(!Object.hasOwn(INSTANCES,value))throw Error('Unknown DMX instance: '+String(value).slice(0,40));
 return INSTANCES[value];
}

// Match by username; a configured bot id must match too.
export function instanceForBot(bot){
 if(!bot||typeof bot.username!=='string'||!Number.isSafeInteger(bot.id)||bot.id<=0)return null;
 const found=Object.values(INSTANCES).find(row=>row.botUsername.toLowerCase()===bot.username.toLowerCase());
 if(!found||(found.botId!==null&&found.botId!==bot.id))return null;
 return found;
}

export function appUrlFor(instance,botId){
 if(instance?.appUrl)return instance.appUrl;
 return Number.isSafeInteger(botId)&&botId>0?'https://app'+botId+'.tgcloud.ai/':null;
}

// getMe is cached for the life of a warm runtime; a failed lookup is retried next time.
let cached=null;
export async function currentBot(api){
 if(!cached)cached=Promise.resolve().then(()=>api.getMe()).then(bot=>({bot,instance:instanceForBot(bot)}),error=>{cached=null;throw error;});
 return cached;
}
export function resetCurrentBot(){cached=null;}

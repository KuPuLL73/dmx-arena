// Runtime-neutral JavaScript. Auth tokens stay in the server-side provider.
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const cloneItems=value=>JSON.parse(JSON.stringify(value));
function object(value){
 if(typeof value==='string')value=JSON.parse(value);
 if(Array.isArray(value))return Object.fromEntries(value.filter(row=>row&&typeof row==='object').map(row=>[String(row.trait_type||row.name||'').toLowerCase(),row.value]));
 return value&&typeof value==='object'?value:{};
}
function gameIndex(value){
 if(value&&typeof value==='object')value=value.v??value.value;
 if(typeof value==='boolean'||!/^\d+$/.test(String(value)))return null;
 const n=Number(value);return integer(n)&&n<=65535?n:null;
}
export function normalizedItem(raw){
 const tags=Object.fromEntries(Object.entries(object(raw.tags||raw.default_tags)).map(([key,value])=>[key.toLowerCase(),value]));
 const trait=key=>{const value=tags[key];return String(value&&typeof value==='object'?(value.value||value.v||value.name||''):(value||''));};
 const rarity=key=>{const value=tags[key];if(!value||typeof value!=='object')return null;
  const rawValue=value.rarity??value.percent;if(rawValue==null||typeof rawValue==='string'&&!rawValue.trim())return null;
  const n=Number(rawValue);return Number.isFinite(n)&&n>=0&&n<=100?n:null;};
 const collection=typeof raw.collection==='object'?raw.collection?.name||'':raw.collection||'',kind=raw.display_type;
 const slot=kind==='Mask'?'Mask':kind==='Weapon'&&typeof collection==='string'&&collection.length>0&&collection.length<=64?collection:null;
 if(!slot)return null;
 const defaults=object(raw.default_tags),definitionId=gameIndex(defaults.id),skinId=gameIndex(tags.model?.id);
 const gameModel=definitionId!==null&&skinId!==null?{kind:kind==='Mask'?'mask':'weapon',definitionId,skinId}:null;
 const sourceImage=String(raw.icon_url||raw.image_url||''),image=sourceImage.startsWith('https://')?sourceImage:'';
 return {id:'nft:'+raw.item_id,gameItemId:String(raw.item_id),name:trait('model')||String(raw.name||collection),collection,gameModel,
  slot,image,serial:String(raw.number||raw.serial||''),model:trait('model'),symbol:trait('symbol')||trait('pattern'),
  backdrop:trait('backdrop')||trait('background'),traitRarity:Object.fromEntries(['model','symbol','backdrop'].map(key=>[key,rarity(key)])),
  supply:integer(raw.supply)&&raw.supply>0?raw.supply:null,issued:integer(raw.issued)&&raw.issued>0?raw.issued:null,
  source:'notgames',owned:true,monochromePercent:null};
}
export class NotGamesClient{
 constructor({fetch,token,clock=Date.now}){this.fetch=fetch;this.token=token;this.clock=clock;this.cache=new Map();}
 async request(path){
  const token=await this.token();if(typeof token!=='string'||!token)throw Error('NotGames authorization required');
  const response=await this.fetch('https://bff.notcoin.tg/api/v1/'+path,{headers:{Accept:'application/json','x-auth-token':'Bearer '+token,
   Origin:'https://webapp.notcoin.tg',Referer:'https://webapp.notcoin.tg/'}});
  if(!response.ok)throw Error('NotGames source unavailable');
  const result=await response.json();return result?.data??result;
 }
 async inventory(userId,{force=false}={}){
  if(!Number.isSafeInteger(userId)||userId<=0||userId>=2**52)throw Error('Invalid Telegram account');
  const cached=this.cache.get(userId);if(cached&&!force&&this.clock()-cached.at<45000)return cloneItems(cached.items);
  const profile=await this.request('profiles/by/telegram_id/'+userId+'?limit=1000&offset=0');
  if(String(profile?.profile?.id)!==String(userId))throw Error('NotGames profile identity mismatch');
  const items=[],seen=new Set();
  for(const kind of ['Weapon','Mask']){
   let offset=0,expected=null;
   while(true){
    const page=await this.request('inventory/items?app_id=16&account_id='+userId+'&display_type='+kind+'&limit=100&offset='+offset);
    if(offset===0&&page&&Object.keys(page).length===1&&page.pagination&&Object.keys(page.pagination).length===0)break;
    if(!Array.isArray(page?.items)||!page.pagination||typeof page.pagination!=='object'||page.items.length>100)throw Error('Incomplete inventory');
    const rawTotal=page.pagination.total;
    if(typeof rawTotal==='boolean'||!/^\d+$/.test(String(rawTotal)))throw Error('Invalid inventory pagination');
    const total=Number(rawTotal);if(!integer(total)||total>100000||expected!==null&&total!==expected)throw Error('Invalid inventory pagination');
    expected=total;
    for(const raw of page.items){
     if(!raw||String(raw.account_id)!==String(userId)||String(raw.app_id)!=='16'||raw.display_type!==kind)throw Error('Inventory owner/type mismatch');
     const itemId=raw.item_id==null?'':String(raw.item_id);
     if(!itemId||seen.has(itemId))throw Error('Duplicate inventory item');
     seen.add(itemId);const item=normalizedItem(raw);if(item)items.push(item);
    }
    offset+=page.items.length;
    if(offset>total||!page.items.length&&offset<total)throw Error('Incomplete inventory pages');
    if(offset===total)break;
    if(page.items.length<100)throw Error('Incomplete inventory page');
   }
  }
  this.cache.set(userId,{at:this.clock(),items:cloneItems(items)});return items;
 }
}

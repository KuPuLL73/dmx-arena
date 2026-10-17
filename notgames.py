"""Read-only NotGames inventory connector. Credentials never reach the frontend."""
import asyncio
import json
import os
from pathlib import Path
import threading
import time
import urllib.parse
import urllib.request
from cryptography.fernet import Fernet
from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.tl.functions.messages import RequestWebViewRequest

SLOTS=['Ak-69',"Chef's Knife",'Loud Bastard','Lil Prick','RPG','Ivory Beam','Eggplant','Mask']

def env_file(path):
    values={}
    for line in path.read_text(encoding='utf-8-sig').splitlines():
        key,sep,value=line.partition('=')
        if sep and not key.strip().startswith('#'):
            values[key.strip()]=value.strip().strip('\"\'')
    return values

def normalized_item(raw):
    tags=raw.get('tags') or raw.get('default_tags') or {}
    if isinstance(tags,str): tags=json.loads(tags)
    if isinstance(tags,list):tags={x.get('trait_type',x.get('name','')).lower():x.get('value') for x in tags if isinstance(x,dict)}
    if not isinstance(tags,dict):tags={}
    tags={str(key).lower():value for key,value in tags.items()}
    def trait(key):
        value=tags.get(key,'')
        return str(value.get('value') or value.get('v') or value.get('name') or '') if isinstance(value,dict) else str(value or '')
    def rarity(key):
        value=tags.get(key)
        if not isinstance(value,dict):return None
        try:percent=float(value.get('rarity',value.get('percent')))
        except (TypeError,ValueError):return None
        return percent if 0<=percent<=100 else None
    collection=raw.get('collection') or ''
    if isinstance(collection,dict):collection=collection.get('name','')
    kind=raw.get('display_type')
    slot='Mask' if kind=='Mask' else collection if kind=='Weapon' and isinstance(collection,str) and 0<len(collection)<=64 else None
    if not slot:return None
    defaults=raw.get('default_tags') or {}
    if isinstance(defaults,str):defaults=json.loads(defaults)
    def game_index(value):
        if isinstance(value,dict):value=value.get('v',value.get('value'))
        if isinstance(value,bool) or not str(value).isdecimal():return None
        parsed=int(value)
        return parsed if 0<=parsed<=65535 else None
    definition_id=game_index(defaults.get('id')) if isinstance(defaults,dict) else None
    skin_id=game_index(tags.get('model',{}).get('id')) if isinstance(tags.get('model'),dict) else None
    game_model={'kind':'mask' if kind=='Mask' else 'weapon','definitionId':definition_id,'skinId':skin_id} if definition_id is not None and skin_id is not None else None
    image=str(raw.get('icon_url') or raw.get('image_url') or '')
    if image and not image.startswith('https://'):image=''
    return {'id':'nft:'+str(raw['item_id']),'gameItemId':str(raw['item_id']),
            'name':trait('model') or str(raw.get('name') or collection),'collection':collection,'gameModel':game_model,
            'slot':slot,'image':image,'serial':str(raw.get('number') or raw.get('serial') or ''),
            'model':trait('model'),'symbol':trait('symbol') or trait('pattern'),
            'backdrop':trait('backdrop') or trait('background'),
            'traitRarity':{key:rarity(key) for key in ('model','symbol','backdrop')},
            'supply':raw.get('supply') if type(raw.get('supply')) is int and raw['supply']>0 else None,
            'issued':raw.get('issued') if type(raw.get('issued')) is int and raw['issued']>0 else None,
            'source':'notgames','owned':True,'monochromePercent':None}

class NotGames:
    def __init__(self):
        self.root=Path(os.getenv('DMX_OPERATOR_ROOT',Path(__file__).resolve().parent.parent/'pixelworld_escrow_bot'))
        self.env=env_file(self.root/'.env');self.token='';self.refreshed=0
        self.lock=threading.RLock();self.cache={}
        self.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def request(self,path,body=None):
        headers={'Content-Type':'application/json','Accept':'application/json','Origin':'https://webapp.notcoin.tg',
                 'Referer':'https://webapp.notcoin.tg/','User-Agent':'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36'}
        if self.token:headers['x-auth-token']='Bearer '+self.token
        request=urllib.request.Request('https://bff.notcoin.tg/api/v1/'+path,
          data=json.dumps(body).encode() if body is not None else None,headers=headers)
        with self.opener.open(request,timeout=25) as response:
            decoded=json.load(response)
            return decoded.get('data',decoded) if isinstance(decoded,dict) else decoded

    async def init_data(self,bot_name='notgames_bot',app_url='https://webapp.notcoin.tg/'):
        key=self.env.get('SESSION_ENCRYPTION_KEY')
        if not key:key=(self.root/(self.env.get('MASTER_KEY_FILE') or 'secrets/master.key')).read_text(encoding='ascii').strip()
        session_path=self.root/(self.env.get('ENCRYPTED_TELETHON_SESSION_FILE') or 'secrets/telethon_session.enc')
        session=json.loads(Fernet(key.encode()).decrypt(session_path.read_bytes()))['string_session']
        client=TelegramClient(StringSession(session),int(self.env.get('TELEGRAM_API_ID') or 0),self.env.get('TELEGRAM_API_HASH') or '')
        await client.connect()
        try:
            if not await client.is_user_authorized():raise RuntimeError('NotGames connection needs operator login')
            bot=await client.get_input_entity(bot_name)
            result=await client(RequestWebViewRequest(peer=bot,bot=bot,url=app_url,platform='android'))
            parsed=urllib.parse.urlsplit(result.url)
            query=urllib.parse.parse_qs(parsed.fragment or parsed.query)
            return query['tgWebAppData'][0]
        finally:await client.disconnect()

    def refresh_token(self):
        if self.token and time.time()-self.refreshed<1500:return
        result=self.request('auth/login',{'webAppData':asyncio.run(self.init_data())})
        self.token=str(result.get('access_token') or result.get('accessToken') or '')
        if not self.token:raise RuntimeError('NotGames authentication failed')
        self.refreshed=time.time()

    def inventory(self,tg_id,force=False):
        if type(tg_id)!=int or not 0<tg_id<2**52:raise ValueError('Invalid Telegram account')
        with self.lock:
            cached=self.cache.get(tg_id)
            if cached and not force and time.time()-cached['time']<45:return cached['items']
            self.refresh_token()
            profile=self.request('profiles/by/telegram_id/'+str(tg_id)+'?limit=1000&offset=0')
            if str(profile.get('profile',{}).get('id'))!=str(tg_id):raise ValueError('NotGames profile identity mismatch')
            items=[];seen=set()
            for kind in ('Weapon','Mask'):
                offset=0;expected=None
                while True:
                    query=urllib.parse.urlencode({'app_id':16,'account_id':tg_id,'display_type':kind,'limit':100,'offset':offset})
                    page=self.request('inventory/items?'+query)
                    if page=={'pagination':{}} and offset==0:break
                    rows=page.get('items');pagination=page.get('pagination')
                    if not isinstance(rows,list) or not isinstance(pagination,dict):raise ValueError('Incomplete inventory')
                    raw_total=pagination.get('total')
                    if isinstance(raw_total,bool) or not str(raw_total).isdecimal():raise ValueError('Invalid inventory pagination')
                    total=int(raw_total)
                    if not 0<=total<=100000 or expected is not None and total!=expected:raise ValueError('Invalid inventory pagination')
                    expected=total
                    for raw in rows:
                        if str(raw.get('account_id'))!=str(tg_id) or str(raw.get('app_id'))!='16' or raw.get('display_type')!=kind:raise ValueError('Inventory owner/type mismatch')
                        item_id=str(raw.get('item_id') or '')
                        if not item_id or item_id in seen:raise ValueError('Duplicate inventory item')
                        seen.add(item_id);normalized=normalized_item(raw)
                        if normalized:items.append(normalized)
                    offset+=len(rows)
                    if offset>total or not rows and offset<total:raise ValueError('Incomplete inventory pages')
                    if offset==total:break
                    if len(rows)<100:raise ValueError('Incomplete inventory page')
            self.cache[tg_id]={'time':time.time(),'items':items}
            return items

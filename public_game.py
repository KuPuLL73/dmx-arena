"""Resolve public game UUIDs from leaderboard rows; never substitute /me data."""
import concurrent.futures
import json
import math
import os
import re
import threading
import time
from pathlib import Path
from pixel_game import PixelGame
from clan_data import ClanData

PERIODS=('day','week','month')
UUID=re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',re.I)

def public_player(raw):
    if not isinstance(raw,dict) or not UUID.fullmatch(str(raw.get('uuid',''))):raise ValueError('Invalid game UUID')
    if type(raw.get('points')) is not int or raw['points']<0 or type(raw.get('place')) is not int or raw['place']<1:raise ValueError('Invalid public score')
    name=raw.get('nickname')
    if not isinstance(name,str) or not name.strip() or len(name)>128:raise ValueError('Missing game nickname')
    return {'playerId':raw['uuid'].lower(),'name':name,'rank':raw['place'],'score':raw['points'],
            'avatar':raw.get('image_url') if str(raw.get('image_url','')).startswith('https://') else ''}

class PublicGame:
    def __init__(self,api=None,directory=None):
        self.api=api or PixelGame();self.lock=threading.RLock();self.auth_lock=threading.Lock()
        self.searches=concurrent.futures.ThreadPoolExecutor(max_workers=3)
        self.pages=concurrent.futures.ThreadPoolExecutor(max_workers=4)
        self.jobs={};self.results={};self.maps=None;self.map_time=0
        self.file=Path(directory or os.environ.get('DMX_DATA_DIR') or Path(__file__).resolve().parent/'.data')/'public-player-cache.json'
        self.clans=ClanData(self.api,self.file.parent,self.login)
        if self.file.exists():
            saved=json.loads(self.file.read_text(encoding='utf-8'))
            if not isinstance(saved,dict):raise ValueError('Invalid public player cache')
            self.results=saved

    def login(self):
        with self.auth_lock:self.api.login()

    def save(self):
        self.file.parent.mkdir(parents=True,exist_ok=True)
        temporary=self.file.with_suffix('.tmp');temporary.write_text(json.dumps(self.results),encoding='utf-8');temporary.replace(self.file)

    def page(self,period,page):
        data=self.api.request(f'stat/leaderboard/players?range={period}&limit=50&page={page}')
        board=data.get('leaderboard',{});listing=board.get('list',{})
        if board.get('range')!=period or listing.get('page')!=page or type(listing.get('total')) is not int or not 0<=listing['total']<=100000:raise ValueError('Leaderboard period or pagination mismatch')
        rows=listing.get('players')
        if not isinstance(rows,list) or len(rows)>50:raise ValueError('Invalid leaderboard rows')
        return listing['total'],[public_player(row) for row in rows]

    def search(self,uuid,period,prior):
        key=period+':'+uuid;seen=set()
        try:
            self.login()
            preferred=[prior.get('page',1)] if prior else [1]
            with self.lock:
                for other in PERIODS:
                    cached=self.results.get(other+':'+uuid)
                    if cached and cached.get('player'):preferred.append(cached['page'])
            total=0
            for page in dict.fromkeys(preferred):
                total,rows=self.page(period,page);seen.add(page)
                for row in rows:
                    if row['playerId']==uuid:return self.found(key,period,page,row)
            maximum=max(1,math.ceil(total/50))
            for start in range(1,maximum+1,8):
                batch={self.pages.submit(self.page,period,p):p for p in range(start,min(start+8,maximum+1)) if p not in seen}
                for future in concurrent.futures.as_completed(batch):
                    page=batch[future];total,rows=future.result();seen.add(page)
                    with self.lock:self.jobs[key]['done']=len(seen);self.jobs[key]['total']=maximum
                    for row in rows:
                        if row['playerId']==uuid:
                            for pending in batch:pending.cancel()
                            return self.found(key,period,page,row)
            with self.lock:
                self.results[key]={'status':'not_listed','player':None,'updatedAt':int(time.time()*1000),'period':period}
                self.jobs[key]['status']='not_listed';self.save()
        except Exception:
            with self.lock:self.jobs[key]['status']='error'

    def found(self,key,period,page,row):
        with self.lock:
            self.results[key]={'status':'found','player':row,'page':page,'updatedAt':int(time.time()*1000),'period':period}
            self.jobs[key]['status']='found';self.save()

    def clan_maps(self):
        return self.clans.maps()

    def lookup(self,uuid,force=False):
        if not isinstance(uuid,str) or not UUID.fullmatch(uuid):raise ValueError('Invalid game UUID')
        uuid=uuid.lower();now=int(time.time()*1000)
        with self.lock:
            active=sum(job['status']=='searching' for job in self.jobs.values())
            if active>=24 and not any(self.jobs.get(p+':'+uuid,{}).get('status')=='searching' for p in PERIODS):raise RuntimeError('Public game search queue is full')
            for period in PERIODS:
                key=period+':'+uuid;prior=self.results.get(key);job=self.jobs.get(key)
                recent=prior and now-prior['updatedAt']<45000
                if job and job['status']=='searching':continue
                if not force and recent:continue
                if not force and job and job['status']=='error' and now-job['startedAt']<10000:continue
                self.jobs[key]={'status':'searching','done':0,'total':None,'startedAt':now}
                self.searches.submit(self.search,uuid,period,prior)
            periods={};progress={}
            for period in PERIODS:
                key=period+':'+uuid;row=self.results.get(key);job=self.jobs.get(key)
                if row and row['status']=='found':periods[period]={**row['player'],'updatedAt':row['updatedAt'],'stale':bool(job and job['status'] in ('searching','error'))}
                else:periods[period]=None
                progress[period]={k:job.get(k) for k in ('status','done','total')} if job else {'status':row['status'] if row else 'searching'}
            found=[row for row in periods.values() if row];player=max(found,key=lambda row:row['updatedAt']) if found else None
            pending=any(x['status']=='searching' for x in progress.values())
            status='found' if player else 'searching' if pending else 'error' if any(x['status']=='error' for x in progress.values()) else 'not_listed'
        clan=self.clans.lookup(uuid,force)
        return {'playerId':uuid,'name':player['name'] if player else clan.get('memberName'),'avatar':player['avatar'] if player else None,
                'status':'found' if clan.get('status')=='found' else status,'periods':periods,'progress':progress,'clan':clan,'updatedAt':now,'source':'pixel_world_api'}

    def close(self):
        self.searches.shutdown(wait=True,cancel_futures=True);self.pages.shutdown(wait=True,cancel_futures=True);self.clans.close()

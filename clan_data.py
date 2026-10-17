"""Public clan rosters and exact clan-war battle intervals from game APIs."""
import concurrent.futures
from datetime import datetime,timezone
import json
import threading
import time
from pathlib import Path

# Keep in sync with battle-timing.mjs: four-minute matches plus observation margin.
BATTLE_FINALIZATION_DELAY_MS=(4*60+90)*1000

def millis(value):
    if not isinstance(value,str):raise ValueError('Missing battle time')
    stamp=datetime.fromisoformat(value.replace('Z','+00:00'))
    if stamp.tzinfo is None:raise ValueError('Battle time must have a timezone')
    return int(stamp.timestamp()*1000)

def valid_id(value):
    if type(value) is not int or value<1:raise ValueError('Invalid clan ID')
    return value

class ClanData:
    def __init__(self,api,directory,login=None):
        self.api=api;self.lock=threading.RLock();self.maps_lock=threading.Lock()
        self.login=login or api.login
        self.pool=concurrent.futures.ThreadPoolExecutor(max_workers=4)
        self.search_pool=concurrent.futures.ThreadPoolExecutor(max_workers=2)
        self.rosters={};self.results={};self.jobs={};self.battles={};self.map_data=None;self.map_time=0
        self.roster_locks={}
        self.file=Path(directory)/'public-clan-cache.json'
        if self.file.exists():self.results=json.loads(self.file.read_text(encoding='utf-8'))

    def save(self):
        self.file.parent.mkdir(parents=True,exist_ok=True)
        temp=self.file.with_suffix('.tmp');temp.write_text(json.dumps(self.results),encoding='utf-8');temp.replace(self.file)

    def roster(self,team_id):
        with self.lock:lock=self.roster_locks.setdefault(team_id,threading.Lock())
        with lock:return self.fetch_roster(team_id)

    def fetch_roster(self,team_id):
        valid_id(team_id)
        with self.lock:
            cached=self.rosters.get(team_id)
            if cached and int(time.time()*1000)-cached['updatedAt']<20000:return cached
        started=int(time.time()*1000);team=self.api.request('team/'+str(team_id)).get('team',{})
        if team.get('id')!=team_id or not isinstance(team.get('name'),str) or not team['name'] or not isinstance(team.get('members'),list):raise ValueError('Invalid public clan roster')
        if len(team['members'])>10000:raise ValueError('Oversized clan roster')
        members=[]
        for row in team['members']:
            if not isinstance(row,dict) or not isinstance(row.get('id'),str) or not isinstance(row.get('username'),str):raise ValueError('Invalid roster member')
            score=row.get('score')
            if type(score) is not int or score<0:raise ValueError('Invalid member points')
            members.append({'playerId':row['id'].lower(),'name':row['username'],'score':score})
        result={'id':team_id,'name':team['name'][:128],'avatar':team.get('imgUrl',''),'members':members,'observedFrom':started,'updatedAt':int(time.time()*1000)}
        with self.lock:self.rosters[team_id]=result
        return result

    def ranked_ids(self):
        ids=[];page=1
        while True:
            data=self.api.request(f'stat/leaderboard/teams?range=month&limit=50&page={page}').get('leaderboard',{})
            listing=data.get('list',{})
            if data.get('range')!='month' or listing.get('page')!=page or type(listing.get('total')) is not int or not 0<=listing['total']<=5000:raise ValueError('Invalid clan table pagination')
            rows=listing.get('teams')
            if not isinstance(rows,list) or len(rows)>50:raise ValueError('Invalid clan table')
            ids.extend(valid_id(row['team_id']) for row in rows if row.get('deleted') is not True)
            if page*50>=listing['total']:return ids
            page+=1

    def battle(self,map_id):
        board=self.api.request('stat/clan-wars/maps/'+map_id+'/leaderboard?limit=50&page=1').get('leaderboard',{})
        if board.get('map_id')!=map_id:raise ValueError('Battle map mismatch')
        start=millis(board.get('segment_started_at'));end=millis(board.get('segment_ends_at'))
        if end<=start:raise ValueError('Invalid battle interval')
        rows=board.get('teams')
        if not isinstance(rows,list) or len(rows)>50:raise ValueError('Invalid battle ranking')
        teams=[]
        for row in rows:
            if type(row.get('points')) is not int or row['points']<0 or type(row.get('place')) is not int or row['place']<1 or not isinstance(row.get('name'),str):raise ValueError('Invalid battle score')
            teams.append({'id':valid_id(row.get('team_id')),'name':row['name'],'score':row['points'],'rank':row['place'],'avatar':row.get('avatar','')})
        return {'mapId':map_id,'startsAt':start,'endsAt':end,'teams':teams,'total':board.get('total',len(teams)),'updatedAt':int(time.time()*1000),'source':'pixel_world_api'}

    def maps(self):
        with self.maps_lock:
            if self.map_data and time.time()-self.map_time<20:return self.map_data
            self.login()
            maps=self.api.request('stat/clan-wars/maps').get('maps')
            if not isinstance(maps,list) or len(maps)>100:raise ValueError('Invalid clan maps')
            jobs={};result=[]
            for original in maps:
                row=dict(original);map_id=row.get('map_id')
                if not isinstance(map_id,str) or not map_id.replace('_','').isalnum():raise ValueError('Invalid clan map ID')
                if row.get('segment_type') not in ('battle','ownership'):raise ValueError('Invalid clan map state')
                start=millis(row.get('segment_started_at'));end=millis(row.get('segment_ends_at'))
                if end<=start:raise ValueError('Invalid map interval')
                row['startsAt']=start;row['endsAt']=end
                cached=self.battles.get(map_id);key=row['segment_started_at']
                finalizing=cached and cached['data']['updatedAt']<cached['data']['endsAt']+BATTLE_FINALIZATION_DELAY_MS
                if not cached or cached['segmentKey']!=key or row['segment_type']=='battle' or finalizing:
                    jobs[self.pool.submit(self.battle,map_id)]=(map_id,key)
                result.append(row)
            for future in concurrent.futures.as_completed(jobs):
                map_id,key=jobs[future]
                try:self.battles[map_id]={'segmentKey':key,'data':future.result()}
                except Exception:pass
            for row in result:
                cached=self.battles.get(row['map_id']);row['lastBattle']=cached['data'] if cached else None
                row['nextBattleStartsAt']=row['endsAt'] if row['segment_type']=='ownership' else None
            self.map_data={'maps':result,'updatedAt':int(time.time()*1000),'source':'pixel_world_api'};self.map_time=time.time()
            return self.map_data

    def search(self,uuid,prior):
        try:
            self.login();candidates=[]
            if prior and prior.get('id'):candidates.append(prior['id'])
            maps=self.maps()['maps']
            candidates.extend(row['owner']['id'] for row in maps if isinstance(row.get('owner'),dict) and type(row['owner'].get('id')) is int)
            seen=set()
            def check(team_id):
                roster=self.roster(team_id)
                for member in roster['members']:
                    if member['playerId']==uuid:
                        return {'status':'found','playerId':uuid,'id':roster['id'],'name':roster['name'],'avatar':roster['avatar'],'memberName':member['name'],'memberScore':member['score'],'observedFrom':roster['observedFrom'],'updatedAt':roster['updatedAt'],'source':'pixel_world_api'}
                return None
            for team_id in dict.fromkeys(candidates):
                seen.add(team_id);found=check(team_id)
                if found:return self.found(uuid,found)
            ids=[i for i in self.ranked_ids() if i not in seen]
            for offset in range(0,len(ids),4):
                futures=[self.pool.submit(check,i) for i in ids[offset:offset+4]]
                for future in concurrent.futures.as_completed(futures):
                    found=future.result()
                    if found:return self.found(uuid,found)
            self.found(uuid,{'status':'not_found','playerId':uuid,'updatedAt':int(time.time()*1000),'source':'pixel_world_api'})
        except Exception:
            with self.lock:self.jobs[uuid]={'status':'error','startedAt':int(time.time()*1000)}

    def found(self,uuid,result):
        with self.lock:self.results[uuid]=result;self.jobs[uuid]={'status':result['status'],'startedAt':result['updatedAt']};self.save()

    def lookup(self,uuid,force=False):
        now=int(time.time()*1000)
        with self.lock:
            prior=self.results.get(uuid);job=self.jobs.get(uuid,{})
            roster=self.rosters.get(prior.get('id')) if prior else None
            if roster and now-roster['updatedAt']<20000 and roster['updatedAt']>=prior['updatedAt']:
                member=next((row for row in roster['members'] if row['playerId']==uuid),None)
                if member:
                    fresh={**prior,'memberName':member['name'],'memberScore':member['score'],'observedFrom':roster['observedFrom'],'updatedAt':roster['updatedAt'],'stale':False,'refreshStatus':'found'}
                    self.results[uuid]=fresh;return fresh
            recent=prior and now-prior['updatedAt']<45000
            if job.get('status')!='searching' and (force or not recent) and not(job.get('status')=='error' and now-job['startedAt']<10000 and not force):
                if sum(j['status']=='searching' for j in self.jobs.values())>=8:return {'status':'error'}
                self.jobs[uuid]={'status':'searching','startedAt':now};self.search_pool.submit(self.search,uuid,prior);job=self.jobs[uuid]
            if prior and prior['status']=='found':return {**prior,'stale':job.get('status') in ('searching','error'),'refreshStatus':job.get('status')}
            return {'status':job.get('status',prior.get('status') if prior else 'searching'),'playerId':uuid,'source':'pixel_world_api'}

    def close(self):
        self.search_pool.shutdown(wait=True,cancel_futures=True);self.pool.shutdown(wait=True,cancel_futures=True)

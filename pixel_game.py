"""Private game transport for public leaderboard and clan-war API reads.

PublicGame selects only the requested UUID from list rows. This transport's
authenticated operator identity is never assigned to a DMX participant.
"""
import asyncio
import json
import time
import urllib.request
from notgames import NotGames

class PixelGame:
    def __init__(self):
        self.source=NotGames()
        self.token=''
        self.refreshed=0

    def request(self,path,body=None):
        headers={'User-Agent':'Mozilla/5.0','Content-Type':'application/json',
                 'Accept':'application/json','Origin':'https://pw.game','Referer':'https://pw.game/'}
        if self.token:headers['Authorization']='Bearer '+self.token
        request=urllib.request.Request('https://release.pw.game/api/v2/'+path,
            data=json.dumps(body).encode() if body is not None else None,headers=headers)
        with self.source.opener.open(request,timeout=20) as response:
            value=json.load(response)
        if value.get('ok') is not True:raise ValueError('Pixel World API did not confirm the response')
        return value['data']

    def login(self):
        if self.token and time.time()-self.refreshed<1200:return
        init=asyncio.run(self.source.init_data('pixelworld','https://pw.game/'))
        data=self.request('auth/login/telegram-mini-apps',{'web_app_data':init})
        self.token=data['access_token']
        self.refreshed=time.time()


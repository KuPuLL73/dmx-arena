import json
import tempfile
import time
import unittest
from urllib.parse import parse_qs,urlparse
from public_game import PublicGame,public_player
PLAYER='00000000-0000-4000-8000-000000000001'
OTHER='019c29a8-cd44-75b9-a8ae-604ad1b6c150'
class FakeAPI:
    def __init__(self):self.calls=[];self.points=123;self.missing_week=False;self.bad_period=False;self.bad_page=False
    def login(self):pass
    def request(self,route):
        self.calls.append(route)
        if route=='stat/clan-wars/maps':return {'maps':[{'map_id':'arena','segment_type':'ownership','segment_started_at':'2026-10-12T20:00:00Z','segment_ends_at':'2026-10-13T19:00:00Z','owner':{'id':41,'name':'Clan'}}]}
        if route.startswith('stat/clan-wars/maps/'):return {'leaderboard':{'map_id':'arena','segment_started_at':'2026-10-12T19:00:00Z','segment_ends_at':'2026-10-12T20:00:00Z','teams':[],'total':0}}
        if route=='team/41':return {'team':{'id':41,'name':'Clan','members':[{'id':PLAYER,'username':'DIAVOLO','score':self.points}]}}
        params=parse_qs(urlparse(route).query);period=params['range'][0];page=int(params['page'][0])
        assert params['limit']==['50']
        count=50 if page==1 else 30
        rows=[{'uuid':OTHER,'nickname':'Other','points':1,'place':i+1} for i in range(count)]
        if page==2 and not(period=='week' and self.missing_week):rows[0]={'uuid':PLAYER,'nickname':'DIAVOLO','points':self.points,'place':51}
        return {'leaderboard':{'range':'wrong' if self.bad_period else period,'user':{'uuid':PLAYER,'points':999999,'nickname':'IGNORE THIS'},'list':{'page':1 if self.bad_page else page,'total':80,'players':rows}}}
def settle(game,player=PLAYER):
    end=time.monotonic()+3
    while time.monotonic()<end:
        result=game.lookup(player)
        if all(row['status']!='searching' for row in result['progress'].values()):return result
        time.sleep(.01)
    raise AssertionError('lookup did not finish')
class PublicGameTests(unittest.TestCase):
    def setUp(self):
        self.directory=tempfile.TemporaryDirectory(prefix='dmx-public-test-');self.api=FakeAPI();self.game=PublicGame(self.api,self.directory.name)
    def tearDown(self):self.game.close();self.directory.cleanup()
    def test_exact_uuid_pagination_and_persistence(self):
        self.game.lookup(PLAYER.upper());result=settle(self.game)
        self.assertEqual(result['name'],'DIAVOLO');self.assertEqual(result['periods']['day']['score'],123);self.assertEqual(result['periods']['day']['rank'],51)
        self.assertTrue(any('page=2' in route for route in self.api.calls));self.assertFalse(result['periods']['day']['stale'])
        saved=json.loads(self.game.file.read_text());self.assertEqual(saved['day:'+PLAYER]['page'],2)
        calls=len(self.api.calls);self.game.lookup(PLAYER);self.assertEqual(len(self.api.calls),calls)
    def test_operator_row_ignored_and_missing_is_not_zero(self):
        self.api.missing_week=True;result=settle(self.game)
        self.assertEqual(result['name'],'DIAVOLO');self.assertIsNone(result['periods']['week']);self.assertEqual(result['progress']['week']['status'],'not_listed')
    def test_refresh(self):
        settle(self.game);self.api.points=456;self.game.lookup(PLAYER,True);result=settle(self.game);self.assertEqual(result['periods']['day']['score'],456)
    def test_period_and_page_integrity(self):
        self.api.bad_period=True;self.assertRaises(ValueError,self.game.page,'day',1)
        self.api.bad_period=False;self.api.bad_page=True;self.assertRaises(ValueError,self.game.page,'day',2)
    def test_invalid_uuid_and_points(self):
        self.assertRaises(ValueError,self.game.lookup,'bad')
        self.assertRaises(ValueError,public_player,{'uuid':PLAYER,'nickname':'Fake','points':True,'place':1})
        self.assertRaises(ValueError,public_player,{'uuid':PLAYER,'nickname':'Fake','points':-1,'place':1})
    def test_clan_api_cached(self):
        self.assertEqual(self.game.clan_maps()['maps'][0]['owner']['name'],'Clan')
        self.game.clan_maps();self.assertEqual(self.api.calls.count('stat/clan-wars/maps'),1)
if __name__=='__main__':unittest.main()

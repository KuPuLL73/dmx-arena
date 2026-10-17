import tempfile
import time
import unittest
from clan_data import ClanData
from clan_data import millis,BATTLE_FINALIZATION_DELAY_MS
from unittest.mock import patch
UUID='00000000-0000-4000-8000-000000000001'
OTHER='019c29a8-cd44-75b9-a8ae-604ad1b6c150'
class API:
 def __init__(self):self.calls=[];self.score=120;self.wrong_roster=False;self.wrong_map=False;self.battle_score=11414
 def login(self):pass
 def request(self,route):
  self.calls.append(route)
  if route=='stat/clan-wars/maps':return {'maps':[{'map_id':'temple_level','segment_type':'ownership','segment_started_at':'2026-10-12T14:00:00Z','segment_ends_at':'2026-10-13T13:00:00Z','owner':{'id':41,'name':'DMX & VOLOLO'}}]}
  if route.startswith('stat/clan-wars/maps/'):return {'leaderboard':{'map_id':'wrong' if self.wrong_map else 'temple_level','segment_started_at':'2026-10-12T13:00:00Z','segment_ends_at':'2026-10-12T14:00:00Z','teams':[{'team_id':41,'name':'DMX & VOLOLO','place':1,'points':self.battle_score}],'total':1}}
  if route=='team/41':return {'team':{'id':5 if self.wrong_roster else 41,'name':'DMX & VOLOLO','members':[{'id':UUID,'username':'DIAVOLO','score':self.score},{'id':OTHER,'username':'Other','score':9999}]}}
  if route.startswith('stat/leaderboard/teams'):return {'leaderboard':{'range':'month','list':{'page':1,'total':1,'teams':[{'team_id':41,'name':'DMX & VOLOLO'}]}}}
  raise AssertionError(route)
def settle(data,uuid=UUID):
 end=time.monotonic()+2
 while time.monotonic()<end:
  result=data.lookup(uuid)
  if result['status']!='searching':return result
  time.sleep(.01)
 raise AssertionError('clan lookup timeout')
class ClanTests(unittest.TestCase):
 def setUp(self):self.dir=tempfile.TemporaryDirectory(prefix='dmx-clan-test-');self.api=API();self.data=ClanData(self.api,self.dir.name)
 def tearDown(self):self.data.close();self.dir.cleanup()
 def test_membership_by_exact_uuid(self):
  result=settle(self.data);self.assertEqual(result['id'],41);self.assertEqual(result['memberName'],'DIAVOLO');self.assertEqual(result['memberScore'],120);self.assertEqual(result['playerId'],UUID)
  other=settle(self.data,OTHER);self.assertEqual(other['memberScore'],9999);self.assertEqual(self.api.calls.count('team/41'),1,'roster query shared between participants')
 def test_schedule_and_last_battle(self):
  maps=self.data.maps();row=maps['maps'][0];self.assertEqual(row['lastBattle']['teams'][0]['score'],11414);self.assertEqual(row['nextBattleStartsAt'],row['endsAt']);self.assertEqual(row['lastBattle']['endsAt'],row['startsAt'])
  self.data.maps();self.assertEqual(self.api.calls.count('stat/clan-wars/maps'),1)
 def test_roster_identity(self):
  self.api.wrong_roster=True;self.assertRaises(ValueError,self.data.roster,41)
 def test_battle_identity(self):
  self.api.wrong_map=True;self.assertRaises(ValueError,self.data.battle,'temple_level')
 def test_shared_roster_refresh(self):
  settle(self.data);self.api.score=999;self.data.rosters[41]['updatedAt']=0
  self.data.lookup(UUID,True);end=time.monotonic()+2
  while time.monotonic()<end:
   result=self.data.lookup(UUID)
   if result.get('memberScore')==999:break
   time.sleep(.01)
  self.assertEqual(result['memberScore'],999)
 def test_final_results_keep_refreshing_after_entry_closes(self):
  end=millis('2026-10-12T14:00:00Z');route='stat/clan-wars/maps/temple_level/leaderboard?limit=50&page=1'
  with patch('clan_data.time.time',return_value=(end+60000)/1000):self.data.maps()
  self.api.battle_score=11519
  with patch('clan_data.time.time',return_value=(end+81000)/1000):
   result=self.data.maps();self.assertEqual(result['maps'][0]['lastBattle']['teams'][0]['score'],11519)
  self.assertEqual(self.api.calls.count(route),2,'last-minute results refresh even during ownership')
  with patch('clan_data.time.time',return_value=(end+BATTLE_FINALIZATION_DELAY_MS)/1000):self.data.maps()
  with patch('clan_data.time.time',return_value=(end+BATTLE_FINALIZATION_DELAY_MS+30000)/1000):self.data.maps()
  self.assertEqual(self.api.calls.count(route),3,'stable finalized results can be cached')
if __name__=='__main__':unittest.main()

import unittest
from notgames import NotGames,normalized_item

class InventoryTests(unittest.TestCase):
    def api(self,pages):
        api=NotGames.__new__(NotGames)
        import threading
        api.lock=threading.RLock();api.cache={};api.refresh_token=lambda:None
        def request(path):
            if path.startswith('profiles/'):return {'profile':{'id':'123'}}
            return pages.pop(0)
        api.request=request
        return api
    def raw(self,kind='Weapon',owner='123',item_id='1'):
        return {'account_id':owner,'app_id':16,'item_id':item_id,'display_type':kind,'collection':'Plunger' if kind=='Weapon' else 'Dogs','tags':'{"model":{"v":"Pink Panic","rarity":"70"}}','icon_url':'https://static.pw.game/test.png'}
    def test_snapshot_owner_type_and_new_collection(self):
        api=self.api([{'items':[self.raw()],'pagination':{'total':'1'}},{'pagination':{}}])
        rows=api.inventory(123);self.assertEqual(rows[0]['slot'],'Plunger');self.assertIsNone(rows[0]['monochromePercent']);self.assertTrue(rows[0]['owned'])
    def test_foreign_item_or_stalled_snapshot_rejected(self):
        for page in ({'items':[self.raw(owner='999')],'pagination':{'total':'1'}},{'items':[],'pagination':{'total':'2'}}):
            with self.assertRaises(ValueError):self.api([page]).inventory(123)
    def test_no_case_slot_or_insecure_image(self):
        self.assertIsNone(normalized_item(self.raw(kind='Weapon Case')))
        raw=self.raw();raw['icon_url']='javascript:alert(1)';self.assertEqual(normalized_item(raw)['image'],'')
    def test_exact_game_model_ids_are_preserved_without_name_guessing(self):
        raw=self.raw();raw['default_tags']='{"id":{"v":"2"}}';raw['tags']='{"model":{"v":"Toxic","id":"11"}}'
        self.assertEqual(normalized_item(raw)['gameModel'],{'kind':'weapon','definitionId':2,'skinId':11})
        raw['display_type']='Mask';raw['tags']={'model':{'v':'Skin','id':'0'}}
        self.assertEqual(normalized_item(raw)['gameModel'],{'kind':'mask','definitionId':2,'skinId':0})
        for invalid in [True,-1,'-1','evil',65536]:
            raw['tags']['model']['id']=invalid
            self.assertIsNone(normalized_item(raw)['gameModel'])
        raw['tags']={'model':{'v':'Toxic'}}
        self.assertIsNone(normalized_item(raw)['gameModel'])
    def test_skin_traits_and_rarity_are_preserved_without_invented_values(self):
        raw=self.raw();raw.update(serial=155,supply=1500,tags={'model':{'v':'Pink Panic','rarity':'70'},'symbol':{'v':'Cat','rarity':'1'},'backdrop':{'v':'Silver Blue','rarity':'1'}})
        row=normalized_item(raw)
        self.assertEqual(row['model'],'Pink Panic');self.assertEqual(row['symbol'],'Cat');self.assertEqual(row['backdrop'],'Silver Blue');self.assertEqual(row['serial'],'155');self.assertEqual(row['supply'],1500)
        self.assertEqual(row['traitRarity'],{'model':70,'symbol':1,'backdrop':1});self.assertIsNone(row['monochromePercent'])
        raw['tags']['model']['rarity']='unknown';raw['tags']['symbol']['rarity']='101';raw['supply']=True
        row=normalized_item(raw);self.assertIsNone(row['traitRarity']['model']);self.assertIsNone(row['traitRarity']['symbol']);self.assertIsNone(row['supply'])

if __name__=='__main__':unittest.main()

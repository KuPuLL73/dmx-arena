"""Private NDJSON bridge; never served by the DMX HTTP server."""
import json
import sys
from notgames import NotGames
from public_game import PublicGame
api=None
game=None
for line in sys.stdin:
    request={}
    try:
        request=json.loads(line)
        if request.get('kind') in ('lookupPlayer','clanWars','clanPlayer'):
            if game is None:game=PublicGame()
            if request['kind']=='lookupPlayer':rows=game.lookup(request['playerId'],request.get('force') is True)
            elif request['kind']=='clanPlayer':rows=game.clans.lookup(request['playerId'],request.get('force') is True)
            else:rows=game.clan_maps()
        else:
            if api is None:api=NotGames()
            rows=api.inventory(request['userId'],request.get('force') is True)
        result={'id':request['id'],'items':rows}
    except Exception:
        result={'id':request.get('id'),'error':'Pixel World временно недоступен.' if request.get('kind') in ('lookupPlayer','clanWars','clanPlayer') else 'Инвентарь NotGames временно недоступен.'}
    print(json.dumps(result,ensure_ascii=False),flush=True)
if game is not None:game.close()

/* Local RU/EN UI catalogue. User nicknames, clan names and set names are preserved. */
(()=>{
 const dictionary=Object.fromEntries(`
Всего DMX у участников клана|Total DMX held by clan members
Отказаться|Decline
Вернуть задание|Restore quest
Отложенные|Deferred
Ящики|Boxes

Ящики, Панелька, Город — 100; остальные — 50.|Boxes, Panelka, City: 100; other maps: 50.
Победить на карте · топ-5 по вкладу от 1 000|Win a map · top 5 with 1,000+ contribution
25 000 очков за неделю|25,000 points in a week
Масштабный вклад|Major Effort
Ежедневные цели на 2, 3 и 5 картах доступны одновременно. На каждой карте нужен вклад 1 000 / 2 000 / 3 000 за одну битву. Награды: 5 / 10 / 15, 10 / 25 / 50 и 25 / 50 / 75 DMX соответственно. Каждая из девяти целей оплачивается отдельно один раз в день — до 265 DMX.|Daily goals for 2, 3 and 5 maps are available together. Each map requires 1,000 / 2,000 / 3,000 points in one battle. Rewards: 5 / 10 / 15, 10 / 25 / 50 and 25 / 50 / 75 DMX respectively. All nine goals pay separately once per day, up to 265 DMX.
Недельный маршрут: по 1 000 на 5 разных картах — 100 DMX; на 10 — ещё 150, всего 250. Отдельные задания: 10 000 очков за неделю — 250 DMX, 25 000 — ещё 500 DMX. Все недельные награды вместе — до 1 000 DMX.|Weekly Route: 1,000 points on each of 5 maps gives 100 DMX; 10 maps gives another 150, totaling 250. Separate quests pay 250 DMX for 10,000 weekly points and another 500 for 25,000. All weekly rewards total up to 1,000 DMX.
Победа при личном вкладе от 1 000 — 10 DMX за захват или защиту. Топ-5 DMX победившего клана по учтённому вкладу дополнительно получает 100 DMX на Ящиках, Панельке и в Городе, 50 DMX — на остальных картах. Нужны итог битвы и подтверждённый владелец.|Winning with at least 1,000 personal points gives 10 DMX for a capture or defense. The winning clan’s top 5 DMX members by tracked contribution also get 100 DMX on Boxes, Panelka and City, or 50 on other maps. Final results and confirmed ownership are required.
За полностью пройденную выигранную битву участник топ-5 получает 110–160 DMX без сета или 165–240 с полным сетом. К этому добавляются выполненные дневные, недельные и разовые цели. Общего дневного лимита нет.|A winning top-5 member completing the battle ladder earns 110–160 DMX without a loadout or 165–240 with a full loadout, plus completed daily, weekly and one-time goals. There is no overall daily cap.
На 2 картах|On 2 maps
По 1 000 очков на 2 картах|1,000 points on each of 2 maps
По 1 000 очков на 2 картах|1,000 points on each of 2 maps
По 1,000 очков на 2 картах|1,000 points on each of 2 maps
По 2 000 очков на 2 картах|2,000 points on each of 2 maps
По 2 000 очков на 2 картах|2,000 points on each of 2 maps
По 2,000 очков на 2 картах|2,000 points on each of 2 maps
По 3 000 очков на 2 картах|3,000 points on each of 2 maps
По 3 000 очков на 2 картах|3,000 points on each of 2 maps
По 3,000 очков на 2 картах|3,000 points on each of 2 maps
На 3 картах|On 3 maps
По 1 000 очков на 3 картах|1,000 points on each of 3 maps
По 1 000 очков на 3 картах|1,000 points on each of 3 maps
По 1,000 очков на 3 картах|1,000 points on each of 3 maps
По 2 000 очков на 3 картах|2,000 points on each of 3 maps
По 2 000 очков на 3 картах|2,000 points on each of 3 maps
По 2,000 очков на 3 картах|2,000 points on each of 3 maps
По 3 000 очков на 3 картах|3,000 points on each of 3 maps
По 3 000 очков на 3 картах|3,000 points on each of 3 maps
По 3,000 очков на 3 картах|3,000 points on each of 3 maps
На 5 картах|On 5 maps
По 1 000 очков на 5 картах|1,000 points on each of 5 maps
По 1 000 очков на 5 картах|1,000 points on each of 5 maps
По 1,000 очков на 5 картах|1,000 points on each of 5 maps
По 2 000 очков на 5 картах|2,000 points on each of 5 maps
По 2 000 очков на 5 картах|2,000 points on each of 5 maps
По 2,000 очков на 5 картах|2,000 points on each of 5 maps
По 3 000 очков на 5 картах|3,000 points on each of 5 maps
По 3 000 очков на 5 картах|3,000 points on each of 5 maps
По 3,000 очков на 5 картах|3,000 points on each of 5 maps

Подписаться на @DMX_Core|Subscribe to @DMX_Core
Подписаться ↗|Subscribe ↗
Проверить подписку|Check subscription
Один раз · без бонуса сета|Once · no loadout bonus
Награда получена ✓|Reward received ✓
Выполнено ✓|Completed ✓
Выполненные|Completed
Подписка подтверждена. Награда — 100 DMX.|Subscription confirmed. Reward: 100 DMX.
Задания открыты. Игровые награды начисляются автоматически.|Quests are live. Game rewards are credited automatically.
Открой DMX в Telegram, чтобы выполнять задания.|Open DMX in Telegram to complete quests.
Бонус сета действует на повторяемые игровые задания: +10% за свой надетый скин, максимум +50%. Одноразовые задания без бонуса: подписка — 100 DMX, DMX в нике — 50 DMX. Награда каждого задания округляется вниз до целого DMX. Проверяем владение скинами при начислении; уже полученные награды не пересчитываются.|The loadout bonus applies to recurring game quests: +10% per owned equipped skin, up to +50%. One-time quests have no bonus: subscription pays 100 DMX; DMX in your nickname pays 50 DMX. Each quest reward is rounded down to whole DMX. Skin ownership is checked at payment time; previous rewards are not recalculated.
Добавить DMX в ник в игре|Add DMX to your game nickname
Проверить ник|Check nickname
Ник проверен.|Nickname checked.
к повторяемым игровым заданиям|on recurring game quests
Битва уже завершилась. Обновляем расписание.|The battle has ended. Refreshing the schedule.
Играть|Play
ко всем игровым заданиям|on all game quests
Ящики, Панелька, Город —|Boxes, Panelka, City —
остальные —|others —
Бонус сета действует только на лестницу: +10% за свой надетый скин, максимум +50%. Полный сет: 15 / 37 / 75 DMX суммарно. Остальные награды фиксированные.|The loadout bonus applies only to battle ladders: +10% per owned equipped skin, up to +50%. A full loadout gives 15 / 37 / 75 DMX in total. Other rewards are fixed.
Подписка|Subscription
Подписка @DMX_Core — 100 DMX один раз после проверки Telegram. Повторная подписка не даёт второй награды.|Subscribe to @DMX_Core for a one-time 100 DMX reward after Telegram verification. Resubscribing gives no second reward.
Ежедневные и недельные цели|Daily and weekly goals
«Два фронта»: один вариант в день, по 1 000 / 2 000 / 3 000 на двух картах одного клана за отдельные битвы. Награда 10 / 15 / 25 DMX. Варианты сменяются по порядку.|Two Fronts: one daily variant requiring 1,000 / 2,000 / 3,000 points on each of two maps for the same clan. Each map uses a single battle. Rewards: 10 / 15 / 25 DMX. Variants rotate in order.
Недельный маршрут: по 1 000 на 5 разных картах — 100 DMX; на 10 — ещё 150, всего 250. За 10 000 очков за неделю — 250 DMX. Обе цели вместе — до 500 DMX в неделю.|Weekly Route: 1,000 points on each of 5 maps gives 100 DMX; 10 maps gives another 150, totaling 250. Score 10,000 points in a week for 250 DMX. Both goals total up to 500 DMX a week.
Победы|Victories
Победа при личном вкладе от 1 000 — 10 DMX за захват или защиту. Топ-10 DMX победившего клана по учтённому вкладу дополнительно получает награду карты. Нужны итог битвы и подтверждённый владелец.|Winning with at least 1,000 personal points gives 10 DMX for a capture or defense. The winning clan’s top 10 DMX members by tracked contribution also receive the map reward. Final results and confirmed ownership are required.
Награда|Reward
Пять медалей дают вместе до 1 100 DMX за первое открытие. Повторного денежного бонуса нет. Рекорд сравниваем с завершёнными раньше битвами.|Five medals award up to 1,100 DMX for first unlocks only. No repeat point bonus. Personal records are compared with battles that ended before the new battle started.
Учёт и периоды|Tracking and periods
Дополнительные цели учитывают завершённые битвы после запуска. Начисление — через 5 минут 30 секунд после завершения: ждём окончания последних матчей и обновления данных. День — с 00:00 UTC, неделя — с понедельника 00:00 UTC. Незачтённая из-за задержки награда сохраняется за своим периодом.|Additional goals count battles completed after launch. Settlement starts 5 minutes 30 seconds after the battle ends to allow final matches and data updates. Days start at 00:00 UTC, weeks on Monday at 00:00 UTC. Delayed rewards remain assigned to their original period.
Дополнительные цели учитывают завершённые битвы после запуска. День — с 00:00 UTC, неделя — с понедельника 00:00 UTC.|Additional goals count battles completed after launch. Days start at 00:00 UTC; weeks on Monday at 00:00 UTC.
Считаем безопасно наблюдённый личный вклад. При пропусках и пересечениях битв неподтверждённые очки не зачисляются. Историю до наблюдения не восстанавливаем.|Only safely observed personal contributions count. Unverified points from monitoring gaps or overlapping battles are excluded. History before tracking cannot be reconstructed.
Размер наград|Reward amounts
За полностью пройденную выигранную битву участник топ-10 получает 110–160 DMX без сета или 165–240 с полным сетом. К этому добавляются выполненные дневные, недельные и разовые цели. Общего дневного лимита нет.|A winning top-10 member completing the full battle ladder earns 110–160 DMX without a loadout or 165–240 with a full loadout. Daily, weekly and one-time goals add rewards. There is no overall daily cap.
Фонды владения клана и турниры пока не начисляются.|Clan ownership funds and tournaments do not award points yet.
Telegram пока не подтвердил подписку. Попробуй ещё раз чуть позже.|Telegram could not verify your subscription yet. Please try again later.
Проверка подписки пока недоступна. Попробуй позже.|Subscription verification is unavailable. Please try later.
Подпишись на @DMX_Core и нажми «Проверить подписку».|Subscribe to @DMX_Core and tap Check subscription.
Повтори проверку через несколько секунд.|Try checking again in a few seconds.
Получение наград пока недоступно.|Rewards are currently unavailable.
Ник обновляется только из Pixel World.|Your nickname updates only from Pixel World.
По 1 000 очков на двух картах|1,000 points on each of two maps
По 1 000 очков на двух картах|1,000 points on each of two maps
По 1,000 очков на двух картах|1,000 points on each of two maps
По 2 000 очков на двух картах|2,000 points on each of two maps
По 2 000 очков на двух картах|2,000 points on each of two maps
По 2,000 очков на двух картах|2,000 points on each of two maps
По 3 000 очков на двух картах|3,000 points on each of two maps
По 3 000 очков на двух картах|3,000 points on each of two maps
По 3,000 очков на двух картах|3,000 points on each of two maps
В другом сете|In another loadout
Все твои скины используются в сетах.|All your skins are used in loadouts.
Все скины игрока используются в сетах.|All this player’s skins are used in loadouts.
Скин уже используется в другом сете. Сначала убери его оттуда.|This skin is already used in another loadout. Remove it there first.
Нет свободных скинов для этого слота. Скин из другого сета сначала нужно убрать оттуда.|No free skins for this slot. Remove a skin from its other loadout first.
Скинов|Skins
Сетов|Loadouts
Подключить Pixel World|Connect Pixel World
Где найти UID?|Where can I find my UID?
Открой|Open
и перейди в свой профиль.|and go to your profile.
Скопируй UID (ID игрока) — длинный код с дефисами.|Copy your UID (player ID), the long code with hyphens.
Вставь его ниже и нажми «Найти игрока».|Paste it below and select “Find player”.
Вставь UID из профиля Pixel World|Paste the UID from your Pixel World profile
ПРОШЛАЯ БИТВА|PREVIOUS BATTLE
Прошлая карта|Previous map
Следующая карта|Next map
Итоги|Results
Битва завершена|Battle finished
Главная|Home
Задания|Quests
Топ игроков|Leaderboard
Профиль|Profile
Настройки|Settings
НАСТРОЙКИ|SETTINGS
Настройки профиля|Profile settings
Настройки сохранены.|Settings saved.
Имя|Name
Язык|Language
Русский|Russian
Не указан|Not set
Добавить UID|Add UID
Открыть UID|View UID
Приватный профиль|Private profile
Скины, сеты и игровая статистика видны только тебе. Ник и баланс остаются в рейтинге.|Only you can see your skins, sets and game statistics. Your name and balance remain on the leaderboard.
Игрок скрыл свои скины, сеты и игровую статистику.|This player has hidden their skins, sets and game statistics.
Сохранить|Save
Отмена|Cancel
Закрыть|Close
Готово|Done
Понятно|Got it
Назад|Back
Изменить|Edit
Удалить|Delete
Убрать|Remove
Выбрать|Select
Заменить|Replace
Снять|Unequip
Скоро|Coming soon
Войти|Sign in
Повторить|Retry
Обновить|Refresh
Обновляю…|Refreshing…
Обновляем данные…|Updating…
Игрок|Player
Игроки|Players
Клан|Clan
Кланы|Clans
Ник|Nickname
Карты|Maps
Карта|Map
Карт|Maps
Рейтинг|Leaderboard
За всё время · только участники DMX|All time · DMX players only
Участники клана|Clan members
Игроки в нашем приложении|Players in DMX
Участников DMX пока нет|No DMX members yet
Игроки появятся здесь после привязки игрового ID и определения клана.|Players appear here after linking their game UID and identifying their clan.
Загружаем участников клана…|Loading clan members…
Клан недоступен.|Clan unavailable.
Здесь появятся кланы участников DMX.|DMX players’ clans will appear here.
Здесь появятся участники DMX и их заработанные очки.|DMX players and their earned points will appear here.
Загружаю рейтинг…|Loading leaderboard…
Не удалось обновить. Повторим автоматически.|Could not update. We will retry automatically.
Рейтинг временно недоступен. Повторим автоматически.|Leaderboard temporarily unavailable. We will retry automatically.
Заработано участниками в этом клане · за всё время|Earned by members of this clan · all time
В списке участники DMX по последним сохранённым данным игры. Нажми на игрока, чтобы открыть его профиль.|DMX members from the latest saved game data. Tap a player to view their profile.
Баланс DMX|DMX balance
О поинтах DMX|About DMX points
Баланс и правила DMX|DMX balance and rules
Основные разделы|Main navigation
ТВОЯ ИГРА|YOUR GAME
Сделано для игроков.|Made for players.
Игра внутри игры|A game within the game
Твой клан. Твой след.|Your clan. Your mark.
Битвы сейчас|Battles now
Следующая битва|Next battle
Результаты|Results
Результаты битвы|Battle results
Последние результаты|Latest results
ИДЁТ БИТВА|BATTLE LIVE
СЛЕДУЮЩАЯ БИТВА|NEXT BATTLE
СКОРО БИТВА|BATTLE SOON
КОНТРОЛЬ|CONTROL
ОБНОВЛЯЕМ|UPDATING
НЕТ РАСПИСАНИЯ|NO SCHEDULE
До конца|Ends in
До начала|Starts in
До конца битвы|Battle ends in
До начала битвы|Battle starts in
Ждём расписание|Waiting for schedule
Клановые битвы|Clan battles
Клановые войны|Clan wars
Клановая битва|Clan battle
Клановая война|Clan war
Клан Pixel World|Pixel World clan
Очки клановой битвы|Clan battle points
Твой клан|Your clan
ТВОЯ ЦЕЛЬ|YOUR GOAL
ЦЕЛЬ ДОСТИГНУТА|GOAL REACHED
Цель достигнута|Goal reached
Цель достигнута. Проверяем автоматическое начисление $DMX.|Goal reached. Verifying automatic $DMX payment.
За эту битву начислено|Credited for this battle:
Новая битва — новая лестница.|A new battle starts a new ladder.
Загружаем профиль и твои скины…|Loading your profile and skins…
Открой бота и нажми кнопку DMX.|Open the bot and tap DMX.
Привяжи игровой ID, чтобы учитывать вклад.|Link your game UID to track contribution.
Все три ступени пройдены.|All three milestones completed.
очков в этой битве.|points in this battle.
Битва идёт. Ждём подтверждённый вклад.|Battle in progress. Waiting for verified contribution.
Открыть Telegram|Open Telegram
Открыть профиль|Open profile
Найдём твой клан в игре|We will find your clan in the game
Твой вклад в текущую битву|Your contribution to this battle
Подготовься к следующей битве|Prepare for the next battle
Ожидаем расписание игры|Waiting for the game schedule
Новый вклад учитывается в часы одной битвы. При пересечении расписаний ждём подтверждения.|New contribution is tracked within one battle. Overlapping schedules wait for verification.
Учтённый вклад в этой битве|Tracked contribution to this battle
Вклад до наблюдения сюда не включён.|Contribution before observation is not included.
Бой|Battle
Клановые войны временно недоступны.|Clan wars temporarily unavailable.
Показаны первые|Showing the first
кланов из|clans out of
Твой сет|Your loadout
Надетый сет|Equipped loadout
Бонус сета|Loadout bonus
Бонус за надетые скины|Equipped skin bonus
К НАГРАДАМ|TO REWARDS
Нажми на слот, чтобы сменить свой скин.|Tap a slot to change your skin.
Нажми на слот, чтобы добавить свой скин.|Tap a slot to add your skin.
Загружаем твой инвентарь…|Loading your inventory…
Загружаю твой инвентарь…|Loading your inventory…
Загружаем карты|Loading maps
Расписание пока недоступно|Schedule unavailable
Не удалось загрузить расписание.|Could not load the schedule.
Ожидаем расписание из игры.|Waiting for the game schedule.
Ожидаем расписание клановых битв.|Waiting for the clan battle schedule.
Следи за расписанием и готовь свой сет.|Check the schedule and prepare your loadout.
Готовность к бою|Ready for battle
Мощный вклад|Strong contribution
Вперёд, за клан|Fight for your clan
Вклад пока не определён|Contribution not yet available
Учтённый вклад в битве|Tracked battle contribution
Подключи свой профиль|Connect your profile
Подключить игру|Connect game
Привязать игру|Link game
Привяжи игровой ID|Link your game UID
Загружаем расписание и данные твоего клана.|Loading the schedule and clan data.
Новые очки учитываются по расписанию битв после привязки ID.|New points are tracked during scheduled battles after linking your UID.
Вклад появится после наблюдения за твоими клановыми битвами.|Contribution will appear after your clan battles are observed.
Расписание и результаты появятся из игры.|The schedule and results will be loaded from the game.
Расписание и битвы|Schedule and battles
Карты сражений|Battle maps
Выбери карту для цели и результатов.|Select a map to view its goals and results.
Выбери карту сражения|Select a battle map
Выбери сражение|Select a battle
Время на твоём устройстве. Расписание загружается из игры.|Times use your device timezone. The schedule comes from the game.
Владелец не определён|Owner unknown
Пока не определён|Not yet known
Битва за карту|Battle for the map
Владелец:|Owner:
Начало битвы:|Battle starts:
Битва:|Battle:
Текущая битва|Current battle
Итоги последней битвы|Last battle results
Таблица текущей битвы|Current battle leaderboard
Данные игры|Game data
Из игры|From the game
Нажми на клан, чтобы увидеть участников DMX.|Tap a clan to see its DMX members.
Нет данных|No data
Пока нет строки твоего клана в таблице|Your clan is not on the leaderboard yet
Очки появятся во время битвы|Points will appear during the battle
На каждой карте|On every map
очков за битву|points per battle
Ротация|Rotation
За неделю|Weekly
За победу|Victory
Медали|Medals
По 1 000 / 2 000 / 3 000 очков на двух картах|1,000 / 2,000 / 3,000 points on two maps
По 1 000 очков на 5 / 10 картах за неделю|1,000 points on 5 / 10 maps in a week
10 000 очков за неделю|10,000 points in a week
Победить на карте · топ-10 по вкладу от 1 000|Win a map · top 10 with 1,000+ contribution
Захватить или защитить карту · вклад от 1 000|Capture or defend a map · 1,000+ contribution
По 1 000 очков на каждой из 11 карт|1,000 points on each of the 11 maps
20 битв с вкладом от 1 000 в каждой|20 battles with 1,000+ contribution each
10 побед с вкладом от 1 000 в каждой|10 wins with 1,000+ contribution each
5 раз в топ-3 DMX своего клана · вклад от 500 · от 5 участников|Top 3 in your DMX clan 5 times · 500+ contribution · 5+ players
Улучшить рекорд от 1 000 очков на 20%|Improve a 1,000+ point personal best by 20%
Скины|Skins
Сеты|Loadouts
Другие скины|Other skins
Сохранённые сеты|Saved loadouts
Добавить сет|Add loadout
Создать|Create
Надеть|Equip
Надет|Equipped
НАДЕТО|EQUIPPED
Мой сет|My loadout
Мои|Mine
Образцы|Templates
Сохранён|Saved
Пример|Example
Проверь сет|Review loadout
Удалить сет|Delete loadout
Поделиться|Share
Посмотреть сет|View loadout
Твои игровые сеты|Your game loadouts
С чистого листа|Start fresh
Все твои скины в надетом сете.|All your skins are in the equipped loadout.
Все скины игрока в надетом сете.|All this player’s skins are equipped.
Пока нет подтверждённых скинов.|No verified skins yet.
Выбери скины на главной|Choose skins on Home
Нет надетого сета|No equipped loadout
Нет скина|No skin
Место в DMX|DMX rank
Учтено в битвах|Tracked battle points
Игровая информация|Game information
Захвачено карт|Maps captured
При личном вкладе от 1 000|With 1,000+ personal contribution
Учёт начнётся после подключения игры.|Tracking starts after connecting the game.
Учёт DMX с|Tracked by DMX since
История до наблюдения не восстановлена.|Earlier history is unavailable.
Показаны сохранённые подтверждённые наблюдения DMX, а не полная история игрового аккаунта.|Showing verified DMX observations, not the account’s full game history.
Во владении клана:|Owned by the clan:
данные обновляются|updating data
Привязанный клан пока не определён.|Linked clan not yet identified.
Инвентарь проверен|Inventory verified
Основное|Primary
Вспомогательное|Secondary
Вспомогат.|Secondary
Ближний бой|Melee
Специальное|Special
Специальн.|Special
Голова|Head
Маска|Mask
Выбрать скин|Select skin
Осмотреть скин|Inspect skin
Осмотреть|Inspect
Добавить скин|Add skin
Заменить скин|Change skin
Снять скин|Unequip skin
Скин снят.|Skin unequipped.
Скин надет.|Skin equipped.
Каждый надетый скин добавляет +10% к наградам DMX.|Each equipped skin adds +10% to DMX rewards.
В этом слоте пока нет твоих скинов. Обнови инвентарь в профиле.|You have no skins for this slot yet. Refresh your inventory.
Собери свой сет|Build your loadout
Выбери пять предметов для игры.|Choose five items for the game.
Название сета|Loadout name
Например, Night shift|For example, Night shift
Сохранить сет|Save loadout
К конструктору|Back to builder
Выбор скина|Choose a skin
Мои скины|My skins
Все скины|All skins
Каталог скинов|Skin catalogue
Каталог|Catalogue
Поиск|Search
Скин или коллекция|Skin or collection
Есть в продаже|Available for sale
Ничего не найдено.|Nothing found.
Пока нет твоих скинов этой категории. Посмотри «Все скины».|You have no skins in this category. Browse All skins.
В этой категории пока нет скинов.|No skins in this category yet.
Каталог обновлён:|Catalogue updated:
Коллекция|Collection
Модель|Model
Символ|Symbol
Фон|Backdrop
Номер|Number
Выпуск|Supply
Статус|Status
В твоём инвентаре|In your inventory
Образец сета|Loadout template
Модель есть в продаже|Model available for sale
Сохранить образец|Save template
Убрать из сохранённых|Remove from saved
Сохранение образца не передаёт скины и не даёт бонусов.|Saving a template does not transfer skins or grant bonuses.
Образец убран из сохранённых.|Template removed from saved.
Образец сохранён на этом устройстве.|Template saved on this device.
Можно сохранить до 30 образцов.|You can save up to 30 templates.
Обнови инвентарь: в этом сете есть недоступные предметы.|Refresh your inventory: some items in this loadout are unavailable.
Активный сет выбран в DMX.|Active DMX loadout selected.
Предметы останутся в твоём инвентаре.|The items will remain in your inventory.
Сет удалён.|Loadout deleted.
Сет сохранён.|Loadout saved.
Укажи название и выбери хотя бы один свой скин.|Enter a name and choose at least one skin you own.
Выбери предметы из своего инвентаря NotGames.|Choose items from your NotGames inventory.
Открой DMX в Telegram, чтобы создавать свои сеты.|Open DMX in Telegram to create loadouts.
Сначала выбери или удали один из 20 сохранённых сетов.|Select or delete one of your 20 saved loadouts first.
По этой ссылке можно посмотреть сет и сохранить его как образец. Она не подтверждает владение скинами.|This link lets others view the loadout and save it as a template. It does not prove skin ownership.
Ссылка|Link
Скопировать ссылку|Copy link
Ссылка скопирована.|Link copied.
Выделил ссылку — скопируй её вручную.|Link selected — copy it manually.
Снять публикацию|Unpublish
Убрано из локальной ленты. Уже отправленные ссылки остаются образцами.|Removed from the local feed. Shared links remain templates.
Ссылка на сет повреждена или несовместима.|The loadout link is invalid or incompatible.
Твоё имя в DMX|Your DMX name
Сохраняется в твоём профиле.|Saved to your profile.
Сохранится на этом устройстве.|Saved on this device.
Введи имя.|Enter a name.
Имя сохранено.|Name saved.
Укажите имя до 24 символов.|Enter a name of up to 24 characters.
Открой DMX через Telegram.|Open DMX in Telegram.
Профиль ещё загружается.|Your profile is still loading.
Войди через Telegram для сохранения профиля.|Sign in through Telegram to save your profile.
Укажи ID, чтобы связать игру с Telegram|Enter your UID to link the game to Telegram
Игровой ID|Game UID
Привязать ID|Link UID
Отключить ID|Unlink UID
Связан с Telegram|Linked to Telegram
Ищем по игровому ID|Searching by game UID
Пока не найден|Not found yet
Твой игровой профиль|Your game profile
Введи игровой ID. Найдём ник и клан, затем свяжем профиль с твоим Telegram.|Enter your game UID. We will find your name and clan and link the profile to Telegram.
Вклад за одну битву|Contribution per battle
Учтено после начала наблюдения|Tracked since observation began
Карты клана|Clan maps
Сейчас во владении|Currently owned
Карты с вкладом|Maps with contribution
От 1 000 очков на карте|1,000+ points on a map
Обновить вклад|Refresh contribution
Привязка игрового ID|Link game UID
Найди свой профиль|Find your profile
ID игрока|Player UID
ID из профиля игры|UID from your game profile
Найти игрока|Find player
Твой Telegram ID:|Your Telegram ID:
Ник и очки получим из таблицы игры. Один игровой ID — один Telegram. У одного Telegram-аккаунта — один игровой ID.|Your nickname and points come from the game leaderboard. Each game UID is linked to one Telegram account; each Telegram account can link one game UID.
Введи полный ID игрока.|Enter your complete player UID.
Введите полный ID игрока из профиля pw.game.|Enter your complete player UID from your pw.game profile.
Ищем ID в таблице игры…|Looking up your UID on the game leaderboard…
Проверяем таблицы игры. Это может занять некоторое время.|Checking game leaderboards. This may take a moment.
Поиск ещё идёт. Попробуй найти игрока снова через минуту.|The search is still running. Try again in a minute.
Этот ID пока не найден в игре. Проверь ID или сыграй матч, затем повтори поиск.|This UID was not found. Check it or play a match, then search again.
Не удалось загрузить таблицу игры. Попробуй ещё раз.|Could not load the game leaderboard. Try again.
Подтвердить привязку|Confirm link
Игрок найден|Player found
Привязать к Telegram|Link to Telegram
Игровой ID привязан к Telegram.|Game UID linked to Telegram.
Подключить|Connect
Подтвердить|Confirm
Связать этот игровой профиль с твоим Telegram ID|Link this game profile to your Telegram ID
Связать профиль|Link profile
Другой ID|Another UID
Уточняется|Checking
Игровой профиль подключён.|Game profile linked.
Отключить|Unlink
Сеты и $DMX сохранятся. Этот ID останется закреплён за твоим Telegram-аккаунтом: его можно подключить снова только здесь.|Your loadouts and $DMX will remain. This UID stays reserved for your Telegram account and can only be reconnected here.
Игровой ID отключён.|Game UID unlinked.
Остров клана|Clan island
Будущий дом твоего клана.|Your clan’s future home.
Подключим остров, когда он появится в Pixel World.|We will connect the island when it becomes available in Pixel World.
Здесь появится остров, когда функция станет доступна в игре.|Your island will appear here when the game adds this feature.
ЭКОНОМИКА DMX|DMX ECONOMY
За что получаем $DMX|How to earn $DMX
Лестницы каждой битвы каждой карты открыты всем пользователям DMX. Награды начисляются автоматически.|Every DMX user can earn on every map and battle. Rewards are credited automatically.
Получение наград готовится к запуску.|Reward payments are being prepared for launch.
DMX — внутренние очки приложения. Личный и клановый рейтинг накопительный, без сезонов.|DMX are in-app points. Player and clan rankings accumulate over time without seasons.
Лестница каждой карты|Per-map reward ladder
1 000 / 2 000 / 3 000 личных очков за одну битву дают 10 / 25 / 50 $DMX суммарно. Доплаты без сета: 10 + 15 + 25. На каждой карте отдельный прогресс. В новой битве той же карты цели начинаются заново; дневного лимита и сброса нет.|1,000 / 2,000 / 3,000 personal points in one battle earn cumulative totals of 10 / 25 / 50 $DMX. Base increments: 10 + 15 + 25. Each map has independent progress. A new battle on the same map starts a new ladder; there is no daily cap or reset.
Начисляем сразу после подтверждения цели, без кнопки получения и ожидания окончания битвы. Если впервые подтверждено сразу 3 000 очков, выдаём всю лестницу одной выплатой. Повторная проверка той же ступени не платит второй раз.|Rewards are credited as soon as a goal is verified. No claim button or wait for the battle to end. If 3,000 points are verified at once, the entire ladder is credited in one payment. Checking the same milestone again never pays twice.
Бонус надетого сета|Equipped loadout bonus
Каждый свой надетый скин: +10%, максимум +50%. Проверяем свой инвентарь при начислении, округляем суммарную награду вниз. Полный сет: 15 / 37 / 75 $DMX, доплаты 15 + 22 + 38. Ранее начисленное сохраняется при смене сета.|Each equipped skin you own adds +10%, up to +50%. Ownership is checked at payment time and the cumulative reward is rounded down. A full loadout gives 15 / 37 / 75 $DMX, in increments of 15 + 22 + 38. Changing your loadout does not remove previous rewards.
Сколько можно получить|How much you can earn
За N полностью выполненных битв карт: 50 × N без бонуса или 75 × N с полным сетом. Три битвы: 150 / 225; десять битв: 500 / 750 $DMX. Прежний расчёт 1 265 DMX в неделю больше не является пределом: он предполагал одну лестницу в день.|For N completed map battles: 50 × N without a bonus or 75 × N with a full loadout. Three battles: 150 / 225; ten battles: 500 / 750 $DMX. The old 1,265 DMX weekly estimate assumed one daily ladder and is no longer a limit.
Подтверждение очков|Verifying points
Считаем безопасно наблюдаемый личный вклад после подключения. Общий счёт клана и прошлые очки не заменяют твой результат. При пропусках, пересечении битв или недоступном источнике ждём подтверждения. Если не удалось проверить инвентарь, начисление повторим автоматически.|Only safely observed personal contribution after connecting counts. Clan totals and older points do not replace your own result. Gaps, overlapping battles or unavailable data wait for verification. If inventory verification fails, payment is retried automatically.
Следующие этапы — план|Planned next stages
Дополнительные ежедневные, недельные, командные цели, медали и фонды пока не оплачиваются. Все условия доступны в заданиях; суммы этих целей можно корректировать. Бонус сета для них ещё не утверждён.|Additional daily, weekly and team goals, medals and funds are not paid yet. Their conditions are listed in Quests and reward amounts can still change. Loadout bonuses for these goals have not been approved.
Победа на карте — план|Planned map victory rewards
Топ-10 участников DMX победившего клана по личному вкладу. Рабочий порог вклада — 1 000. Условия 10 000 очков клана больше нет. Фиксированная награда каждому зависит от карты:|The top 10 DMX members of the winning clan by personal contribution. Proposed minimum contribution: 1,000. There is no 10,000 clan-point requirement. Each player’s fixed reward depends on the map:
План награды каждому|Planned reward per player
Контроль территорий — план|Planned territory control
Владение картами на конец дня: одна высшая ступень фонда. Делим между максимум десятью участниками DMX с подтверждённым положительным вкладом за день. При равенстве — стабильный порядок участников.|End-of-day map ownership determines the highest eligible fund tier. The fund is split between up to ten DMX members with verified positive daily contribution. Ties use a stable player order.
Фонд клана|Clan fund
По 2 получателя|Split between 2
По 10 получателей|Split between 10
6 и больше|6 or more
Округление долей сохраняет бюджет: фонд 1 000 на троих — 334 / 333 / 333.|Rounding preserves the fund total: 1,000 split between three players gives 334 / 333 / 333.
Обновлённые цели — план|Updated planned goals
«Два фронта»: ротация по 1 000 / 2 000 / 3 000 на двух картах → 10 / 15 / 25. Недельный маршрут: по 1 000 на 5 / 10 картах → 100 / 250 суммарно. За 10 000 очков за неделю — 250.|Two Fronts: rotating targets of 1,000 / 2,000 / 3,000 on two maps earn 10 / 15 / 25. Weekly Route: 1,000 on 5 / 10 maps earns cumulative totals of 100 / 250. Earning 10,000 weekly points rewards 250.
Захват или защита: победа при вкладе от 1 000 → 10 $DMX за каждую битву карты. Статистика захватов и защит сохраняется в профиле. Четыре прежние медали и два дневных бонуса объединены без двойной оплаты.|Capture or defense: a win with 1,000+ contribution earns 10 $DMX per map battle. All map wins share one profile counter. Four former medals and two daily bonuses are combined without duplicate payments.
Пять оставшихся медалей пока обсуждаем: сумма первых бонусов 1 100 $DMX.|Five remaining medals are under review. Proposed first-time bonuses total 1,100 $DMX.
Все задания и полные правила|All quests and full rules
Коробки|Boxes
Панелька|Panel House
Город|City
Тихий этаж|Silent Floor
Джунгли|Jungle
Средневековье|Medieval
Затерянный город|Lost City
Улица победы|Victory Street
Летающий корабль|Flying Ship
Дворец|Palace
К оружию|To Arms
Боевой вклад|Battle Contribution
Ударная сила|Striking Force
Два фронта|Two Fronts
Недельный маршрут|Weekly Route
Большой вклад|Major Contribution
Победа на карте|Map Victory
Захват / защита|Capture / Defense
Покоритель карт|Map Conqueror
Ветеран войны|War Veteran
Знаменосец|Standard Bearer
Герой клана|Clan Hero
Превзойти себя|Personal Best
Весь мир|Whole World
Нет подключения к интернету. Попробуй после восстановления связи.|No internet connection. Try again when you are online.
Ответ задерживается. Попробуй ещё раз.|The response is taking too long. Please try again.
Не удалось связаться с DMX. Попробуй ещё раз.|Could not connect to DMX. Please try again.
Сервер временно недоступен. Попробуй ещё раз.|Server temporarily unavailable. Please try again.
Подключение недоступно.|Connection unavailable.
Не удалось загрузить скины|Could not load skins
Проверь соединение и попробуй ещё раз.|Check your connection and try again.
Повторить загрузку|Retry loading
Не удалось проверить скины.|Could not verify skins.
Не удалось обновить NotGames. Попробуйте ещё раз.|Could not update NotGames. Please try again.
Откройте DMX в Telegram-боте.|Open DMX from the Telegram bot.
Неверная Telegram-сессия.|Invalid Telegram session.
Telegram-сессия истекла. Перезапустите миниапп.|Your Telegram session has expired. Reopen the mini app.
Неверный пользователь Telegram.|Invalid Telegram user.
Источник данных недоступен. Повторите обновление.|Data source unavailable. Please try again.
Источник занят. Повторите через несколько секунд.|Data source busy. Try again in a few seconds.
Источник не ответил вовремя. Повторите обновление.|Data source timed out. Please try again.
Начисление ждёт проверки игровых данных и своего инвентаря. Повторим автоматически; повторной выплаты не будет.|Payment is waiting for game data and inventory verification. We will retry automatically without duplicate payments.
Начисление ждёт проверки инвентаря. Повторим автоматически.|Payment is waiting for inventory verification. We will retry automatically.
Сначала привяжи игровой ID.|Link your game UID first.
Сначала привяжи игровой ID в профиле.|Link your game UID in Profile first.
Привязка изменилась.|The linked account has changed.
Профиль не найден.|Profile not found.
Укажите название сета и выберите свои скины.|Name your loadout and choose skins you own.
Выберите предметы для пяти игровых слотов.|Choose items for the five equipment slots.
Надеть можно только свои скины из NotGames. Обновите инвентарь.|You can only equip skins you own in NotGames. Refresh your inventory.
Неверный игровой слот или скин.|Invalid equipment slot or skin.
Один предмет нельзя надеть дважды.|An item cannot be equipped twice.
Некорректный образец сета.|Invalid loadout template.
Некорректный предмет в образце.|Invalid template item.
Некорректное изображение предмета.|Invalid item image.
В образце может быть до пяти предметов.|A template can contain up to five items.
Некорректный клан.|Invalid clan.
Выбери русский или английский язык.|Choose Russian or English.
Укажи режим приватности профиля.|Choose your profile privacy setting.
Игра вернула данные другого ID.|The game returned data for a different UID.
Дождись, пока игра найдёт ID и ник.|Wait for the game UID and nickname to be found.
За этим Telegram-аккаунтом уже закреплён другой игровой ID.|Another game UID is already reserved for this Telegram account.
Этот игровой ID уже закреплён за другим Telegram-аккаунтом.|This game UID is already reserved for another Telegram account.
Привязка игрового ID изменилась. Обнови профиль.|Your linked game UID changed. Reload your profile.
Игровой профиль не подключён.|Game profile not connected.
Не удалось прочитать сохранение. Приложение открыто без него.|Could not read saved data. The app opened without it.
Хранилище браузера недоступно: изменения останутся только до закрытия.|Browser storage is unavailable. Changes will last only until the app is closed.
Откройте DMX в Telegram и обновите инвентарь NotGames в профиле.|Open DMX in Telegram and refresh your NotGames inventory.
Не удалось выполнить действие.|Could not complete the action.
Не удалось обновить битвы.|Could not refresh battles.
Не удалось подтвердить строку игрока в таблице игры.|Could not verify this player on the game leaderboard.
Не удалось подтвердить участника клана по игровому ID.|Could not verify clan membership using this game UID.
Pixel World временно недоступен.|Pixel World temporarily unavailable.
Инвентарь NotGames временно недоступен.|NotGames inventory temporarily unavailable.
Участник DMX|DMX player
Учтён новый вклад с начала наблюдения.|New contribution tracked since observation began.
Осталось|Remaining
Наблюдение с|Observed since
Учтено|Tracked
Набери|Earn
суммарно|total
очков|points
очки|points
картах|maps
карте|map
карт|maps
карта|map
скинов|skins
сетов|loadouts
моделей|models
коллекций|collections
участников в DMX|DMX members
участников DMX|DMX members
клановой войны|clan war
сейчас|now
битв|battles
битва|battle
место|rank
осталось|remaining
за выполнение целей|for completing goals
при личном вкладе от|with personal contribution of
сет|loadout
каталог|catalogue
пример DMX Studio|DMX Studio example
образец сета|loadout template
Фото|Photo
осмотреть|inspect
выбрать скин|select skin
Убрать:|Remove:
Удалить|Delete
из данных игры|from game data
Ещё|Another
очков без подтверждения карты.|points without a confirmed map.
ещё|remaining
`.trim().split('\n').map(line=>{const p=line.indexOf('|');return [line.slice(0,p),line.slice(p+1)];}));
 for(const [ru,en] of Object.entries({...dictionary}))if(/[А-Яа-яЁё]/.test(ru))dictionary[ru.toUpperCase()]=en.toUpperCase();
 const keys=Object.keys(dictionary).sort((a,b)=>b.length-a.length);
 const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const substitutions=keys.map(key=>[new RegExp((/^[А-Яа-яЁёA-Za-z]/.test(key)?'(?<![А-Яа-яЁёA-Za-z])':'')+escape(key)+(/[А-Яа-яЁёA-Za-z]$/.test(key)?'(?![А-Яа-яЁёA-Za-z])':''),'g'),dictionary[key]]);
 const detected=window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code||navigator.language||'';
 let language=/^ru(?:[-_]|$)/i.test(detected)?'ru':'en';try{const saved=localStorage.getItem('dmx.language.v1');if(localStorage.getItem('dmx.language.explicit.v1')==='1'&&['ru','en'].includes(saved))language=saved;}catch{}
 const originals=new WeakMap(),attributes=new WeakMap();
 const skip='script,style,textarea,[data-i18n-skip],.market-profile-banner h1,.clan-profile-heading h1,.profile-clan-link,.profile-photo,.clan-avatar,.skin-detail-hero h2,.skin-detail-hero>p,.skin-card-copy>b,.skin-card-copy>small,.profile-skin-name';
 function t(value){
  if(language!=='en'||typeof value!=='string'||!/[А-Яа-яЁё]/.test(value))return value;
  const trim=value.trim();if(dictionary[trim])return value.replace(trim,dictionary[trim]);
  let result=value;for(const [pattern,replacement] of substitutions)result=result.replace(pattern,replacement);
  return result;
 }
 let applying=false;
 function apply(root=document.body){
  if(!root||applying)return;applying=true;
  try{
   document.documentElement.lang=language;document.title='DMX Arena';
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
   while(node=walker.nextNode()){
    if(node.parentElement?.closest(skip))continue;
    const old=originals.get(node),source=old&&node.nodeValue===old.output?old.source:node.nodeValue,output=old?.language===language&&old.source===source?old.output:t(source);
    if(output!==node.nodeValue)node.nodeValue=output;
    originals.set(node,{source,output,language});
   }
   for(const element of root.querySelectorAll('[aria-label],[placeholder],[title],[alt]'))for(const attribute of ['aria-label','placeholder','title','alt']){
    if(!element.hasAttribute(attribute))continue;
    const map=attributes.get(element)||{},value=element.getAttribute(attribute),old=map[attribute],source=old&&value===old.output?old.source:value,output=t(source);
    if(output!==value)element.setAttribute(attribute,output);map[attribute]={source,output};attributes.set(element,map);
   }
   for(const link of root.querySelectorAll('a[href^="economy-review"]'))link.href=language==='en'?'economy-review.en.md':'economy-review.md';
  }finally{applying=false;}
 }
 function setLanguage(value,persist=true){language=value==='ru'?'ru':'en';if(persist)try{localStorage.setItem('dmx.language.v1',language);localStorage.setItem('dmx.language.explicit.v1','1');}catch{}apply();}
 window.DMXI18n={get language(){return language;},locale:()=>language==='en'?'en-US':'ru-RU',t,apply,setLanguage};
 const observer=new MutationObserver(()=>{if(!applying)apply();});
 function start(){apply();observer.observe(document.body,{childList:true,subtree:true,characterData:true});}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();

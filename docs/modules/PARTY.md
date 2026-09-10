# Party (SOC-02)

## Статус

Persistent party (create/invite/join/kick/leave/disband, leadership, settings,
search, party chat) реализован на raw-AMF и PostgreSQL. CEF окна группы не
прогонялся — product-status **готово** не ставить. Точный product-status:
[CAPABILITIES.md](../CAPABILITIES.md).

Bag give/drop, grouploot, fight HELP/JOIN — [SOC-03](../migration/ROADMAP.md).
Dungeon auto-create / bind warning / teleport on kick — не в срезе (инстансов
нет).

## Источники поведения

- `jgr-emu/docs/PARTY.md`;
- `jgr-emu/src/party/` (`index.ts`, `membership.ts`, `wire.ts`, `chat.ts`,
  `dispatch.ts`). Bag/loot/help файлы — SOC-03.

## Architecture decision

Отдельный `ARC-SOC` не нужен. Party — модуль `party` (`src/modules/party`), не
target `social`. Таблицы `party.parties` / `party_members` / `party_invites`.
`party_bag_items` **не** создаётся. Пустой `party|bag`
`{status:100, artikuls:[], types:[]}` на create/confirm/init — dump chrome
wire, не bag engine.

Владение:

- `party` держит membership, invites, settings и serial lock;
- `jugger-wire` владеет OA `party|*` и esrv каналами;
- composition `PartyDesk` читает character/catalog/session ports, кладёт кадры
  в outbox **после** commit;
- combat и chat **не** пишут party-таблицы. `ChatDesk` читает roster-port
  для `chat|add` type `party`.

Мутации состава — одна Drizzle UoW, `FOR UPDATE` строки `parties`, unique
`party_members.hero_id`. Два одновременных confirm в полную группу: один
вступает, второй nested **2** `группа полна`.

## Каналы

| Prefix          | Роль                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------- |
| `2:<accountId>` | invite/`join_confirm` `common\|window`, kick empty `party\|members`, personal system chat |
| `4:<partyId>`   | members, settings, empty bag, party system + player `chat\|add` type `party`              |

`EsrvOutbox.enqueue(accountId, fragment, channel?)`. `__channel` в AMF не
утекает. Lone `chat|message` по-прежнему отдельный MULTI кадр (SOC-01).

Party id = PostgreSQL identity с **1**. Wire integer `1..2_147_483_647`.
Канал `4:<partyId>`.

`MAX_PARTY_MEMBERS = 5`.

## OA

Dump `fail()` — nested **2** `{status:2, error}` под ключом команды (как store
buy / private chat). Не 203, кроме неизвестного `party|*`.

| OA                                     | Поведение                                                                                                                                                                                                                              |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `party\|create`                        | Уже в группе → `Вы уже находитесь в группе!`. Insert party+leader. HTTP: create 100, members, settings, empty bag, `state.party=1`. Push members+settings на `4:`. Create всегда `loot_rules="1"`, `no_chat=0` (dump).                 |
| `party\|invite` `{nick}`               | Auto-create если нет группы. Только лидер. Цель online (session). Self / full / already in party — 2. Без dungeon bind warning. Invite + `common\|window` на `2:` цели. Personal «Вы пригласили [[USER]] в группу.»                    |
| `party\|confirm_invite` `{party}`      | Invite обязателен. Join + members/settings/empty bag на `4:` + chatJoin.                                                                                                                                                               |
| `party\|decline_invite` `{party}`      | Нет invite — всё равно 100. Personal лидеру «отказался».                                                                                                                                                                               |
| `party\|kick` `{nick}`                 | Лидер; не себя. Empty members + state на **personal `2:`**. Chat на `4:` + personal kicked.                                                                                                                                            |
| `party\|leave`                         | Не в группе → 100. Лидер leave → disband. Иначе empty members на HTTP + `2:`.                                                                                                                                                          |
| `party\|disband`                       | Лидер; иначе `Не удалось расформировать группу!`. Не в группе → 100. Empty members+bag+state всем на `2:`. Chat на `4:` до delete.                                                                                                     |
| `party\|change_leader` `{nick}`        | Лидер. Цель level **≥** лидера; ниже → 2 level error. Равный уровень — ок.                                                                                                                                                             |
| `party\|save_settings`                 | `form`: `loot_rules`/`no_chat`; **root**: `is_search`, `instance_artikul_id`, `password`, `kill_all`, `join_confirm`, `type` (AS3 `PartyCreateParameters`). Смена 2/3 → party chat rename. Bag-lock правил — SOC-03 (bag всегда пуст). |
| `party\|search_list`                   | Nested `{status, list, totalPages, total_pages}`. Только `is_search=1`. Фильтры root: `empty_password`, `kill_all`, `instance_artikul_id`, `page`.                                                                                     |
| `party\|join`                          | Пароль; `join_confirm` → pending + окно лидеру `confirm_join`/`decline_join`. Dungeon bind skip.                                                                                                                                       |
| `party\|confirm_join` / `decline_join` | Лидер принимает/отклоняет search-join.                                                                                                                                                                                                 |
| `party\|members` / `settings` / `bag`  | Nested poll/restore. `bag` — empty chrome.                                                                                                                                                                                             |

`give`/`drop` не регистрируются (SOC-03) → 203 unimplemented.

## Settings dump-optional

Create/save без поля: `password=""`, `instance_artikul_id="0"`,
`bot_artikul_id="0"`, `type="0"`, `is_search=0`, `flags=0`. Это dump-optional
именованные правила, не маскировка обязательных данных. `"0"` у instance — тот
же wire-ноль, что `instance_id=0` в [ID_POLICY.md](../architecture/ID_POLICY.md).

`flags`: `kill_all=2`, `join_confirm=4`. `distribute_ready_at` пишется при
kick/leave (`now+6s`, dump cooldown); читает SOC-03.

## Member wire

`id` / `user_id` / `member_id` = **accountId**. `is_party_leader: 1` только у
лидера. `avatar` из catalog `appearance` (`avatarSmall` обязателен).
`language` = `hero.language` (без `"ru"` fallback). `dead: 4` если ghost.
`instance_id: 0`. Dump-proven нули среза без кланов/jail: `clan_id`,
`gag_time`, `juggernaut`, `punish`, `server_id: 1`.

## Chat

Player `chat|add` type `party`: если есть membership — fan-out остальным на
`4:`; иначе echo-only (dump). `no_chat` на player chat сервер не гейтит (dump
`chat.ts` не проверяет). System invite/join/kick/disband/rules — dump
`party/chat.ts`. `excluded_user_id` на join/kick party-строках.

## Restore

`state.party` 0\|1 из membership (не hardcoded 0). `common|init2` при членстве
добавляет `party|members` / `settings` / empty `party|bag`. Reconnect/restart
читает PostgreSQL. Недоставленный esrv кадр процесс теряет.

## Вне среза

Dungeon bind warning (`__force_bind_invite`), search-join bind, teleport on
kick, bag TTL, HELP/JOIN, `fight|grouploot`.

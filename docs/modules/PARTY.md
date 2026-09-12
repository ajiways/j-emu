# Party (SOC-02 / SOC-03)

## Статус

Persistent party, bag give/drop, outdoor loot rules 1–3, `fight|grouploot` и
same-area `FIGHT_JOIN` / `FIGHT_HELP` реализованы на raw-AMF и PostgreSQL.
CEF окна группы не прогонялся — product-status **готово** не ставить. Точный
product-status: [CAPABILITIES.md](../CAPABILITIES.md).

Dungeon auto-create / bind warning / teleport on kick, dungeon lottery rules 1,
quest `personal_only` loot — не в срезе. Hunt join team 2 — CMB-11.

## Источники поведения

- `jgr-emu/docs/PARTY.md`, `FIGHT_LOOT.md`, `FIGHT_JOIN.md`;
- `jgr-emu/src/party/` (`index.ts`, `membership.ts`, `wire.ts`, `chat.ts`,
  `dispatch.ts`, `bag.ts`, `loot.ts`, `help.ts`);
- `jgr-emu/src/routes/oa/commonObject.ts` (`FIGHT_JOIN` / `FIGHT_HELP`),
  `helpers.ts` `helpFightError`.

## Architecture decision

Отдельный `ARC-SOC` не нужен. ADR-0017–0020 достаточны: active fight остаётся
RAM; party bag — PostgreSQL. Модуль `party` (`src/modules/party`), не target
`social`. Таблицы `party.parties` / `party_members` / `party_invites` /
`party_bag_items`.

Владение:

- `party` держит membership, invites, settings, bag rows и serial lock;
- `inventory` выдаёт экземпляры только через `grantToBag` / `canFitBag`;
- `combat` не импортирует party. `HuntFightSettlement` читает
  `FightLootRouting` и пишет bag через `PartyBagDeposit` — оба порта
  внедряет composition;
- `jugger-wire` владеет OA `party|*`, `common|object:FIGHT_JOIN` /
  `FIGHT_HELP` и esrv каналами;
- composition `PartyDesk` / `PartyBagOps` кладёт кадры в outbox **после**
  commit.

Мутации состава и bag — одна Drizzle UoW, `FOR UPDATE` строки `parties`.
Give берёт bag row `FOR UPDATE`. Два одновременных give одного id: один
забирает, второй nested **2** `предмет не найден`.

Disband с непустым bag: grant лидеру в той же UoW; полный рюкзак лидера →
**2** `У персонажа не хватит места в рюкзаке!`, группа не удаляется. Это
fail-fast вместо dump-частичного dumpBag (пропуск failed grant).

## Каналы

| Prefix          | Роль                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------ |
| `2:<accountId>` | invite/`join_confirm` `common\|window`, kick empty members, personal system, `user\|bag`   |
| `4:<partyId>`   | members, settings, bag, `fight\|grouploot`, party system + player `chat\|add` type `party` |

`EsrvOutbox.enqueue(accountId, fragment, channel?)`. `__channel` в AMF не
утекает.

Party id = PostgreSQL identity с **1**. Wire integer `1..2_147_483_647`.
Канал `4:<partyId>`. Bag item id — тот же identity, ключ `party|give` `items`.

`MAX_PARTY_MEMBERS = 5`. `BAG_TTL_SEC = 3h`. `DISTRIBUTE_COOLDOWN_SEC = 6`.
`LOTTERY_CHAT_GAP_MS = 450`. `LOTTERY_REROLL_CAP = 20`.

## OA

Dump `fail()` — nested **2** `{status:2, error}` под ключом команды. Не 203,
кроме неизвестного `party|*`.

| OA                                     | Поведение                                                                                                                                                                                                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `party\|create`                        | Уже в группе → `Вы уже находитесь в группе!`. Insert party+leader. HTTP: create 100, members, settings, empty bag, `state.party=1`. Push members+settings на `4:`. Create всегда `loot_rules="1"`, `no_chat=0` (dump).                                      |
| `party\|invite` `{nick}`               | Auto-create если нет группы. Только лидер. Цель online (session). Self / full / already in party — 2. Без dungeon bind warning. Invite + `common\|window` на `2:` цели. Personal «Вы пригласили [[USER]] в группу.»                                         |
| `party\|confirm_invite` `{party}`      | Invite обязателен. Join + members/settings/bag на `4:` + chatJoin.                                                                                                                                                                                          |
| `party\|decline_invite` `{party}`      | Нет invite — всё равно 100. Personal лидеру «отказался».                                                                                                                                                                                                    |
| `party\|kick` `{nick}`                 | Лидер; не себя. Empty members + state на **personal `2:`**. Chat на `4:` + personal kicked.                                                                                                                                                                 |
| `party\|leave`                         | Не в группе → 100. Лидер leave → disband (bag → лидер). Иначе empty members на HTTP + `2:`.                                                                                                                                                                 |
| `party\|disband`                       | Лидер; иначе `Не удалось расформировать группу!`. Не в группе → 100. Bag → лидер. Empty members+bag+state всем на `2:`. Chat на `4:` до delete.                                                                                                             |
| `party\|change_leader` `{nick}`        | Лидер. Цель level **≥** лидера; ниже → 2 level error. Равный уровень — ок.                                                                                                                                                                                  |
| `party\|save_settings`                 | `form`: `loot_rules`/`no_chat`; **root**: `is_search`, `instance_artikul_id`, `password`, `kill_all`, `join_confirm`, `type`. Смена 2/3 → party chat rename. Непустой bag + смена `loot_rules` → 2 `нельзя сменить правила при непустом групповом рюкзаке`. |
| `party\|search_list`                   | Nested `{status, list, totalPages, total_pages}`. Только `is_search=1`.                                                                                                                                                                                     |
| `party\|join`                          | Пароль; `join_confirm` → pending + окно лидеру.                                                                                                                                                                                                             |
| `party\|confirm_join` / `decline_join` | Лидер принимает/отклоняет search-join.                                                                                                                                                                                                                      |
| `party\|members` / `settings` / `bag`  | Nested poll/restore. `bag` purge TTL, затем payload.                                                                                                                                                                                                        |
| `party\|give` `{items, nick}`          | Лидер. `items` — map bag-instance-id → qty. `nick` string — прямой give; `nick[]` — жребий 1…100 на единицу. Cooldown `distribute_ready_at`. Нет места → 2. Party chat «передал вещи» + personal «Вам переданы вещи…» + `user\|bag` получателю.             |
| `party\|drop` `{items}`                | Лидер. Удаляет qty из bag row. Push `party\|bag` на `4:`.                                                                                                                                                                                                   |

## HELP / JOIN

`common|action` `FIGHT_JOIN` `{fight, team}` и `FIGHT_HELP` `{nick}` — как
`ATTACK_BOT` flat: `common|action` 100, `fight|conf`, `common|hunt`,
`user|unitframe`, `state`. Hunt join **team 1|2** (CMB-11). HELP ставит
joiner на **ту же team**, что у цели в RAM бою. Карта `ATTACK_BOT` на
занятый spawn — по-прежнему team **1**. Чужой area **или** чужая instance
copy → тот же dump 204 «другой локации». Team 2 **не** маскировать под
«неактивный бой».

Уже в бою → **203** `нельзя во время боя`. Остальные dump `helpFightError`:

| Case                | Status | Text                                                    |
| ------------------- | ------ | ------------------------------------------------------- |
| Other area / copy   | 204    | «Нельзя вмешаться в бой, находящийся в другой локации!» |
| Target not fighting | 204    | «Данный игрок сейчас не участвует в боях!»              |
| Stale / missing     | 204    | «Нельзя вмешаться в неактивный бой!»                    |

Party HELP announce: при старте боя, если в группе ≥2, system на `4:` с ACTION
`ПОМОЧЬ` → `FIGHT_JOIN` `{fight, team:1}`, `excluded_user_id` стартера
(opener охоты всегда team 1). Это не FIGHT_HELP по нику.

## Loot rules (outdoor hunt)

Composition после CMB-03 roll: XP всегда personal. Quest/dungeon collectors
не в срезе.

| `loot_rules` | Поведение                                                                                                                                                                       |
| -----------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|        `"1"` | Предметы top damager-у в личный bag (как solo). Деньги: один party-боец — top damager; ≥2 party-бойца в этом бою — поровну minor. Chat «Вашей группой найдено: MONEY».          |
|        `"2"` | World items → `party_bag_items` (`remove_time=now+3h`) + `party\|bag` `newloot:1` + `fight\|grouploot` на `4:`. Личный `fight\|loot` без этих items. Leader `give` string nick. |
|        `"3"` | Как 2; `give` с `nick[]` — per unit roll 1…100, chat paced 450ms (`выбросил` / `Ничья! Переброс.` / `победил`). Один eligible — без жребия, default «передал вещи».             |

Friendly practice не роутится. Party покрывает ≥1 бойца этой группы; чужой
союзник в том же бою не входит в `partyHeroes`.

## Bag TTL (3h)

Purge `remove_time <= now` на bag access (OA bag / give / drop / loot deposit /
restore). Push обновлённый `party|bag`. Give/drop на пропавший id → 2
`предмет не найден`.

## Settings dump-optional

Create/save без поля: `password=""`, `instance_artikul_id="0"`,
`bot_artikul_id="0"`, `type="0"`, `is_search=0`, `flags=0`. `"0"` у instance —
тот же wire-ноль, что `instance_id=0` в [ID_POLICY.md](../architecture/ID_POLICY.md).

Bag artikul chrome без catalog description/quality: `description=""`,
`quality:"0"` — dump-optional нули, не маскировка обязательного id/title.

`flags`: `kill_all=2`, `join_confirm=4`. `distribute_ready_at` пишется при
kick/leave (`now+6s`); give при `now < ready` → 2 `подождите перед раздачей`.

## Member wire

`id` / `user_id` / `member_id` = **accountId**. `is_party_leader: 1` только у
лидера. `avatar` из catalog `appearance` (`avatarSmall` обязателен).
`language` = `hero.language`. `dead: 4` если ghost. `instance_id: 0`.
Dump-proven нули среза без кланов/jail: `clan_id`, `gag_time`, `juggernaut`,
`punish`, `server_id: 1`.

## Chat

Player `chat|add` type `party`: membership → fan-out на `4:`; иначе echo-only.
`no_chat` player chat не гейтит. System invite/join/kick/disband/rules/give/
lottery/group loot/HELP — dump `party/chat.ts`.

## Restore

`state.party` 0\|1 из membership. `common|init2` при членстве добавляет
`party|members` / `settings` / `party|bag` (после TTL purge). Reconnect/restart
читает PostgreSQL. Недоставленный esrv кадр процесс теряет.

## Вне среза

Dungeon bind warning (`__force_bind_invite`), search-join bind, teleport on
kick, dungeon rules-1 lottery, quest personal_only. Одновременные две дуэли
после intervene — leftover CMB-11.

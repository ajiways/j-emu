# Chat (SOC-01)

## Статус

Area/private/system чат реализован на raw-AMF. CEF окна чата не прогонялся —
product-status **готово** не ставить. Точный product-status:
[CAPABILITIES.md](../CAPABILITIES.md).

Party `4:` — [SOC-02](../migration/ROADMAP.md) / [PARTY.md](PARTY.md). Кланы/альянс не в срезе. One-fight
TEMPEFFECT expiry chat не в срезе: inventory не purge'ит `flags_ext & 256` на
finish. Quest/farm assistant announce не в срезе.

## Источники поведения

- `jgr-emu/docs/CHAT.md`;
- `jgr-emu/src/chat.ts`, `chatMacros.ts`, `emotions.ts`, `fight/lootNotify.ts`;
- dump stub `chat|add` piggyback echo (live ack без echo UI ждёт poll).

## Architecture decision

Отдельный `ARC-SOC` / `ARC-RTM` не нужен. Чат — модуль `chat`
(`src/modules/chat`), не target `social`. Сообщения process-local через уже
существующий `EsrvOutbox` (как RTM-01). Таблиц истории нет. Рестарт процесса
теряет недоставленные кадры.

Владение:

- `chat` держит expand (smiles / FIGHT / USER / ARTIFACT / MONEY / ACTION) и fan-out
  policy;
- `jugger-wire` владеет OA `chat|add` и esrv `chat|message`;
- composition `ChatDesk` читает presence/character/catalog/world/combat ports и
  кладёт кадры в outbox;
- combat **не** импортирует chat. Post-commit notify — обёртка
  `ChatFightSettlement` над `HuntFightSettlement`. Сбой enqueue **не** откатывает
  UoW награды.

Roster area-канала: `listPopulation` (sessions ⨝ `heroes.area_id`), без
отправителя. Instance copy dump не копировать — инстансов нет.

**Решение SOC-01:** `chat|add` echo + `state` на том же OA (dump stub). Fan-out
соседям на `2:` отдельными кадрами: lone `chat|message` не сливается с
`fight|loot`/`trade|session` (live one-message-per-packet).

## Каналы

| type                                       | Кому                                             |
| ------------------------------------------ | ------------------------------------------------ |
| `main`, `trade`, `kind`, `raid`, `capture` | online той же `area_id`, кроме отправителя       |
| `private`                                  | `recipient_list` по нику (case-insensitive)      |
| `party`                                    | membership на `4:<partyId>` (SOC-02); иначе echo |
| `clan` / `alliance` / `party_search`       | echo себе                                        |
| `system`                                   | сервер → account                                 |

Пустой `type` → `main` (dump-optional). `lng` с формы, иначе `hero.language`
(обязателен). `from_level` на всех player-строках = `hero.level` (kind /
party_search рисуют `Nick[level]`).

Пустой текст → **203** `empty message`. Private без получателей → **203**
`no recipient`. Private, ник не в `heroes` → nested **2**
`Пользователь не найден!` (как store buy; не `ProtocolError`).

`/emo` на неизвестный ник цели — sender-only system
`Персонаж «Nick» не найден!`, без fan-out, HTTP 100.

## Макросы

Ключ — тот же `macroKeyId`, что USER/mail. Поле словаря — **`macroses`**, не
`macros_list`.

1. `/emo <code> [nick…]` — dump-stub шаблоны `emotions.ts` (live AMF copy не
   снят). `/emo бой` в активном бою → FIGHT; вне боя → flavor. Нет цели /
   неизвестный код → текст как есть, кроме missing-target tip.
2. В бою `(бой)` / `(fight)` → `[[FIGHT key]]`.
3. `#FIGHT[<digits>]#` → FIGHT. Нет сессии — `fight_title` = `бой<id>`, area
   отправителя (не выдумывать «Горное поселение»).
4. Smile tags из chrome `user|smiles`, **max 3**, longest tag first. Пустой
   каталог среза — no-op, не выдумывать `:happy:`.

FIGHT start/end: `area_id` = numeric area, `area_title` из world (обязателен),
`fight_title` = `Нападение <nick> на <bot>`. Friendly practice — без этих строк.

Лут после UoW: `Окончен бой [[FIGHT]]`, затем `Вами получено: [[ARTIFACT]] N шт.`,
затем `Вы получили: [[MONEY]]. ` (пробел после точки). `fight|loot` по-прежнему
ставит combat pendingLoot, не chat. Death/win break (до «Окончен бой»):
`Вещи потеряли прочность: [[ARTIFACT_ITEM]] (-1), …` — instance snapshot,
прочность уже после −1. Отдельной строки «вещь полностью сломалась» в dump
нет: `0/N` остаётся в той же строке с `durability: 0`; finite `1/1` удаляется
с тем же `(-1)`, текст destroy-чата в dump не пойман. Цвет ссылки рисует
клиент (`OldMacroArtifact`): `0` красный, `1–2` оранжевый, иначе коричневый.
CEF leftover.

Trade confirm: инициатору system `Пользователь [[USER]] согласился торговать с Вами.`

## OA

Успех Flat: `{ chat|add: {status:100}, chat|message: echo, state }`.

| OA          | Form                                           | Успех                                      |
| ----------- | ---------------------------------------------- | ------------------------------------------ |
| `chat\|add` | `{message\|msg, type?, recipient_list?, lng?}` | echo `is_self`; area/private — esrv другим |

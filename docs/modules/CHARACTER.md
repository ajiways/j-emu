# Character и bootstrap

## Статус

Перенесены auth identity, hero, personal details, starter state и минимальные
init/init2. Полный legacy bootstrap и character progression ещё не перенесены.
Точный статус: [CAPABILITIES.md](../CAPABILITIES.md).

## Источники поведения

- `jgr-emu/docs/PROTOCOL.md`;
- `jgr-emu/docs/CHARACTER_STATS.md`;
- `jgr-emu/docs/HP_REGEN.md`;
- `jgr-emu/src/bootstrap.ts`, `heroBuilder.ts`, `gameConfig.ts`, `stats.ts`.

Старые готовые init scenarios переносятся целиком. Отдельный wire research
нужен только при расхождении старого ответа с клиентом или live evidence.

## Контракт

`common|init` и `common|init2` — flat responses. State, bag, pocket, skills,
view, magic, conf, unitframe, personal details, area и другие bootstrap blocks
являются соседями верхнего уровня, а не полями внутри `common|init`.

Hero identity:

- `heroes.id` — numeric PostgreSQL identity и client-visible user ID;
- account/hero создаются через application orchestration;
- starter state приходит из обязательной versioned creation policy;
- отсутствующая policy/content row прерывает создание;
- tutorial отключён только явными persisted
  `finished_first_fight:"1"` и `tutorial2:'{"finished":true}'`.

Player state для core 1–8 включает подтверждённые legacy:

- HP/MP, EXP boundaries, level, money и diamonds;
- kind, skin/body/avatar и equipment-derived view;
- skills и stat recalculation;
- personal details/preferences;
- regeneration timestamps и ghost/injury state, когда соответствующая
  capability переносится.

Game-wide catalog/config не клонируется из `.bin` на запросе. Он импортируется и
читается из active content release.

## Persistence

Account, hero, personal details, skills и persistent progression находятся в
PostgreSQL. Critical mutation выполняется одной orchestration transaction.
Reconnect строит bootstrap из сохранённого state, а не из process cache.

## Порядок переноса

1. Зафиксировать полный legacy init/init2 block inventory.
2. Добавить недостающие character/content schemas и import.
3. Перенести builders как typed read models, не как один монолитный bootstrap.
4. Покрыть raw-AMF cold login и reconnect.
5. Подтвердить HUD, location и отсутствие tutorial lock в клиенте.

## Acceptance

- новый и существующий герой получают одинаково полный bootstrap;
- money/money_gold и numeric/string wire types не перепутаны;
- отсутствующий обязательный block не маскируется пустым `status:100`;
- restart сохраняет character state;
- реальный клиент отображает HUD и location после повторного входа.

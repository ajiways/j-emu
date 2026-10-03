# Quest engine: party progress v1

> **Статус:** normative contract QE-09. Party не владеет общим quest run:
> progress, history, assets, loot и rewards остаются персональными.

## Eligibility snapshot

Для одного domain fact application layer строит locked snapshot:

```ts
type PartyEligibilitySnapshot = Readonly<{
  partyId?: number;
  observedAt: Date;
  members: readonly Readonly<{
    heroId: number;
    areaId: number;
    instanceId?: string;
    online: boolean;
    alive: boolean;
    participated: boolean;
  }>[];
}>;
```

`participated` приходит от owning event (обычно combat), а не вычисляется из
party membership после факта.

## Credit scopes

- `personal`: только actor;
- `same_area`: members в area actor;
- `same_instance`: exact instance/copy;
- `participants`: event participant set.

Filters online/alive/participated применяются дополнительно. Затем для каждого
hero проверяются собственный active run, pinned definition/stage и requirement.

## Locks и fan-out

1. определить candidate hero ids из event + party snapshot;
2. sort unique ids;
3. lock все hero rows ascending;
4. перечитать membership/context;
5. lock personal runs ascending;
6. применить один event id в namespace каждого run;
7. commit все personal transitions одной UoW.

Если atomic multihero UoW становится слишком дорогой, допускается durable
fan-out rows per hero, но тогда event считается полностью delivered только после
всех dispositions и каждый hero получает независимую exactly-once delivery.
Baseline выбирает atomic fan-out для малой party.

## Personal results

- progress может отличаться из-за разных stages/revisions;
- один герой может быть eligible, другой нет;
- quest asset/loot выдаётся каждому отдельным operation key;
- reward claim всегда персональный;
- выход из party после event не откатывает credit;
- присоединение после event не даёт retroactive credit.

## Security

Envelope participant ids не доверяются как authorization. Combat/service owner
предоставляет signed-by-process authoritative fact, router сверяет hero/party/
area/instance state. Клиент не может прислать список получателей.

## Tests

- все scopes и filters;
- разные progress/stage/release участников;
- join/leave concurrent event;
- member moves area/instance;
- duplicate fan-out;
- one hero effect denial rolls back atomic baseline;
- personal loot/reward ids;
- party disband after fact;
- lock order/deadlock stress;
- non-party actor path не дорожает полным party query.

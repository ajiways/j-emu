# ADR-0018: PostgreSQL, content и идентификаторы

- Статус: Accepted
- Дата: 2026-09-08
- Заменяет: ADR-0005, ADR-0010, ADR-0011, ADR-0013, ADR-0016

## Решение

PostgreSQL — единственный изменяемый persistent store. Drizzle ORM описывает
module-owned schemas и обычные queries; `postgres.js` остаётся драйвером.
Raw SQL разрешён только для невыразимой Drizzle операции с причиной и
integration test.

До объявления стабильного baseline migrations можно схлопывать. После baseline
применённый SQL и journal неизменяемы; исправление создаёт новую осмысленно
названную migration.

Authored content проходит:

```text
source corpus → versioned drafts → validated immutable release
              → runtime projections → atomic active release
```

Runtime не читает drafts, old fixtures или source files. Невалидная запись
отменяет candidate целиком; dual-write и частичная публикация запрещены.

Persistent runtime ID выдаёт PostgreSQL:

- обычная identity/sequence начинается с `1`;
- `items.id` начинается с `100_000`, ограничен int32 и `NO CYCLE`;
- numeric `heroes.id` является human fight participant ID;
- fight/result sequence начинается с `1`;
- fight bot ID ephemeral, выдаётся в RAM от `1_000_000` и не сохраняется;
- authored IDs сохраняются из content и не принадлежат runtime sequence.

Ноль на wire запрещён, кроме `answer_id=0` и `instance_id=0`. Старые floors
`1e9`, `920k`, `900001`, `200000`, `10M+hero` и `90000001` не являются
контрактом.

## Канонические детали

- [PERSISTENCE.md](../architecture/PERSISTENCE.md)
- [CONTENT_PIPELINE.md](../architecture/CONTENT_PIPELINE.md)
- [ID_POLICY.md](../architecture/ID_POLICY.md)

## Последствия

- Production memory repositories для persistent state запрещены.
- Content editor в будущем пишет drafts, а не runtime tables/files.
- Restart не переиспользует persistent ID и не меняет active content release.

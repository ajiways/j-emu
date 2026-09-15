# Catalog — operator lookup (EDT-04)

Read-only HTTP JSON for test-console pickers. Not AMF. Same Bearer as
`/operator/content/*` and `/operator/hero/*`.

Runtime projection already has `title` and `picture` on
`catalog.artifacts`. Pub1 PNGs/GIFs are served from `PUB1_DIR` at
`/images/data/artifacts/{picture}` (no auth). Legacy `artikuls.description`
was not decoded into `ArtifactDocument` — this slice does not invent it.

| Method | Path                                  | Success                                               |
| ------ | ------------------------------------- | ----------------------------------------------------- |
| GET    | `/operator/catalog/artifacts?q=`      | `{ artifacts: Brief[] }` (max 20)                     |
| GET    | `/operator/catalog/artifacts?ids=1,2` | `{ artifacts: Brief[] }` (order of ids, skip missing) |
| GET    | `/operator/catalog/artifacts/:id`     | one `Brief`                                           |

`Brief`: `id`, `title`, `picture`, `kindId`, `typeId`.

Substring search is `ILIKE`, not Russian stemming: `мясо` does not match
title `Кусок мяса` (`мяса`). Search `Кусок` or id `77`.

`q` and `ids` together → **400**. Unknown query key → **400**. More than 64
ids → **400**. No/wrong Bearer → **401**. Missing single id → **404**.

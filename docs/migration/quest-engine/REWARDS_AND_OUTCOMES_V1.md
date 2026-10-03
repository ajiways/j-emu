# Quest engine: rewards and outcomes v1

> **Статус:** normative contract QE-06A/QE-07. Reward, branch decision и
> permanent world outcome связаны, но имеют разные identity/lifecycle.

## Named reward package

```ts
type RewardPackage = Readonly<{
  presentation: RichContent;
  effects: readonly EffectRef[];
}>;
```

Reward node задаёт `all` либо `choose_one`. Selection сохраняется до effects.
Operation namespace: run/node/activation/package/effect. Повтор turn-in
возвращает тот же result; другая selection после commit запрещена.

## Atomic outcome bundle

```ts
type OutcomeBundle = Readonly<{
  key: SemanticKey;
  runFacts?: readonly FactMutation[];
  worldFacts?: readonly FactMutation[];
  dispositions?: readonly ActorDispositionMutation[];
  entitlements?: readonly EntitlementMutation[];
  rewards?: readonly SemanticKey[];
}>;
```

Весь bundle планируется и commit-ится одной UoW. Это требуется для Грого и
succession Быка: нельзя наблюдать часть фактов или двух/ни одного владельца
роли. Permanent outcome после commit не откатывается отменой run.

## Reward effects

- experience/money/reputation;
- item lots с overflow policy;
- profession;
- recipe;
- assistant/capability;
- location entitlement;
- permanent world facts.

Каждый owning port возвращает typed result и принимает operation key. Denial
любого mandatory effect откатывает package целиком.

## Profession rules

Quest author выбирает profession id, но cardinality проверяет profession owner:

- максимум одна gathering и одна production;
- дополнительные categories независимы;
- допустима любая gathering/production пара;
- занятый slot → denial, скрытой замены нет;
- replacement — explicit atomic remove old + grant new outcome;
- profession появляется только после terminal claim.

Recipe/assistant effects имеют отдельные receipts. Начальный рецепт может быть
выдан item reward, если именно так требует контент; это не неявный side effect
profession grant.

## Reputation/capability unlock

Если branch сначала открывает track/capability и затем начисляет reputation,
оба effects входят в ordered atomic bundle. Validator проверяет, что grant не
выполняется до unlock и cap относится к существующему track.

## Failure semantics

- policy denial → run остаётся ready, selection не commit-ится;
- infrastructure error → rollback/retry same operation;
- post-commit notification failure не откатывает reward;
- unsupported effect/version → invariant failure;
- partial manual compensation запрещена.

## Tests

- choose-one exactly once и stale selection;
- rollback на каждом effect ordinal;
- inventory overflow;
- profession pair/conflict/replacement;
- recipe/assistant duplicate;
- branch-specific packages;
- atomic multi-fact world outcome;
- cancel после permanent outcome;
- concurrent turn-in;
- history snapshot содержит выбранные package/outcome ids.

# Документация j-emu

## Начать работу

1. [Запуск сервера и клиента](RUN.md)
2. [Что уже работает](CAPABILITIES.md)
3. [Очередь capabilities](migration/ROADMAP.md)
4. [Процесс одной capability](migration/PLAYBOOK.md)
5. [Источники jgr-emu по срезам](migration/EVIDENCE_INDEX.md)

## Перенос поведения

- [Каноническая очередь](migration/ROADMAP.md)
- [Роли, gates и CEF-процесс](migration/PLAYBOOK.md)
- [Граница старого runtime и content corpus](migration/SOURCE_BOUNDARY.md)
- [Wire-инварианты](migration/WIRE_INVARIANTS.md)
- [Матрица переноса authored content](migration/CONTENT_MATRIX.md)
- [Точки архитектурного перепланирования](migration/ARCHITECTURE_EVOLUTION.md)
- [Character/bootstrap](modules/CHARACTER.md)
- [Inventory](modules/INVENTORY.md)
- [Store](modules/STORE.md)
- [World/hunt](modules/WORLD.md)
- [Combat](modules/COMBAT.md)
- [Quests/NPC](modules/QUESTS.md)

`jgr-emu` — поведенческий baseline цикла 1–8. Его код не является зависимостью
или архитектурным шаблоном. Повторный research нужен только при конфликте,
неизвестном wire, регрессе или старой пометке stub/bug.

## Архитектура реализации

- [Модули](architecture/MODULES.md)
- [Правила зависимостей](architecture/DEPENDENCY_RULES.md)
- [Команды клиента](architecture/CLIENT_COMMANDS.md)
- [Модель данных](architecture/DATA_MODEL.md)
- [Persistence и миграции](architecture/PERSISTENCE.md)
- [ID policy](architecture/ID_POLICY.md)
- [Content publication](architecture/CONTENT_PIPELINE.md)
- [Структура кода](architecture/CODE_STRUCTURE.md)

Краткие причины действующих решений: [ADR index](adr/README.md). Старые ADR и
завершённые планы находятся только в историческом разделе.

## Проверка

- [E2E-first тестирование](TESTING.md)
- [Локальный и client запуск](RUN.md)

## Единственный источник факта

- продуктовый статус — `CAPABILITIES.md`;
- порядок работ — `migration/ROADMAP.md`;
- процесс и роли — `migration/PLAYBOOK.md`;
- состав и полнота content import — `migration/CONTENT_MATRIX.md`;
- точки глобального refactor — `migration/ARCHITECTURE_EVOLUTION.md`;
- wire — `migration/WIRE_INVARIANTS.md` и соответствующий модульный документ;
- текущая схема — `architecture/DATA_MODEL.md`;
- правила разработки агентов — корневой `AGENTS.md`;
- причины долгоживущих решений — актуальные ADR.

Документ обновляется вместе с поведением, которое он описывает. Future behavior
помечается явно; завершённый план не остаётся в основном маршруте чтения.

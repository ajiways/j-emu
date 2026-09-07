# Документация j-emu

## С чего начинать

1. [Дорожная карта миграции](migration/ROADMAP.md)
2. [План foundation-рефакторинга](refactoring/FOUNDATION_REFACTOR.md)
3. [Границы модулей](architecture/MODULES.md)
4. [Правила зависимостей](architecture/DEPENDENCY_RULES.md)
5. [Инварианты wire-протокола](migration/WIRE_INVARIANTS.md)

## Архитектура

- [Persistence и Drizzle](architecture/PERSISTENCE.md)
- [Модель данных](architecture/DATA_MODEL.md)
- [Политика идентификаторов](architecture/ID_POLICY.md)
- [Публикация игрового контента](architecture/CONTENT_PIPELINE.md)
- [Команды клиента и wire DTO](architecture/CLIENT_COMMANDS.md)
- [Структура кода и файлов](architecture/CODE_STRUCTURE.md)
- [Граница старого проекта](migration/SOURCE_BOUNDARY.md)

## Проверка

- [E2E-first тестирование](TESTING.md)
- [ADR index](adr/README.md)

## Приоритет документов

Подтверждённый live dump и поведение клиента сильнее документации. Затем идут
wire fixtures, принятые ADR, architecture docs и roadmap. При расхождении код
приводится к документированному контракту.

## Локальный запуск

`.env` читается из каталога `package.json`, а не из `cwd` и не из `dist/`.
`npm run build` пишет `dist/main.js`.

```text
cp .env.example .env
npm run build
npm start
```

`npm run dev`, `db:migrate` и `db:publish:development` загружают тот же файл.

## Требования к документации

- Обновлять вместе с изменением контракта, конфигурации или процедуры.
- Хранить один канонический источник каждого факта и ссылаться на него.
- Отделять реализованное поведение от планов.
- Оставлять только сведения, необходимые для решения, реализации или проверки.
- Удалять устаревшее описание вместо накопления противоречивых версий.

Документ без конкретного читателя и проверяемой пользы не создаётся.

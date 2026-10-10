# PROJECT_STATUS
Playable: engine (pinhole 2.5D, parallax, lights), 5 rooms, hero from photo (js/character.js), tasks, story/phone/endings, minigames, UI+touch, dialogue (~1600 lines), synthesized audio.
Subagents hit the rate limit; remaining work is done solo. See docs/QA_REPORT.md for test results and open bugs.
Next: fix fridge-scrub draw error, story call timing, ui test timeout; review Dan/landlord; sprite sheet export; perf on real GPU.

## Станции (мини-игры)
- Реализованы: dishes, mirror, faucet, toilet, printer, vacJam (раньше была только fridge, остальное было заглушкой). Тест: node tools/test_stations.js (реальный ввод, 18/18).
- Динамическое разрешение: при просадке FPS сначала падает renderScale (до .65), потом качество.

## Правки по отзыву
- Реплики при ходьбе вернуты и учащены (порог 420 см, пауза 12 с, +24 новые матные озвученные строки; вход в комнату 75%).
- Фоновые бытовые звуки теперь только шум (без тонов и телевизионного бормотания); музыки нет.
- Подсказки взаимодействия: стеклянная компактная плашка на ПК; на телефоне маленький маркер над объектом, текст действия на кнопке E.

## Тесты (итог полного прогона)
- test_tasks 92/92, test_story 43/43, test_voice 11/11, test_stations (7 станций, реальный ввод) проходит; test_ui 104/105 (tap tool slot - артефакт теста, реальный тап работает); test_mini 19/22 (скрипт скраба холодильника покрывает не все пятна, полный проход холодильника проверен в test_stations).
- Запуск быстрее: ?q=low&enhance=0.

## Давление и отчаяние (docs/DREAD.md)
- Новый модуль `js/dread.js`: шкала давления 0..1 из времени, грязи и «ударов», 5 ступеней; случайные срывы (тирады), красная виньетка, дрожь на пике. Реплики: `js/lines_despair.js` (+48 коротких для ходьбы, 22 тирады, все озвучены).
- Авторские реплики про хозяина/уборку/мусор/кран/усталость/бездействие/неудачи теперь звучат и при ходьбе (раньше — только по событиям); чаще: каждые ~240 см, пауза 7 с.
- Тесты: `npm test` (dlg_selftest 1932/1932, test_dread, test_story, test_voice), `npm run test:all` — все тесты. Playwright и Chromium находятся через `tools/_pw.js` (без зашитых путей).
- Генератор озвучки теперь добавляет клипы к существующим (`tools/collect_new_lines.js` + `tools/gen_voice_silero.py`).

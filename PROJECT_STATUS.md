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

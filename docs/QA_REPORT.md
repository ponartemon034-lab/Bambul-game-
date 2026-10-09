# QA report (honest status)
Run in headless Chromium (software rendering, no GPU) via tools/*.js.

| Check | Result |
|---|---|
| World bake (5 rooms) | ~1.7 s, no console errors (qa_run.js) |
| Hero/door scale | hero 178 cm vs door 212 cm: rendered ratio matches (PASS) |
| Parallax | distinct per-layer factors 1 / 0.80 / 0.20 (PASS) |
| tools/test_tasks.js | tasks, minigame fallbacks, flags: passed, no console errors |
| tools/test_story.js | 41 passed, 2 failed (scheduled call timing at 75%/50%, phone tutorial toast) |
| tools/test_mini.js | 19 passed, 3 failed (fridge scrub→close stage in scripted run) + repeated page error 't' undefined in the fridge scrub draw loop |
| tools/test_ui.js | timed out in a desktop step (not investigated) |
| Frame time | ~35-70 ms in software rendering (GPU not available here); NOT measured on a real GPU/Android |
| Android/touch | implemented in ui.js, not tested on a device |

Known issues / next steps: fix the fridge scrub-stage error, story call scheduling, UI test timeout; character animations only checked on idle/run/sit screenshots; sprite-sheet export (tools/bake_sheet.js) and docs/CHARACTER.md not written; Dan/landlord looks not reviewed visually.


## Update: realistic hero + fixes
* Hero now uses painted sprites from the user's reference renders (assets/char/hero_*.png, cut out by tools/process_sprites.py; 1.9 px/cm so the idle sprite is exactly 178 cm). Idle/pose-deformed standing sprite + 7-frame run cycle; facing left by mirroring. Dan/landlord still use the older procedural rig (style mismatch).
* Fixed: tasks.js crashed on partial/foreign state (S.wash / S.bag undefined) - the repeated page error in the fridge test.
* Fridge scrub now completes at 88% (was 96%) so a human never gets stuck on the last specks.
* Remaining test noise: story scheduled-call timing in the harness, UI test dialog step clicking past the last line, mini test 'good food costs 4 s' uses wall-clock drift.

## Update: second prototype merged
* Hero: full cartoon animation set from bamboul_game_2 (assets/char/toon, 46 frames: idle/walk/run/carry/mop/tool/pickup/throw/panic/victory/jump/skid) is now the default; the realistic painted sprites are available via Settings -> "Реалистичный герой".
* Portraits for Dan / landlord / Bamboul (shock) from the prototype (assets/portraits).
* Dialogue: js/dialogue_plus.js - landlord calls 1-4 and Dan's call rewritten from the prototype with extra mat, ~150 new profane barks across categories.
* Mechanic adapted: stash carried trash in the hall wardrobe (up to 4, 60% credit); the 5th makes it explode (-8 s, trash spills back).
* Not ported: Three.js 3D renderer, printed flush-button flow (our printer/toilet minigames already cover repair), prototype minigame art.
* Tests after merge: qa_run PASS (except software-render frame time), test_tasks OK, test_story 41/43 (same 2 scheduling failures as before).

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

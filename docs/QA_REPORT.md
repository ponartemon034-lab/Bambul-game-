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

## Update: puppet animation for the realistic hero
The idle sprite is cut at load time into head / torso base (arms inpainted) / two articulated arms (shoulder+elbow). All action states drive arm and head angles (phone, mop, vac, scrub, repair, reach, cheer, panic, shrug, wave, point, pickup...), held items follow the forward-kinematic hand position. Walk/run/jump use the painted run frames (scaled), sofa pose = torso/legs split. Checked on screenshots: cheer, phone, mop, panic, pickup, openFridge, scrubToilet, point, shock, wave. Not verified: smoothness of transitions in motion, lower-body animation for crouch actions (still a squash of the standing sprite).

## Update: generated voice-over
832 spoken lines (Bamboul 653, landlord 111, Dan 68) synthesized offline with Piper TTS (ru_RU denis/dmitri/ruslan, tools/collect_lines.js -> tools/gen_voice.py -> tools/finalize_voice.py), pitch/tempo-shifted per character, stored as 24 kbps mp3 in assets/voice (11 MB). js/voice.js plays the clip matching the displayed line, falls back to browser speech for lines without a clip (e.g. numbers that vary). Not listened to by a human here: only file existence, key matching and level metering were checked.

## Update: voice system v2 (Silero, emotions, 60 lines)
* 1001 clips (13 MB) generated with Silero v4 + SSML emotions; replaces the Piper clips. See docs/VOICE.md.
* Found and fixed: gameplay barks (`garbage`, `vacuum`, `mop`, `tools`, `panic`, `phoneRing`, `afterCall`) matched no dialogue pool and were silently dropped; they are now routed (tools/test_voice.js "router: no dead gameplay barks").
* tools/test_voice.js: 11/11 (all pool lines have clips, 18 laundry lines, router, queued barks play from clips without browser-TTS fallback, one clip at a time, no repeats, laundry events produce spoken lines, toggle off silent, unknown line falls back safely, no errors).
* Regression run: qa_run PASS (software-render frame time only), test_tasks OK, test_story 40-41/43 (tutorial-toast check is timing-flaky: same code passes/fails across runs; the two call-schedule checks fail as before), test_mini 18/22 (same 4 scripted-scrub failures), dlg_selftest 2 pre-existing failures.
* Not verified by ear: voices were never listened to; only durations, levels, file keys and playback calls were checked.

## Update: graphics pass (realism)
* Engine: bake-time realism pass for every sprite (top-light gradient, inner-edge ambient occlusion, soft top-edge highlight, key-light gradient), cast shadows of furniture on the back wall from the nearest lamp, volumetric light cones under ceiling lamps, light pools on the floor (stronger on glossy floors), bloom/glow (downsampled bright-pass blur), teal/orange colour grade, rim light on the hero.
* Hero: the painted sprites got sharper textures + micro grain/clarity (assets/char, originals kept in assets/char/orig); look unchanged.
* New auto-quality: if the frame rate stays low in 'auto' quality, bloom/shadows/reflections are switched off step by step (headless software rendering drops to 'low' within seconds).
* Checked on screenshots in living room, kitchen, bath, workshop; frame time was only measured without a GPU (75-93 ms before auto-downgrade).

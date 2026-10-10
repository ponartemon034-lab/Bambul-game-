# Voice system (Bamboul, landlord, Dan)

> **v3 (current): Coqui XTTS-v2.** The clips are generated with XTTS-v2 (multilingual GPT-style model, Russian) instead of Silero v4: noticeably more natural intonation and breathing, real speech rhythm for swearing and shouting. Every clip is transcribed back with Whisper and compared with the text; unintelligible takes are re-rolled (up to 3 tries). Voices: Bamboul = `Baldur Sanjin`, landlord = `Damien Black`, Dan = `Andrew Chipper` (XTTS built-in speakers); the speaking speed follows the emotion tag (tired 0.93 ... panic 1.14). Output: loudness-normalised mp3, 24 kHz, 40 kbps in `assets/voice/<who>/<hash>.mp3`.
>
> Pipeline: `node tools/collect_new_lines.js lines.json --all` (dumps every spoken line) -> `COQUI_TOS_AGREED=1 python tools/gen_voice_xtts.py lines.json [workdir]` (resumable, merges into `assets/voice/manifest.json`). Needs `torch` (CPU is fine, ~10 s per line), `coqui-tts`, `transformers<4.58`, `torchcodec`, `faster-whisper`, ffmpeg.
>
> **Licence:** the XTTS-v2 weights are under the Coqui Public Model License (non-commercial use). For a commercial release replace them (own voice actor recordings, or a permissively licensed voice) - the game only needs `assets/voice/manifest.json` + the mp3 files.
>
> Silero v4 (below) is kept as the older pipeline (`tools/gen_voice_silero.py`, `tools/gen_voice.py`); clips for lines that were not regenerated stay as they were.


**Model:** Silero TTS v4 (Russian), offline, CPU. Speakers: `eugene` (Bamboul), `aidar` (Dan, landlord). Pitch is kept in the medium male range (median F0: Bamboul ~115 Hz, Dan ~129 Hz, landlord ~136 Hz, measured with tools/f0.py). Background music is disabled in the game. Piper (`tools/gen_voice.py`) is kept as an alternative generator.

**Pipeline (all pre-generated, nothing is synthesized at runtime):**
1. `node tools/collect_lines.js` - runs the game in Chromium and dumps every spoken line (pools of `BB.dlg` + all scripted calls under many states + minigame texts) with speaker and emotion tag -> `/tmp/lines.json` (1001 lines).
2. `/tmp/sv/bin/python tools/gen_voice_silero.py /tmp/lines.json` - SSML per emotion (`tired / grumble / annoyed / angry / surprise / relief / panic / dry`: pitch + rate, pauses at commas/ellipses), loudness-normalised mp3 (24 kHz, 28 kbps) in `assets/voice/<who>/<hash>.mp3`.
3. `python3 tools/finalize_voice.py` - re-keys `assets/voice/manifest.json` (fnv1a of `who|normalized text`).

**Runtime (`js/voice.js`):** `BB.voice.speak(text, who)` is called by the UI whenever a bubble or dialogue line is shown. It looks the line up in the manifest, plays the mp3 (one `Audio` at a time; a new line cancels the previous one), and falls back to the browser's speech synthesis if a line has no clip (e.g. text with changing numbers). Priority/queue/cooldown/no-repeat logic lives in `BB.dlg` (js/dialogue.js) and the UI bubble queue; the voice simply follows what is displayed. Settings: "Озвучка голосом" (on/off), "Громкость голоса". No API keys, no network at runtime (the manifest is fetched from the same origin; on `file://` clips are unavailable and the browser fallback is used).

**Events -> categories (`js/dialogue_plus.js`):** `BB.dlg.bark()` is wrapped by a router that maps gameplay categories (`garbage`, `vacuum`, `mop`, `tools`, `panic`, `phoneRing`...) onto real pools (this fixed gameplay barks that previously matched no pool). New pools carry the 60 authored lines: `owner:comes` (1-8, landlord ring/arrival), `chore:avoid` (9-20, starting mop/vac/tool), `pickup`/`toss` (21-28), `faucet:*` (29-36), `tired` (37-44, periodic effort), `wait` (45-52, standing idle), `oops` + `fail` (53-58), `allDone` (59), `owner:left` (60, good/ok endings). 18 laundry lines (`laundry:pick/load/start/wait/noise`) are tied to picking clothes, loading the machine, machine start and the running cycle (taking washed clothes out does not exist in the game). Passive hooks add mumbling during long walks (`move`), waiting, and fatigue.

**Regenerating after text changes:** run the three steps above (needs `torch` CPU + `numpy`, the model `v4_ru.pt` from models.silero.ai, ffmpeg). Test: `node tools/test_voice.js`.

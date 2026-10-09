# БАМБУЛЬ: ХОЗЯИН ЕДЕТ — architecture & module contract

A funny, crude, Russian‑language 2.5D platformer / cleaning‑chaos game. Plain browser JS, **no build step, no modules, no network deps** (fonts may come from Google Fonts but everything must degrade to system fonts). Open `index.html` through any static server (`npx http-server`, `python3 -m http.server`).

**Read `js/engine.js`, `js/art.js`, `js/main.js` before writing code. They are owned by the lead – do not edit them.** If you need an engine change, append a request to `docs/REQUESTS.md` (what, why, suggested API) and work around it meanwhile.

Rules for every module
* One IIFE per file, attach to the global `BB` (`window.BB = window.BB || {}`); never use `import`/`export`/`require`.
* Do NOT edit files you do not own (see ownership table). Do NOT run `git commit/push` – the lead integrates and commits.
* Game text is **Russian** (UTF‑8). Keep the crude, meme‑heavy, character‑driven humour of the master prompt (`BB.dlg` owns the library; other modules ask it for lines).
* Test in the real browser with `node tools/shot.js` (Playwright + Chromium, see bottom) and LOOK at the screenshots (Read tool on the png). Do not claim anything works that you did not run.
* Performance budget: 60 fps on desktop, 30+ on mid Android. Bake static art into canvases once (`BB.bake`), keep per‑frame work small, no per‑frame allocations in hot loops, no `ctx.filter` per frame.

## 1. Units, space and projection (engine)

* World unit = **1 centimetre**. `x` along the apartment (0 … 3300), `y` height above floor (0 floor, 260 ceiling), `z` depth away from the camera. **Gameplay lane is z = 0** (player, interactables). Back wall is at `z = LAYOUT.wallZ = 160`. Foreground occluders use z < 0 (e.g. −60 … −150, drawn blurred if `blur` set).
* One pinhole camera: `scale(z) = D/(D+z)`, D = 650 cm. A thing at z = 160 moves at 0.8125 × the speed of the gameplay lane, the city skyline (z = 2600) at 0.2 ×. This is real parallax, not faked offsets. Use `BB.sx(x,z)`, `BB.sy(y,z)`, `BB.pxPerCm(z)` for projection.
* Screen: logical 720 px high (`BB.view.H`), width follows aspect. `ppc` = 1.6 px/cm at z = 0 → the 178 cm hero is ≈ 285 px tall (~40 % of screen height), a 210 cm door ≈ 336 px.
* **Everything you paint is in centimetres**, origin top‑left of the sprite canvas, y down, via `BB.bake(wCm, hCm, (g,w,h)=>{…}, {blur})`. Bake resolution is automatic (1.25–2.2 px/cm). Draw with real dimensions (table below) – that is how scale stays consistent.
* Apartment layout (`BB.LAYOUT.rooms`): hall 0–600 · living 600–1450 · kitchen 1450–2050 · bath 2050–2600 · work 2600–3300. Inner walls (partitions) stand at 600, 1450, 2050, 2600 with a 96 cm wide, 212 cm high doorway drawn by the engine; do not put sprites in the ±40 cm next to a partition (z < 100).
* Rooms use **room‑relative x** (0 = room's left edge). Hotspots/solids/lights/objects too. Convert with `BB.abs('kitchen', 250)`.

Reference dimensions (cm) – use them:
| thing | size |
|---|---|
| hero | 178 tall, 55 wide shoulders; belly; reach ~ 215 overhead, hands at 95–110 |
| interior door opening | 96 × 212 (engine) · entrance door leaf 90 × 205 |
| ceiling | 260 |
| light switch | y 105–125 · wall socket y 30 · wall phone y 125–165 |
| kitchen counter | 90 high, 60 deep · sink bowl 18 deep · upper cabinets y 145–215 |
| fridge | 60 w × 185 h (tall) |
| stove/oven | 60 w × 90 h |
| sofa | 220 w, seat 45, back 85 · coffee table 110 × 45 h · TV 100 w · TV unit 45 h |
| toilet | 38 w, bowl rim 40, tank top 80 · bath sink 60 w, rim 85 · mirror y 125–200 · bathtub 170 × 55 |
| workbench | 90 high · Bambu Lab printer ≈ 39 × 39 × 46 (+ AMS unit on top ≈ 33 more) |
| washing machine | 60 × 85 |
| trash bag ≈ 45 tall · beer can 12 · pizza box 35 · filament spool Ø 20 (cm), 6 wide |

Engine render order (far → near): city skyline (z 2600) → ceiling / back wall / floor of each visible room → floor decals (hook) → **all sprites sorted by z** (room objects, hook drawables, actors, partition blocks) with painter's fog bands → lightmap (multiply, per‑room ambient + point lights) + bloom → `post` sprites (self‑lit: screens, LEDs, lamp shades) → dust motes → post hooks → vignette/grain.

## 2. Room module contract (`js/rooms/<id>.js`, owners: room artists)

```js
BB.defineRoom({
  id:'kitchen',                       // one of hall, living, kitchen, bath, work
  wallColor:['#top','#bottom'],       // used for partition faces & defaults
  partitionFace:'#8a8f73',            // optional colour of the partition faces seen from this room
  floorColor:[…], gloss:0.15,         // gloss 0..0.4 = floor reflection strength (bath wet tiles ≈ .3)
  ambient:{color:[r,g,b]},            // lightmap ambient 0-255 (dark=moody). optional ambientNow(S,t) -> [r,g,b]
  wall:(g,w,h,room)=>{…},             // back wall, cm. w = room width (+260 pad at the two ends), h = 260. Local x = world x - room.tx0. Leave TRANSPARENT holes for windows with BB.art.hole() → the parallax city shows through.
  floor:(g,w,d,room)=>{…},            // PLAN view: x along room, y = distance from back wall (0) toward viewer; d = 520 (lane z=0 is y=160). Wood, tiles, stains, rugs painted here.
  ceil:(g,w,d,room)=>{…},             // optional, same plan orientation (y=0 at back wall)
  objects:[ sprite, … ],              // see below
  lights:[ {x,y,z,r,color:'255,200,140',i:1,flicker:0,bloom:.1,on:(S)=>bool} ],
  hotspots:[ {id,x,r,h,label?} ],     // x room-relative; r = reach half-width; h = height of the prompt anchor (cm)
  solids:[ {x0,x1,top,active:(S)=>bool} ]   // walkable-top / blocking boxes at the gameplay lane (hero collides if feet below top-4)
});
```
Sprite object (all fields optional unless noted):
```js
{ id, x, y:0, z:0, w, h,              // x room-relative, centre; y = bottom above floor; w,h in cm (required with bake)
  bake: fn | {variantA:fn, variantB:fn},   // (g,w,h)=>paint in cm. Variants baked once; pick with variant:(S)=>'variantA'
  variant:(S)=>key,
  dyn:(g,t,S,o)=>{…},                 // per‑frame overlay painted in the SAME cm space (animation: drips, screen flicker, ring shake)
  depth:50,                           // extrudes real side/top faces (furniture volume) – set for solid furniture
  shadow:{w,a}|false, reflect:0..1, blur:px(for foreground/background DOF), alpha, flip,
  post:true, postMode:'lighter',      // drawn AFTER lighting = self‑lit (screens, LEDs, lamp glow)
  hidden:(S)=>bool }                  // e.g. things that disappear when cleaned
```
Z guidance: floor furniture against the back wall z = 70…140 (sofa, fridge, counter z≈60–110; depth ≈ 60), wall hangings z = 150…158, hero lane props z = 0…30, foreground dressing z = −60…−140 (blurred, partly occluding, placed so they do not hide hotspots for long). Layers 0‑5 of the master prompt map to: city (z 2600) · back wall (160) · deep furniture/shelves (90‑140) · gameplay (0) · foreground occluders (<0) · dust/steam particles (engine) + your own `dyn` steam.

**Quality bar:** cinematic, art‑directed, grimy lived‑in apartment (Little Nightmares / Unravel mood, readable). Distinct materials (wallpaper, peeling plaster, laminate, tile, metal, glass, fabric, plastic), AO in corners, edge highlights, stains, cables, clutter *clusters* with areas of rest, practical lights (warm lamps vs cool bathroom vs monitor glow). No flat clip‑art, no random prop spam, no neon. Room identity: living = warm dusty, kitchen = harsh overhead + stains, bath = cool damp reflective, work = monitor glow + filament colours, hall = transitional, coats/shoes/junk.

### Content brief per room (hotspot ids + positions are the contract with gameplay; room‑relative cm)
Do not move/rename them. Add more decorative sprites freely.

**hall (w 600)** – entrance, mess. Start: player begins in the living room; hall is the first goal (phone).
* `frontDoor` x 95, r 60, h 130 – quilted entrance door leaf 90×205 in back wall (variants closed/open via `S.f.doorOpen`), peephole, chain, handle.
* `switchHall` x 185, r 30, h 115 – light switch; hall lamp `on:(S)=>S.f.lightHall`, otherwise only dim spill from the living room. Default `S.f.lightHall=0`.
* `phone` x 255, r 55, h 145 – **wall telephone** (beige push‑button/rotary, coiled cord). `S.f.phoneRing` → shake + ringing light flash (use `dyn` + light); `S.f.phoneUp` → handset off the hook.
* coat rack + coats + shoes pile x 330 (decor, hanging coat dyn sway), umbrella.
* `boxes` x 385, r 60, h 60 – pile of cardboard boxes: **solid** `{x0:345,x1:425,top:46,active:S=>!S.f.boxesCleared}` (the jump tutorial). Hidden/smaller variant when cleared.
* `bagStand` x 465, r 55, h 70 – trash‑bag stand (bag visible, fuller with `S.f.bagFill` 0‥5).
* `closet` x 545, r 55, h 110 – wardrobe 90×230; `S.f.closetOpen` → door ajar showing vacuum cleaner inside (vacuum sprite hidden once `S.tools.vac`).
* Something grimy on the floor; wallpaper peeling; a bare bulb/ceiling lamp; fuse box; wall mirror.

**living (w 850)** – warm, dusty, lived in.
* `sofa` x 195, r 120, h 80 – 220 wide old sofa, blanket, pillows, crumbs; hero can lie on it (procrastination).
* coffee table x 450 (110×45) with beer cans, pizza boxes, shisha, ashtray, remote, cables (pure decor props; clutter clusters).
* `tv` x 650, r 75, h 120 – TV 100 w on a unit; `S.f.tvOn` → screen flicker (post sprite/dyn + blue light on, `lights.on`).
* window x 430 in the back wall (hole in wall; curtains, blinds, city visible); window light shaft at night.
* shelves x 770 (dusty books, figurines, a Bambu‑printed thing), floor lamp x 340, rug, wall carpet, plant, speaker cables.
* `laundry` x 90, r 55, h 40 – pile/basket of clothes (decor; actual pick‑ups are gameplay items).

**kitchen (w 600)** – practical, harsh light, stains.
* `fridge` x 65, r 65, h 130 – tall fridge with magnets, door that opens (variants/`S.f.fridgeOpen`; open shows interior shelves with rotten items while `S.f.fridgeDone` false; cleaned = tidy). Stink wiggle lines in `dyn` while dirty.
* `dishes` x 250, r 75, h 100 – counter + sink + dirty dishes pile (cleaner when `S.f.dishesDone`), tap, window above with city view, backsplash tiles, upper cabinets.
* `stove` x 410, r 50, h 100 – stove with greasy pan, hood, clock.
* `bin` x 520, r 55, h 70 – kitchen waste bin (dump garbage; overflowing variant `S.f.binFill` 0‥5).
* table/chairs (decor) near x 540?, hanging lamp at z≈30 (the practical light), cables, food packaging.

**bath (w 550)** – cool, damp, reflective (gloss ≈ .3), flickering fluorescent.
* `washer` x 65, r 55, h 90 – washing machine 60×85 (clothes go in; `S.f.washerOn` shaking).
* `mopStand` x 150, r 40, h 100 – mop + bucket leaning on the wall (hidden when `S.tools.mop`).
* `faucet` x 250, r 60, h 100 – sink 60 w + **howling faucet**: `S.f.faucetOn` water stream (dyn), `S.f.faucetHowl` spray + vibration, `S.f.faucetFixed` calm clear water; leak puddle painted by gameplay decals. Mirror above (grimy; `S.f.mirrorDone` clean).
* `tub` x 395, r 85, h 100 – bathtub 170×55 + mouldy curtain (decor), pipes, wet tile highlights.
* `toilet` x 505, r 50, h 70 – toilet with tank; dirty stains while `S.f.toiletClean<1`; **broken flush button** visible (variant) until `S.f.flushFixed`; flush animation `S.f.toiletFlush` (water swirl dyn). Keep content non‑graphic, comedic (stains, brush, cleaner bottle).

**work (w 700)** – workshop/hobby corner; monitor glow, cool filament colours.
* `filament` x 80 (rack with ~14 coloured spools, big pegboard with tools, cable trays).
* `printer` x 245, r 80, h 110 – **Bambu Lab style enclosed printer** (≈ 39×39×46) on a 90 cm workbench, AMS unit on top with 4 spools, PTFE tube(s) running from AMS to the toolhead (dyn), glass door, bed, toolhead; states: ok idle / printing (dyn: moving head, growing print, green LED) / error jam (red LED, spaghetti blob, tube tangled) / open (door open, tube detached) via `S.f.printerError`, `S.f.printerStage` (0 jam, 1 open, 2 tube out, 3 cleared, 4 rethreaded) and `S.f.printerFixed`. Monitor/phone next to it.
* `toolbox` x 405, r 45, h 40 – red toolbox on the floor (hidden when `S.tools.box`).
* `pc` x 560, r 80, h 120 – desk, PC tower, big monitor (post/emissive glow), chair, cables, energy drinks.
* shelves with boxes x 660, posters, failed prints.
Every room: 25+ authored sprites minimum (walls/floor/ceiling are separate), foreground dressing, ≥ 2 practical lights, visible environmental storytelling.

## 3. Game state (`BB.S`, created by `BB.newState(totalSeconds)` in `tasks.js`)
```js
S = { mode:'play'|'ending'|'menu', total, time /*sec left*/, lazy, slow?,
  f:{ …flags, numbers 0/1 unless noted (names are the contract with the rooms):
      lightHall, tvOn, doorOpen, phoneRing, phoneUp, boxesCleared, closetOpen,
      fridgeOpen, fridgeDone, fridgeStage, fridgeRot /*items left*/, dishesDone, binFill, bagFill,
      washerOn, mirrorDone, faucetOn, faucetHowl, faucetFixed, faucetStage /*0..4*/,
      toiletClean /*0..1*/, flushFixed, toiletFlush, printerError, printerStage /*0..4*/, printerFixed, printerPrinting,
      vacJam, vacN, lampFlicker … },
  tools:{vac:0|1, mop:0|1, box:0|1}, active:'hand'|'vac'|'mop'|'box',
  items:[{id,kind:'trash'|'cloth',v,ax,z,taken}], stains:[{id,ax,w,p /*1 dirty→0 clean*/,kind:'grime'|'water'}], dust:[{id,ax,w,p}],
  carry:{trash:0,cloth:0}, calls:{}, … (gameplay agents may add fields; document them in docs/STATE.md) }
```
Rooms must treat missing flags as 0 (`S.f.x` is `undefined` before newState, and `BB.DEFAULT_S` is used on the title screen).

## 4. Module APIs (contracts between agents)

### `BB.char` (js/character.js – character agent)
`BB.char.create('bamboul'|'dan'|'landlord')` → `{update(dt,ctl), draw(g,t,k), state, held, width, height}`; `draw` paints in cm with origin at the FEET (x=0, y=0 at floor, up = −y), facing `ctl.dir`(+1 right / −1 left; implement smooth turn using `ctl.face`), and keeps the hero **178 cm** tall (Dan ≈ 183, landlord ≈ 172, stout) in every frame. `ctl = {state, phase, speed, dir, face, held, t, actT /*0..1 progress of one‑shot*/, air, vy}`.
State names the game will request (implement all, plus aliases listed): `idle, idleBored(look around/annoyed), walk, run, stop, turn, jump, fall, land, reach, pickup, carry, putBag, open, openFridge, disgust, scrubFridge, phoneUse(pick up/hang up), phone(talk), listen, nervous(landlord threat), inspect, inspectLow(crouch at faucet), repair(crouched fixing), tinker(standing, printer), vac, mop, scrub(wipe), scrubToilet, flush, cheer, fail, panic, shrug, shock, angry, tired, sit(lie on sofa), haul, door, stumble, point(Dan), wave`.
`held`: `null|'bag'|'clothes'|'phone'|'wrench'|'cloth'|'box'|'mop'|'vac'|'brush'|'spool'|'tube'|'beer'`. Also `BB.char.portrait(kind,mood)` → HTMLCanvasElement/Image for dialogue avatars (Bamboul portrait derived from the supplied photo, `assets/char/*.png`), `BB.char.createNpcs()` registers hidden actors `BB.npc.landlord`, `BB.npc.dan` (objects `{x,y,dir,hidden,state, inst}` pushed into `BB.actors`). Assets & docs: `assets/char/`, `docs/CHARACTER.md`, `tools/process_photo.py`, `tools/bake_sheet.js` (exports sprite sheet `assets/char/bamboul_sheet.png` + `.json`), `tests/character_preview.html` (scale/animation validation scene).

### `BB.props` (js/props.js – props agent)
Baked small sprites & decals used by gameplay and rooms: `BB.props.trash(variant)` (≥ 12 variants: cans, bottles, pizza box, wrappers, chip bags, cups, paper balls, socks…), `BB.props.cloth(variant)` (≥ 5), `BB.props.get(kind,variant,state)` → `{img, w, h}` (cm sizes), kinds: `trash, cloth, bag (empty/full/held), vacuum (idle/on/snag), mop, bucket, toolbox, handset, spool(color), tube, wrench, brush, spray, cleaner, rag, beerCan, sock, towel`. Decal painters in floor plan space: `BB.props.stainDecal(g, ax, z, w, p, kind, seed)`, `BB.props.dustDecal(g, ax, z, w, p, seed)`, `BB.props.puddle(g, ax, z, w, p, t)` (use `BB.floorEllipse` / `BB.sx/sy`, in screen space inside a `BB.hooks.decals` callback). Clutter helper `BB.props.pile(g, seed, w, h, kinds)` for room artists. Dirty→clean **must look visibly different** (p drives alpha & shape; wet shine after mopping).

### `BB.tasks` (js/tasks.js – gameplay agent) – owns `BB.newState`, items/stains/dust, tools, cleaning loop, scoring
* `BB.newState(total)`; `BB.tasks.prompt(hotspot,S)` → Russian label or `null` (null = not available); `BB.tasks.interact(hotspot,S)`; `BB.tasks.nothingHere()`; `BB.tasks.progress(S)` → `{score:0..100, parts:[{id,label,p /*0..1*/,weight,text}], done:n, total:n}`; `BB.tasks.checklist(S)`.
* Registers `BB.hooks.update` (hold‑F cleaning with vacuum/mop through `BB.In.use`, cord snag, wet floor), `BB.hooks.drawables` (items, tools carried), `BB.hooks.decals` (stains/dust/puddles), `BB.hooks.hotspots` (each pickable item gets a low hotspot `{id:'item:ID', ax, r:38, h:30, low:true}`).
* Interactions: hotspot ids from §2 (frontDoor → `BB.story.askDoor()`, phone → `BB.story.phone()`, fridge/faucet/toilet/printer/dishes → `BB.mini.start(id,S,cb)`, pc/sofa/tv = procrastination (+ time loss, lazy++), toolbox/mopStand/closet = tool pickups, bagStand/bin = dump trash, washer = dump clothes, boxes = clear, switchHall = light).

### `BB.story` (js/story.js – gameplay agent #2 / combined) – clock, landlord calls, Dan, endings
`BB.story.start(total)` (new run: intro: hero on sofa, phone rings, tutorial prompts), update hook counts `S.time` down (paused by `BB.paused`, slowed during dialogue), landlord calls at authored/reactive thresholds, low‑time barks at 5 min/2 min/60 s/30 s (configurable in `BB.story.CFG`), phone interaction (`phone()`), `BB.story.callDan()` (hint call with cooldown; hints reflect real state), `BB.story.askDoor()`, `BB.story.ending(early)` (landlord NPC arrives at `frontDoor`, evaluates `BB.tasks.progress`, ending lines + result screen via `BB.ui.result`), save/load (`localStorage`, consistent), `BB.story.CALLS`.

### `BB.mini` (js/minigames.js – minigame agent)
`BB.mini.start(id, S, onDone)` with id ∈ `fridge, faucet, toilet, printer, dishes, mirror, vacJam`; `onDone({win, timeCost?})`. Each is a staged state machine with clues, failure feedback, recovery, Dan hints (`BB.story.callDan` or `BB.dlg.script('danHint:<id>')` from current stage). Updates `S.f.*` stage flags **as the steps happen** so the world changes visibly (see §3), calls `BB.player.doAct/mood`, `BB.overrideAnim`, `BB.audio.sfx`, `BB.dlg.bark`. Uses `BB.ui.panel()` for the minigame window (touch + keyboard + mouse). Closing a minigame mid‑way keeps progress (no reset on reopen). Must be completable by a human with only the visible hints.

### `BB.ui` (js/ui.js, css/style.css – UI agent)
`onReady(qs)` (title menu or `?autostart`), `busy()`, `onKey(e,down)→bool`, `onBlur()`, `frame(dt,t)` (HUD + prompt pill anchored to `BB.cur` via `BB.sx/BB.sy` + speech bubble over the hero), `say(text,{who,dur,prio})`, `dialog(lines,onEnd,{phone})` (lines `{who:'bamboul'|'landlord'|'dan'|'narr', text, choices?:[{text,run}]}`), `toast(text)`, `panel({title,hint,build(el),onClose})→{el,close,setHint,setProgress}`, `ring(who,onAnswer,onDecline)`, `showMenu(kind,arg)` (title/new/help/settings/pause/door/result), `result(sc,parts,…)`, `openTasks()`, `hud.update()`, touch controls (stick, jump, **E action**, **F use**, pause/tasks/Dan buttons) that write `BB.In.tAx/tUse/act/jump`, responsive landscape‑first layout, settings (volume master/music/sfx, censor “запикать мат”, subtitles, quality low/med/high, touch controls, fullscreen via Fullscreen API with fallback toast). All buttons must work. Dialogue uses `BB.char.portrait()`.

### `BB.dlg` (js/dialogue.js – dialogue agent)
`BB.dlg.line(category,ctx)→string` (weighted random, per‑category cooldown & history ring to avoid repeats, state filters, profanity censor via `BB.CFG.censor`), `BB.dlg.bark(category,ctx,{force,prio})` → `BB.ui.say` with priority/queue rules, `BB.dlg.script(id,ctx)→lines[]` for scripted conversations (intro, landlord calls ×N, Dan calls, endings, minigame monologues, tutorial), `BB.dlg.idleWatch` (procrastination escalation), `BB.dlg.CATS` (list). Minimum counts: 20 idle/procrastination, 15 garbage, 15 vacuum, 15 mop, 15 fridge, 15 faucet, 15 toilet, 20 printer, 15 landlord, 15 Dan, 15 low‑time/panic, 15 success/failure + room entry, tools pickup, door, tv/sofa/pc… Voices: Bamboul (lazy, self‑mocking, profane for rhythm), landlord **Аркадий Семёнович** (angry cartoonish threats, bureaucratic), **Дэн** (dry sarcastic practical brother).

### `BB.audio` (js/audio.js – audio agent)
All synthesized with WebAudio (no files): `init()`, `sfx(name,{x,vol,rate})` (x = world position → pan/attenuation vs camera), `loop(name,on,opts)`, `music(on,intensity)`, `step(roomId,run)`, `setVolume(kind,v)` (`master|music|sfx`), `stopAll()`, `resume()`. Required names: `step, jump, land, pickup, bag, bagFull, toss, vacOn(loop), vacSnag, vacOff, mop(loop-ish), bucket, scrub, fridgeOpen, fridgeClose, disgust, flies(loop), faucetHowl(loop, spatial), water(loop), drip, toiletFlush, toiletClean, button, printerMotor(loop), printerBeep, printerError, filament, tubePop, phoneRing(loop), pickupPhone, hangup, landlordVoice(talk babble), danVoice, uiClick, uiBack, uiHover, taskDone, win, bad, tick, urgent, doorKnock, doorBell, doorOpen, tv(loop), sofa, ending stingers: `endGood, endOk, endBad`. Music: tense funky comedic loop that speeds up when time is low.

## 5. Global flags / config
`BB.CFG = {vol, music, sfx, censor, subs, touch, quality}` lives in `localStorage('bamboul.cfg')`, owned by ui.js (create it if absent: `BB.CFG = BB.CFG || {…}`; everyone reads it). Debug: `F3` toggles BB.debug overlay (layers/parallax factors, hotspots, solids, 1 m ruler); `?debug`, `?q=low|med|high`, `?room=<id>`, `?x=<cm>` URL params; `window.__bb` test handle.

## 6. Testing recipe
```
node tools/shot.js index.html /tmp/out.png --x 2450 --wait 900                 # camera/player at world x
node tools/shot.js index.html /tmp/out.png --x 800 --eval "BB.S.f.tvOn=1" --after "BB.frameStats"
node tools/shot.js index.html /tmp/out.png --w 844 --h 390 --dpr 2 …           # phone landscape
```
(`--keys KeyD:600` holds keys; `--eval` runs JS before the screenshot; check "no console errors" in the output.) View PNGs with the Read tool. Rooms can be previewed alone: other modules missing is fine (engine falls back to defaults).

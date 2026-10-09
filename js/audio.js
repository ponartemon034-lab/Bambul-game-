/* БАМБУЛЬ: ХОЗЯИН ЕДЕТ — BB.audio : 100 % WebAudio synthesis (no files, no network).
   Owner: audio agent. See docs/AUDIO.md.  One IIFE, attaches to window.BB. */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const R = Math.random, clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const mtof = n => 440 * Math.pow(2, (n - 69) / 12);

  /* ------------------------------------------------------------ tables */
  const SURF = { hall: 'wood', living: 'wood', kitchen: 'tile', bath: 'tile', work: 'concrete' };
  const ROOMWET = { hall: .16, living: .08, kitchen: .12, bath: .42, work: .2 };
  // reverb send (0..1) per sound
  const WET = { drip: .9, taskDone: .45, win: .35, bad: .25, endGood: .4, endOk: .3, endBad: .45, doorBell: .5, doorKnock: .2, toiletFlush: .3, success2: .4,
    printerBeep: .15, phoneRing: .12, tubePop: .2, bucket: .25, toiletClean: .3, landlordVoice: .08, heaterTick: .2, wrench: .15 };
  const GAP = { step: .06, uiHover: .05, uiClick: .04, tick: .05, drip: .08, jump: .1, land: .1 };       // min seconds between repeats
  const PRIO = { win: 1, endGood: 1, endOk: 1, endBad: 1, bad: 1, phoneRing: 1, doorKnock: 1, doorBell: 1, taskDone: 1, urgent: 1, pickupPhone: 1, hangup: 1 };
  const SUB = {
    pickup: '[подобрал]', bag: '[шуршит мешок]', bagFull: '[мешок трещит по швам]', toss: '[бросок и грохот]', vacOn: '[гудит пылесос]', vacSnag: '[пылесос захлебнулся]',
    vacOff: '[пылесос затих]', mop: '[шлёп-шлёп тряпкой]', bucket: '[плеск ведра]', scrub: '[скрип щётки]', fridgeOpen: '[чпок — холодильник открыт]', fridgeClose: '[хлопок дверцы]',
    disgust: '[фу-у-у]', flies: '[жужжание мух]', faucetHowl: '[вой крана]', water: '[шум воды]', drip: '[кап]', toiletFlush: '[смыв унитаза]', toiletClean: '[скрип чистоты]',
    button: '[щёлк]', printerMotor: '[гудит принтер]', printerBeep: '[пик принтера]', printerError: '[принтер ругается]', filament: '[трещотка филамента]', tubePop: '[пшик трубки]',
    phoneRing: '[звонит телефон]', pickupPhone: '[снял трубку]', hangup: '[бросил трубку]', landlordVoice: '[Аркадий Семёнович рычит]', danVoice: '[Дэн бурчит]', bamboulVoice: '[Бамбуль мычит]',
    taskDone: '[дзинь — готово]', win: '[фанфары]', bad: '[грустный тромбон]', urgent: '[тревожный сигнал]', doorKnock: '[стук в дверь]', doorBell: '[дин-дон, звонок]', doorOpen: '[скрип двери]',
    tv: '[бормочет телевизор]', sofa: '[скрипят пружины дивана]', endGood: '[победный финал]', endOk: '[так себе финал]', endBad: '[печальный финал]', switch: '[щёлк выключателя]',
    spray: '[пшик спрея]', wrench: '[лязг ключа]', ratchet: '[трещотка]', scrapeTube: '[скрежет трубки]', heaterTick: '[потрескивает нагреватель]', success2: '[дзинь!]',
    fridgeHum: '[гул холодильника]', bathBuzz: '[гудит лампа]', workFans: '[гудят вентиляторы]'
  };

  /* per-sound loudness trims, calibrated by tests/audio_measure.js (see docs/AUDIO.md). */
  /*BEGIN-TRIM*/
  const TRIM = {"step":0.189, "jump":0.377, "land":0.153, "pickup":0.535, "bag":2.686, "bagFull":0.287, "toss":0.241, "vacOn":0.677, "vacSnag":0.496, "vacOff":0.65, "mop":2.002, "bucket":0.798, "scrub":1.451, "fridgeOpen":0.686, "fridgeClose":0.259, "disgust":1.301, "flies":1.019, "faucetHowl":0.154, "water":2.008, "drip":0.568, "toiletFlush":0.601, "toiletClean":1.722, "button":0.416, "printerMotor":1.192, "printerBeep":0.452, "printerError":0.558, "filament":0.708, "tubePop":0.515, "scrapeTube":1.866, "phoneRing":0.374, "pickupPhone":0.867, "hangup":0.252, "landlordVoice":0.381, "danVoice":0.352, "bamboulVoice":0.309, "uiClick":0.514, "uiBack":0.442, "uiHover":0.582, "taskDone":0.593, "success2":0.657, "win":0.436, "bad":0.837, "tick":0.693, "urgent":0.395, "doorKnock":0.24, "doorBell":0.819, "doorOpen":0.705, "tv":0.286, "sofa":0.275, "endGood":0.328, "endOk":0.687, "endBad":0.543, "switch":0.371, "spray":0.502, "wrench":1.157, "ratchet":1.467, "heaterTick":0.765, "L_vacOn":0.225, "L_mop":0.907, "L_flies":0.29, "L_faucetHowl":0.132, "L_water":0.698, "L_printerMotor":0.381, "L_phoneRing":0.309, "L_tv":0.14, "L_fridgeHum":0.082, "L_bathBuzz":0.629, "L_workFans":0.366, "L_amb_hall":0.265, "L_amb_living":0.155, "L_amb_kitchen":0.073, "L_amb_bath":0.538, "L_amb_work":0.326, "music":0.506};
  /*END-TRIM*/

  /* ============================================================ ENGINE */
  function Engine(C, opt) {
    opt = opt || {};
    const offline = !!opt.offline, raw = !!opt.raw, useTrim = opt.trim !== false;
    const MAXV = 30, MAXL = 9;
    let live = 0, peakLive = 0;
    const voices = new Set(), loops = {}, lastPlay = {};
    const S = {}, LP = {};
    const cfg = () => (BB.CFG = BB.CFG || {});
    const sr = C.sampleRate;
    const trimOf = n => (useTrim && TRIM[n]) ? TRIM[n] : 1;

    /* ---------------- buffers */
    function mkBuf(kind) {
      const n = Math.floor(sr * 2.2), b = C.createBuffer(1, n, sr), d = b.getChannelData(0);
      if (kind === 'white') for (let i = 0; i < n; i++) d[i] = R() * 2 - 1;
      else if (kind === 'pink') { let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0; for (let i = 0; i < n; i++) { const w = R() * 2 - 1; b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852; b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * .11; b6 = w * .115926; } }
      else { let l = 0; for (let i = 0; i < n; i++) { const w = R() * 2 - 1; l = (l + .02 * w) / 1.02; d[i] = l * 3.5; } }
      const x = Math.floor(sr * .02);                       // crossfade tail into head so the loop point is click free
      for (let i = 0; i < x; i++) { const k = i / x; d[n - x + i] = d[n - x + i] * (1 - k) + d[i] * k; }
      return b;
    }
    const NB = { white: mkBuf('white'), pink: mkBuf('pink'), brown: mkBuf('brown') };
    const shapeCurve = (() => { const n = 2048, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * 1.15) / Math.tanh(1.15); } return c; })();

    /* ---------------- master chain */
    const mix = C.createGain(), master = C.createGain();
    const sfxBus = C.createGain(), musBus = C.createGain(), ambBus = C.createGain();
    sfxBus.connect(mix); musBus.connect(mix); ambBus.connect(mix);
    const revIn = C.createGain(), revWet = C.createGain(); revWet.gain.value = .1;
    for (const d of [.0297, .0371, .0411, .0531]) {        // convolution-free "room": 4 damped feedback delays
      const dn = C.createDelay(.2); dn.delayTime.value = d; const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
      const fb = C.createGain(); fb.gain.value = .5; revIn.connect(dn); dn.connect(lp); lp.connect(fb); fb.connect(dn); lp.connect(revWet);
    }
    revWet.connect(mix);
    let outNode = null;
    if (raw) { mix.connect(C.destination); }
    else {
      const comp = C.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 3.5; comp.attack.value = .006; comp.release.value = .22;
      const lim = C.createDynamicsCompressor(); lim.threshold.value = -4; lim.knee.value = 2; lim.ratio.value = 20; lim.attack.value = .001; lim.release.value = .08;
      const sh = C.createWaveShaper(); sh.curve = shapeCurve; sh.oversample = '2x';
      mix.connect(master); master.connect(comp); comp.connect(lim); lim.connect(sh); sh.connect(C.destination); outNode = sh;
    }
    function volOf(k) { const d = { vol: .8, music: .7, sfx: .9 }; const v = cfg()[k]; return v == null || isNaN(v) ? d[k] : clamp(+v, 0, 1); }
    let appliedVol = '';
    function applyVolumes(imm) {
      const key = volOf('vol') + '|' + volOf('music') + '|' + volOf('sfx'); if (key === appliedVol && !imm) return; appliedVol = key;
      const t = C.currentTime, tc = imm ? .001 : .05, vs = volOf('sfx'), vm = volOf('music'), vv = volOf('vol');
      if (!raw) master.gain.setTargetAtTime(1.4 * vv * vv, t, tc);
      sfxBus.gain.setTargetAtTime(vs * vs * 1.2, t, tc);
      musBus.gain.setTargetAtTime(vm * vm * 1.2, t, tc);
      ambBus.gain.setTargetAtTime(vs * vs * 1.2, t, tc);
    }
    applyVolumes(true);

    /* ---------------- voice bookkeeping (every node is released when its last source ends) */
    function newV(t0) {
      const v = { t: t0, out: C.createGain(), nodes: [], srcs: [], n: 0, done: false, end: t0, tick: null, rate: 1 };
      v.in = v.out; v.nodes.push(v.out); live++; if (live > peakLive) peakLive = live; voices.add(v); return v;
    }
    const reg = (v, n) => { v.nodes.push(n); return n; };
    function kill(v) {
      if (v.done) return; v.done = true; live--; voices.delete(v);
      for (const s of v.srcs) { try { s.onended = null; s.stop(); } catch (e) { } }
      for (const n of v.nodes) { try { n.disconnect(); } catch (e) { } }
      v.nodes.length = 0; v.srcs.length = 0;
    }
    function srcStart(v, s, t, tEnd) {
      v.n++; v.srcs.push(s);
      s.onended = () => { if (--v.n <= 0) kill(v); };
      s.start(t); if (tEnd != null) { s.stop(tEnd); if (tEnd > v.end) v.end = tEnd; }
    }
    function nsrc(kind) { const s = C.createBufferSource(); s.buffer = NB[kind || 'white']; s.loop = true; s.loopStart = 0; s.loopEnd = s.buffer.duration; return s; }

    /* ---------------- synthesis helpers */
    function env(g, t, a, h, d, pk) {
      const p = g.gain; p.setValueAtTime(.0001, t); p.linearRampToValueAtTime(pk, t + a);
      if (h > 0) p.setValueAtTime(pk, t + a + h);
      p.exponentialRampToValueAtTime(.0001, t + a + h + d);
    }
    /* oscillator note.  o: type f f2 fd t a h d vol det fl fc fc2 q vib[hz,cents] am[hz,depth] to */
    function T(v, o) {
      const t = v.t + (o.t || 0), a = o.a == null ? .005 : o.a, h = o.h || 0, d = o.d || .2, end = t + a + h + d + .03, rt = v.rate;
      if (o.f * rt > sr * .45 || (o.f2 && o.f2 * rt > sr * .45)) return null;   // above Nyquist: skip
      const s = C.createOscillator(); s.type = o.type || 'sine'; s.frequency.setValueAtTime(o.f * rt, t);
      if (o.f2) s.frequency.exponentialRampToValueAtTime(o.f2 * rt, t + (o.fd || (a + h + d)));
      if (o.det) s.detune.value = o.det;
      const g = reg(v, C.createGain()); env(g, t, a, h, d, o.vol == null ? .5 : o.vol);
      let last = s;
      if (o.fl) { const f = reg(v, C.createBiquadFilter()); f.type = o.fl; f.frequency.setValueAtTime(o.fc || 1000, t); if (o.fc2) f.frequency.exponentialRampToValueAtTime(o.fc2, t + a + h + d); f.Q.value = o.q || .7; last.connect(f); last = f; }
      if (o.am) { const ag = reg(v, C.createGain()); ag.gain.value = 1 - o.am[1] * .5; const l = C.createOscillator(); l.frequency.value = o.am[0]; const lg = reg(v, C.createGain()); lg.gain.value = o.am[1] * .5; l.connect(lg); lg.connect(ag.gain); srcStart(v, l, t, end); last.connect(ag); last = ag; }
      last.connect(g);
      if (o.vib) { const l = C.createOscillator(); l.frequency.value = o.vib[0]; const lg = reg(v, C.createGain()); lg.gain.value = o.vib[1]; l.connect(lg); lg.connect(s.detune); srcStart(v, l, t, end); }
      g.connect(o.to || v.out); srcStart(v, s, t, end); return g;
    }
    /* noise burst. o: kind fl fc fc2 q t a h d vol */
    function N(v, o) {
      const t = v.t + Math.max(0, o.t || 0), a = o.a == null ? .004 : o.a, h = o.h || 0, d = o.d || .1, end = t + a + h + d + .03;
      const s = nsrc(o.kind); const g = reg(v, C.createGain()); env(g, t, a, h, d, o.vol == null ? .5 : o.vol);
      if (o.fl) { const f = reg(v, C.createBiquadFilter()); f.type = o.fl; f.frequency.setValueAtTime(o.fc || 1000, t); if (o.fc2) f.frequency.exponentialRampToValueAtTime(o.fc2, t + a + h + d); f.Q.value = o.q || .7; s.connect(f); f.connect(g); } else s.connect(g);
      g.connect(o.to || v.out); srcStart(v, s, t, end); return g;
    }
    function bell(v, f, t, vol, d) {
      d = d || 1; const P = [[1, .55, 1], [2.0, .22, .6], [2.76, .25, .45], [5.4, .08, .25], [8.9, .03, .15]];
      for (const p of P) T(v, { f: f * p[0], t, a: .002, d: d * p[2], vol: vol * p[1] });
    }
    function pluck(v, f, t, vol, d) { d = d || .5; T(v, { f, t, a: .004, d, vol }); T(v, { f: f * 2, t, a: .003, d: d * .45, vol: vol * .3 }); T(v, { f: f * 3.01, t, a: .002, d: d * .2, vol: vol * .1, type: 'triangle' }); }
    function brass(v, f, t, dur, vol, o) {
      o = o || {}; const lpf = f * 4;
      T(v, { type: 'sawtooth', f, t, a: .03, h: dur, d: .12, vol, fl: 'lowpass', fc: lpf * .6, fc2: lpf, q: 1, vib: o.vib || [5.5, 10] });
      T(v, { type: 'sawtooth', f: f * 1.004, t, a: .03, h: dur, d: .12, vol: vol * .6, fl: 'lowpass', fc: lpf * .6, fc2: lpf, q: 1 });
    }
    function loopOsc(v, type, f, vol, to) { const s = C.createOscillator(); s.type = type; s.frequency.value = f; const g = reg(v, C.createGain()); g.gain.value = vol; s.connect(g); g.connect(to || v.in); srcStart(v, s, v.t); return { s, g }; }
    function loopNoise(v, kind, fl, fc, q, vol, to) {
      const s = nsrc(kind); let last = s, f = null;
      if (fl) { f = reg(v, C.createBiquadFilter()); f.type = fl; f.frequency.value = fc; f.Q.value = q || .7; s.connect(f); last = f; }
      const g = reg(v, C.createGain()); g.gain.value = vol; last.connect(g); g.connect(to || v.in); srcStart(v, s, v.t); return { s, f, g };
    }
    function lfo(v, hz, depth, param, type) { const l = C.createOscillator(); l.type = type || 'sine'; l.frequency.value = hz; const g = reg(v, C.createGain()); g.gain.value = depth; l.connect(g); g.connect(param); srcStart(v, l, v.t); return l; }
    // osc -> lowpass -> gain -> v.in, returns {s,g(of the osc), f}
    function loopOscLP(v, type, f, vol, fc) { const o = loopOsc(v, type, f, 1, null); o.g.disconnect(); const lf = reg(v, C.createBiquadFilter()); lf.type = 'lowpass'; lf.frequency.value = fc; const g = reg(v, C.createGain()); g.gain.value = vol; o.g.connect(lf); lf.connect(g); g.connect(v.in); return { s: o.s, g, f: lf }; }

    /* ---------------- formant speech synth (cartoon babble) */
    const VOW = { a: [800, 1200, 2500], o: [520, 880, 2500], u: [330, 800, 2400], e: [500, 1800, 2550], i: [320, 2200, 3000], y: [400, 1450, 2400], ae: [650, 1650, 2600] };
    function mkSpeaker(v, o, to) {
      const osc = C.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 110;
      const grow = reg(v, C.createGain()); grow.gain.value = 1 - (o.growl || 0) * .5; osc.connect(grow);
      if (o.growl) lfo(v, o.growlHz || 46, o.growl * .5, grow.gain);
      const sum = reg(v, C.createGain()); grow.connect(sum);
      if (o.breath) { const n = nsrc('white'); const bg = reg(v, C.createGain()); bg.gain.value = o.breath; n.connect(bg); bg.connect(sum); srcStart(v, n, v.t); }
      const lpf = reg(v, C.createBiquadFilter()); lpf.type = 'lowpass'; lpf.frequency.value = o.lp || 3000; lpf.Q.value = .6;
      const amp = reg(v, C.createGain()); amp.gain.value = 0;
      const bps = [], Q = [5, 8, 10], G = [1, .55, .28];
      for (let i = 0; i < 3; i++) { const b = reg(v, C.createBiquadFilter()); b.type = 'bandpass'; b.Q.value = Q[i]; b.frequency.value = 800; const fg = reg(v, C.createGain()); fg.gain.value = G[i] * 3; sum.connect(b); b.connect(fg); fg.connect(lpf); bps.push(b); }
      lpf.connect(amp); amp.connect(to || v.in); srcStart(v, osc, v.t);
      const sp = { osc, amp, bps };
      sp.syll = (t, dur, f0, f0e, vow, a) => {
        const F = VOW[vow] || VOW.a;
        osc.frequency.setValueAtTime(f0, t); osc.frequency.linearRampToValueAtTime(f0e, t + dur);
        for (let i = 0; i < 3; i++) bps[i].frequency.setTargetAtTime(F[i] * (o.fs || 1), t, .018);
        const p = amp.gain; p.setValueAtTime(0, t); p.linearRampToValueAtTime(a, t + Math.min(.02, dur * .3)); p.setValueAtTime(a * .9, t + dur * .65); p.linearRampToValueAtTime(0, t + dur);
      };
      return sp;
    }
    const CHAR = {
      landlord: { f0: 92, fj: 16, vows: ['a', 'o', 'u', 'y', 'o'], dur: [.09, .17], gap: [.015, .05], c0: 1.1, c1: .82, growl: .9, growlHz: 42, breath: .12, lp: 2300, amp: .9, accent: .32, wordEvery: [2, 4], wordGap: .09, fs: .95 },
      dan: { f0: 128, fj: 10, vows: ['e', 'a', 'i', 'o', 'e'], dur: [.06, .11], gap: [.02, .05], c0: 1.03, c1: .97, growl: 0, breath: .06, lp: 3400, amp: .7, accent: .15, wordEvery: [2, 5], wordGap: .1, fs: 1.02 },
      bamboul: { f0: 105, fj: 12, vows: ['o', 'u', 'a', 'y', 'o'], dur: [.15, .27], gap: [.04, .1], c0: 1.12, c1: .76, growl: .35, growlHz: 30, breath: .3, lp: 2000, amp: .85, accent: .1, wordEvery: [1, 3], wordGap: .16, fs: .97 },
      tv: { f0: 135, fj: 55, vows: ['a', 'e', 'o', 'i', 'ae', 'u'], dur: [.07, .15], gap: [.01, .04], c0: 1.05, c1: .95, growl: 0, breath: .08, lp: 1700, amp: .8, accent: .2, wordEvery: [2, 5], wordGap: .08, fs: 1 }
    };
    const rr = a => a[0] + R() * (a[1] - a[0]);
    function speak(v, kind, len) {
      const c = CHAR[kind]; const sp = mkSpeaker(v, c); len = clamp(+len || .14, .06, 4);
      let t = v.t, n = 0, base = c.f0 + (R() - .5) * c.fj, inWord = 0, wlen = 0 | rr(c.wordEvery); const until = v.t + len, first = t;
      while (t < until - .02 || t === first) {
        let dur = rr(c.dur); if (t + dur > until + .04) dur = Math.max(.05, until - t + .04);
        const acc = R() < c.accent; const f0 = base * (acc ? 1.22 : 1) * (1 + (R() - .5) * .08);
        sp.syll(t, dur, f0 * c.c0, f0 * c.c1, c.vows[0 | (R() * c.vows.length)], c.amp * (acc ? 1.25 : 1) * (.8 + R() * .2));
        if (kind !== 'bamboul' && R() < .55) N(v, { t: t - v.t - .004, a: .001, d: .02, fl: 'bandpass', fc: 1200 + R() * 2200, q: 1.5, vol: kind === 'dan' ? .18 : .12 });
        t += dur + rr(c.gap); n++; inWord++;
        if (inWord >= wlen) { inWord = 0; wlen = 0 | rr(c.wordEvery); t += c.wordGap * (.6 + R() * .8); base = c.f0 + (R() - .5) * c.fj; }
        if (n > 40) break;
      }
      const end = t + .06; sp.osc.stop(end + .02); v.end = Math.max(v.end, end); return end;
    }

    /* ======================================================= ONE-SHOTS */
    S.step = (v, o) => {
      const s = o.surface || 'wood', k = .88 + R() * .24, m = o.run ? .8 : 1;
      if (s === 'wood') { T(v, { f: 135 * k, f2: 62, d: .11 * m, vol: .7 }); N(v, { kind: 'pink', fl: 'bandpass', fc: 320 * k, q: .9, d: .08 * m, vol: .85 }); N(v, { fl: 'highpass', fc: 2600, a: .001, d: .02, vol: .12 }); }
      else if (s === 'tile') { T(v, { f: 115, f2: 60, d: .08 * m, vol: .4 }); N(v, { fl: 'bandpass', fc: 2300 * k, q: 1.2, a: .001, d: .05 * m, vol: .55 }); T(v, { f: 1400 * k, f2: 900, a: .001, d: .03, vol: .1 }); N(v, { fl: 'highpass', fc: 5200, a: .001, d: .015, vol: .1 }); }
      else { N(v, { kind: 'brown', fl: 'lowpass', fc: 750 * k, d: .1 * m, vol: .9 }); N(v, { kind: 'pink', fl: 'bandpass', fc: 1600, q: .7, a: .012, d: .09, vol: .25 }); T(v, { f: 92, f2: 55, d: .09, vol: .4 }); }
    };
    S.jump = v => { T(v, { type: 'triangle', f: 250, f2: 640, d: .16, a: .01, vol: .5 }); T(v, { f: 500, f2: 1240, d: .14, a: .01, vol: .1 }); N(v, { kind: 'pink', fl: 'bandpass', fc: 1200, q: .8, a: .03, d: .12, vol: .22 }); };
    S.land = v => { T(v, { f: 140, f2: 45, d: .2, vol: .95 }); N(v, { kind: 'brown', fl: 'lowpass', fc: 520, d: .14, vol: .7 }); N(v, { fl: 'highpass', fc: 3000, a: .001, d: .02, vol: .1 }); };
    S.pickup = v => { T(v, { f: 740, d: .14, vol: .45 }); T(v, { f: 1110, t: .07, d: .22, vol: .4 }); T(v, { f: 2220, t: .07, d: .1, vol: .07 }); N(v, { fl: 'highpass', fc: 4200, a: .002, d: .03, vol: .06 }); };
    function crinkle(v, n, lo, hi, vol, spread) { for (let i = 0; i < n; i++) N(v, { fl: 'bandpass', fc: lo + R() * (hi - lo), q: 1.5, t: i * (spread || .025) + R() * .012, a: .002, d: .03 + R() * .02, vol: vol * (.5 + R() * .6) }); }
    S.bag = v => { crinkle(v, 7, 3000, 6000, .4); N(v, { kind: 'pink', fl: 'bandpass', fc: 700, q: .8, a: .05, d: .3, vol: .25 }); };
    S.bagFull = v => { crinkle(v, 9, 1800, 4200, .45, .03); T(v, { f: 95, f2: 50, t: .13, d: .3, vol: .95 }); N(v, { kind: 'brown', fl: 'lowpass', fc: 420, t: .13, d: .22, vol: .55 }); for (let i = 0; i < 3; i++) T(v, { f: 1700 + R() * 1100, t: .16 + i * .06, d: .05, vol: .08 }); };
    S.toss = v => { N(v, { kind: 'pink', fl: 'bandpass', fc: 500, fc2: 2200, q: 1, a: .08, d: .28, vol: .5 }); T(v, { f: 110, f2: 55, t: .3, d: .18, vol: .85 }); N(v, { kind: 'brown', fl: 'lowpass', fc: 500, t: .3, d: .12, vol: .5 }); for (let i = 0; i < 3; i++) T(v, { f: 1700 + i * 450, t: .32 + i * .055, d: .08, vol: .09 }); };
    S.vacOn = v => { T(v, { type: 'sawtooth', f: 60, f2: 210, d: .9, a: .05, fl: 'lowpass', fc: 400, fc2: 1400, vol: .5 }); N(v, { kind: 'pink', fl: 'bandpass', fc: 900, fc2: 2500, q: .8, d: .9, a: .1, vol: .3 }); T(v, { f: 120, f2: 420, d: .9, a: .1, vol: .15 }); };
    S.vacSnag = v => { T(v, { type: 'sawtooth', f: 190, f2: 70, d: .55, fl: 'lowpass', fc: 900, vol: .6, vib: [22, 300] }); N(v, { fl: 'bandpass', fc: 2500, q: 1, d: .4, vol: .25 }); for (const t of [0, .14, .3]) { N(v, { fl: 'bandpass', fc: 1200, q: 3, t, d: .06, vol: .5 }); T(v, { type: 'triangle', f: 180, f2: 90, t, d: .08, vol: .35 }); } };
    S.vacOff = v => { T(v, { type: 'sawtooth', f: 190, f2: 38, d: .7, fl: 'lowpass', fc: 1200, fc2: 200, vol: .5 }); N(v, { kind: 'pink', fl: 'bandpass', fc: 1800, fc2: 400, q: .8, d: .6, vol: .25 }); N(v, { fl: 'highpass', fc: 3000, a: .001, d: .02, t: .02, vol: .3 }); };
    S.mop = v => { N(v, { kind: 'pink', fl: 'bandpass', fc: 1100, fc2: 700, q: .8, a: .12, d: .35, vol: .6 }); N(v, { fl: 'highpass', fc: 3000, a: .1, d: .3, vol: .08 }); for (let i = 0; i < 3; i++) T(v, { f: 300 + R() * 200, f2: 700 + R() * 300, t: .05 + i * .1, d: .06, vol: .08 }); };
    S.bucket = v => { const f = 520; T(v, { f, d: .35, vol: .3 }); T(v, { f: f * 2.4, d: .22, vol: .18 }); T(v, { f: f * 4.1, d: .12, vol: .1 }); N(v, { kind: 'pink', fl: 'bandpass', fc: 450, q: 1, a: .05, d: .45, vol: .35 }); for (let i = 0; i < 4; i++) T(v, { f: 250 + R() * 150, f2: 620 + R() * 200, t: .1 + i * .07, d: .07, vol: .1 }); };
    S.scrub = v => { for (let i = 0; i < 6; i++) { N(v, { fl: 'bandpass', fc: i % 2 ? 3400 : 2800, q: .9, t: i * .1, a: .03, d: .08, vol: .35 }); N(v, { kind: 'pink', fl: 'highpass', fc: 800, t: i * .1, a: .03, d: .08, vol: .1 }); } };
    S.fridgeOpen = v => { N(v, { kind: 'pink', fl: 'bandpass', fc: 1500, fc2: 500, q: .7, a: .02, d: .35, vol: .5 }); T(v, { f: 70, a: .05, d: .4, vol: .3 }); T(v, { f: 800, f2: 600, d: .02, vol: .1 }); };
    S.fridgeClose = v => { T(v, { f: 100, f2: 55, d: .22, vol: .9 }); N(v, { kind: 'brown', fl: 'lowpass', fc: 350, d: .2, vol: .6 }); N(v, { fl: 'highpass', fc: 2500, t: .1, d: .03, vol: .12 }); N(v, { kind: 'pink', fl: 'bandpass', fc: 1200, t: .02, a: .02, d: .12, vol: .2 }); };
    S.disgust = v => { T(v, { type: 'sawtooth', f: 240, f2: 150, d: .65, a: .04, fl: 'bandpass', fc: 700, fc2: 350, q: 3, vol: .6, vib: [7, 60] }); T(v, { type: 'sawtooth', f: 180, f2: 110, d: .6, a: .04, det: 12, fl: 'bandpass', fc: 600, fc2: 300, q: 3, vol: .4 }); N(v, { kind: 'pink', fl: 'bandpass', fc: 500, q: 2, t: .3, d: .3, vol: .22 }); };
    S.flies = v => { T(v, { type: 'sawtooth', f: 190, a: .1, h: .9, d: .2, fl: 'bandpass', fc: 450, q: 4, vol: .35, vib: [17, 300], am: [9, .6] }); T(v, { type: 'sawtooth', f: 232, a: .15, h: .8, d: .25, fl: 'bandpass', fc: 520, q: 4, vol: .3, vib: [11, 400], am: [7, .6] }); };
    S.faucetHowl = v => { T(v, { f: 380, f2: 680, a: .15, h: .4, d: .6, fd: 1, fl: 'lowpass', fc: 1800, vol: .5, vib: [5.5, 40] }); T(v, { type: 'triangle', f: 570, f2: 1020, a: .15, h: .4, d: .6, fd: 1, fl: 'lowpass', fc: 1800, vol: .25 }); N(v, { kind: 'pink', fl: 'bandpass', fc: 3000, q: .7, a: .1, h: .9, d: .3, vol: .1 }); };
    S.water = v => { N(v, { kind: 'pink', fl: 'bandpass', fc: 1500, q: .6, a: .05, d: 1, vol: .5 }); N(v, { fl: 'highpass', fc: 4000, a: .1, d: .6, vol: .1 }); for (let i = 0; i < 6; i++) T(v, { f: 300 + R() * 300, f2: 900 + R() * 600, t: .1 + i * .12, d: .06, vol: .08 }); };
    S.drip = v => { T(v, { f: 1500, f2: 700, a: .002, d: .09, vol: .6 }); T(v, { f: 3000, f2: 1400, a: .002, d: .04, vol: .1 }); T(v, { f: 300, f2: 500, d: .06, vol: .1 }); };
    S.toiletFlush = v => { N(v, { kind: 'pink', fl: 'bandpass', fc: 350, fc2: 1100, q: .8, a: .4, d: 1.1, vol: .6 }); N(v, { kind: 'pink', fl: 'bandpass', fc: 1100, fc2: 300, q: .8, t: 1.0, a: .05, d: 1.1, vol: .45 }); T(v, { type: 'sawtooth', f: 80, a: .3, h: 1, d: .8, fl: 'lowpass', fc: 220, vol: .3, vib: [7, 500] }); N(v, { fl: 'highpass', fc: 3500, t: 1.6, a: .1, d: .9, vol: .1 }); for (let i = 0; i < 5; i++) T(v, { f: 200 + R() * 150, f2: 500 + R() * 300, t: 1.7 + i * .15, d: .07, vol: .1 }); };
    S.toiletClean = v => { for (let i = 0; i < 4; i++) N(v, { fl: 'bandpass', fc: i % 2 ? 3000 : 2400, q: .9, t: i * .11, a: .03, d: .09, vol: .3 }); N(v, { fl: 'highpass', fc: 5000, a: .02, d: .3, vol: .12 }); bell(v, 2093, .65, .22, .6); bell(v, 2637, .73, .14, .5); };
    S.button = v => { N(v, { fl: 'highpass', fc: 2500, a: .001, d: .02, vol: .5 }); T(v, { f: 1900, f2: 1100, d: .03, vol: .3 }); T(v, { f: 110, f2: 70, d: .06, vol: .5 }); N(v, { fl: 'highpass', fc: 3500, t: .07, a: .001, d: .015, vol: .25 }); T(v, { f: 1400, f2: 900, t: .07, d: .02, vol: .12 }); };
    S.printerMotor = v => { for (let i = 0; i < 12; i++) T(v, { type: 'square', f: 100 + (i % 3) * 14, t: i * .07, d: .04, fl: 'lowpass', fc: 1200, vol: .25 }); N(v, { kind: 'pink', fl: 'bandpass', fc: 600, q: .5, a: .1, h: .6, d: .2, vol: .2 }); };
    S.printerBeep = v => { T(v, { f: 1568, a: .004, d: .1, vol: .45 }); T(v, { f: 2093, t: .12, d: .16, vol: .45 }); };
    S.printerError = v => { for (let i = 0; i < 3; i++) T(v, { type: 'square', f: 740, f2: 620, t: i * .2, d: .16, fl: 'lowpass', fc: 2200, vol: .3 }); T(v, { type: 'sawtooth', f: 110, a: .02, h: .4, d: .3, fl: 'lowpass', fc: 400, vol: .2 }); };
    S.filament = v => { for (let i = 0; i < 10; i++) { T(v, { type: 'square', f: 140 + i * 14, t: i * .06, d: .035, fl: 'lowpass', fc: 1000, vol: .25 }); N(v, { fl: 'bandpass', fc: 1500, q: 2, t: i * .06, a: .001, d: .02, vol: .15 }); } N(v, { fl: 'highpass', fc: 3000, t: .75, a: .001, d: .02, vol: .4 }); T(v, { f: 2200, f2: 1500, t: .75, d: .04, vol: .15 }); T(v, { f: 100, f2: 60, t: .75, d: .1, vol: .4 }); };
    S.tubePop = v => { T(v, { f: 260, f2: 900, a: .003, d: .09, vol: .6 }); N(v, { kind: 'pink', fl: 'bandpass', fc: 2000, q: 1, a: .001, d: .05, vol: .3 }); N(v, { fl: 'highpass', fc: 3500, t: .05, d: .15, vol: .08 }); T(v, { f: 420, f2: 1100, t: .1, d: .06, vol: .15 }); };
    S.scrapeTube = v => { N(v, { fl: 'bandpass', fc: 2600, fc2: 3400, q: 2, a: .05, d: .45, vol: .35 }); N(v, { kind: 'brown', fl: 'lowpass', fc: 300, d: .4, vol: .3 }); };
    S.phoneRing = v => { for (const t of [0, .55]) { T(v, { f: 1380, t, a: .01, h: .34, d: .05, vol: .3, am: [22, .9] }); T(v, { f: 1870, t, a: .01, h: .34, d: .05, vol: .2, am: [22, .9] }); T(v, { f: 690, t, a: .01, h: .34, d: .05, vol: .15, am: [22, .9] }); } };
    S.pickupPhone = v => { N(v, { kind: 'brown', fl: 'lowpass', fc: 800, d: .1, vol: .8 }); T(v, { f: 180, f2: 90, d: .1, vol: .5 }); N(v, { fl: 'highpass', fc: 3000, t: .03, a: .001, d: .015, vol: .4 }); bell(v, 2100, 0, .08, .15); T(v, { f: 425, t: .15, a: .05, d: .25, vol: .07 }); };
    S.hangup = v => { T(v, { f: 120, f2: 60, d: .12, vol: .85 }); N(v, { kind: 'brown', fl: 'lowpass', fc: 700, d: .1, vol: .6 }); N(v, { fl: 'highpass', fc: 3200, t: .015, a: .001, d: .012, vol: .4 }); bell(v, 2400, .02, .05, .1); };
    S.landlordVoice = (v, o) => speak(v, 'landlord', o.len);
    S.danVoice = (v, o) => speak(v, 'dan', o.len);
    S.bamboulVoice = (v, o) => speak(v, 'bamboul', o.len);
    S.uiClick = v => { T(v, { f: 1300, f2: 900, a: .001, d: .035, vol: .4 }); N(v, { fl: 'highpass', fc: 4000, a: .001, d: .01, vol: .1 }); };
    S.uiBack = v => { T(v, { f: 800, f2: 480, d: .08, vol: .4 }); T(v, { f: 400, f2: 240, t: .02, d: .1, vol: .2 }); };
    S.uiHover = v => { T(v, { f: 1800, a: .004, d: .03, vol: .12 }); };
    S.taskDone = v => { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => pluck(v, f, i * .09, .38, .55)); bell(v, 2093, .3, .12, .7); };
    S.success2 = v => { pluck(v, 659.25, 0, .4, .45); pluck(v, 987.77, .1, .4, .7); };
    S.win = v => { [0, .13, .26].forEach(t => brass(v, 523.25, t, .06, .26)); [659.25, 523.25, 392, 261.63].forEach((f, i) => brass(v, f, .4, .55, i ? .2 : .28)); bell(v, 2093, 1.0, .18, .9); bell(v, 3136, 1.1, .1, .7); };
    S.bad = v => { [[233.08, 0, .3], [220, .36, .3], [207.65, .72, .3], [196, 1.08, .6]].forEach((a, i) => T(v, { type: 'sawtooth', f: a[0], f2: i === 3 ? a[0] * .8 : null, t: a[1], a: .03, h: a[2], d: .1, fd: a[2] + .3, fl: 'bandpass', fc: 500, fc2: 1100, q: 1.2, vol: .5, vib: [6, 40] })); };
    S.tick = v => { N(v, { fl: 'bandpass', fc: 1800, q: 4, a: .001, d: .02, vol: .5 }); T(v, { f: 2100, a: .001, d: .02, vol: .25 }); T(v, { f: 800, f2: 700, d: .03, vol: .15 }); };
    S.urgent = v => { [880, 660, 880].forEach((f, i) => { T(v, { type: 'square', f, t: i * .18, d: .12, fl: 'lowpass', fc: 2200, vol: .28 }); T(v, { f, t: i * .18, d: .14, vol: .2 }); }); };
    S.doorKnock = v => { [0, .19, .34].forEach(t => { T(v, { f: 190, f2: 90, t, d: .09, vol: .8 }); N(v, { kind: 'pink', fl: 'bandpass', fc: 450, q: 1.5, t, d: .07, vol: .7 }); N(v, { fl: 'highpass', fc: 2000, t, a: .001, d: .015, vol: .2 }); }); };
    S.doorBell = v => { bell(v, 659.25, 0, .4, 1.3); bell(v, 523.25, .55, .4, 1.6); };
    S.doorOpen = v => { N(v, { fl: 'highpass', fc: 2500, a: .001, d: .02, vol: .4 }); T(v, { type: 'sawtooth', f: 140, f2: 210, t: .05, a: .05, d: .5, fl: 'bandpass', fc: 600, fc2: 1100, q: 6, vol: .3, vib: [9, 80] }); N(v, { kind: 'pink', fl: 'bandpass', fc: 900, q: 1, t: .05, a: .1, d: .5, vol: .1 }); T(v, { f: 90, f2: 55, t: .6, d: .14, vol: .4 }); };
    S.tv = v => { N(v, { fl: 'bandpass', fc: 3000, q: .6, d: .15, vol: .3 }); T(v, { f: 120, f2: 70, d: .08, vol: .3 }); const sp = mkSpeaker(v, CHAR.tv); let t = v.t + .1; for (let i = 0; i < 4; i++) { const f = 120 + R() * 80; sp.syll(t, .1, f * 1.05, f * .95, CHAR.tv.vows[0 | (R() * 6)], .7); t += .12; } sp.osc.stop(t + .05); v.end = Math.max(v.end, t + .05); };
    S.sofa = v => { T(v, { f: 100, f2: 55, d: .3, vol: .85 }); N(v, { kind: 'brown', fl: 'lowpass', fc: 400, d: .3, vol: .5 }); T(v, { type: 'sawtooth', f: 320, f2: 400, t: .05, d: .12, fl: 'bandpass', fc: 900, q: 4, vol: .15 }); T(v, { type: 'sawtooth', f: 280, f2: 350, t: .17, d: .12, fl: 'bandpass', fc: 800, q: 4, vol: .12 }); };
    S.endGood = v => { [261.63, 329.63, 392, 523.25].forEach((f, i) => brass(v, f, i * .12, .1, .22)); [523.25, 659.25, 783.99, 1046.5].forEach(f => brass(v, f, .55, 1.3, .18)); for (let i = 0; i < 5; i++) bell(v, 1568 * Math.pow(1.26, i % 3), .7 + i * .16, .1, .6); T(v, { f: 130.8, t: .55, a: .1, h: 1.3, d: .5, vol: .3 }); };
    S.endOk = v => { [392, 523.25, 440, 392].forEach((f, i) => pluck(v, f, i * .2, .35, .5)); pluck(v, 523.25, .85, .4, 1.1); pluck(v, 659.25, .85, .3, 1.1); T(v, { type: 'triangle', f: 220, f2: 205, t: 1.05, a: .02, h: .3, d: .5, vol: .18 }); };
    S.endBad = v => { S.bad(v, {}); T(v, { f: 70, f2: 38, t: 1.5, d: .9, vol: .9 }); N(v, { kind: 'brown', fl: 'lowpass', fc: 300, t: 1.5, d: .7, vol: .5 }); [110, 130.8, 155.6].forEach(f => T(v, { type: 'sawtooth', f, t: 1.7, a: .15, h: 1, d: .8, fl: 'lowpass', fc: 380, vol: .22 })); };
    S.switch = v => { N(v, { fl: 'highpass', fc: 2000, a: .001, d: .02, vol: .5 }); T(v, { f: 1200, f2: 700, d: .03, vol: .3 }); T(v, { f: 150, f2: 90, t: .005, d: .06, vol: .6 }); };
    S.spray = v => { for (let i = 0; i < 2; i++) { N(v, { fl: 'highpass', fc: 4500, t: i * .28, a: .02, h: .1, d: .15, vol: .3 }); N(v, { kind: 'pink', fl: 'bandpass', fc: 6000, q: .8, t: i * .28, a: .02, h: .1, d: .15, vol: .2 }); } };
    S.wrench = v => { T(v, { f: 1300, d: .15, vol: .2 }); T(v, { f: 3300, d: .08, vol: .1 }); N(v, { fl: 'bandpass', fc: 3000, q: 3, a: .001, d: .03, vol: .4 }); for (let i = 0; i < 4; i++) { N(v, { fl: 'bandpass', fc: 2500, q: 5, t: .2 + i * .06, a: .001, d: .015, vol: .3 }); T(v, { type: 'square', f: 1900, t: .2 + i * .06, d: .012, fl: 'lowpass', fc: 2400, vol: .1 }); } };
    S.ratchet = v => { for (let i = 0; i < 6; i++) { N(v, { fl: 'bandpass', fc: 2500, q: 5, t: i * .05, a: .001, d: .015, vol: .35 }); T(v, { type: 'square', f: 1800, t: i * .05, d: .012, fl: 'lowpass', fc: 2400, vol: .1 }); } };
    S.heaterTick = v => { T(v, { f: 2800, f2: 2400, a: .001, d: .012, vol: .3 }); N(v, { fl: 'bandpass', fc: 3500, q: 3, a: .001, d: .01, vol: .3 }); };

    /* ======================================================= LOOPS (continuous, fade in/out) */
    LP.vacOn = v => { const m = loopOscLP(v, 'sawtooth', 118, .45, 700); lfo(v, .7, 3, m.s.frequency); const sq = loopOsc(v, 'square', 236, .12); lfo(v, .9, 5, sq.s.frequency); loopNoise(v, 'pink', 'bandpass', 1800, .6, .35); loopNoise(v, 'white', 'highpass', 3500, .7, .05); loopOsc(v, 'sine', 354, .06); };
    LP.mop = v => { const a = loopNoise(v, 'pink', 'bandpass', 1000, .8, .5), b = loopNoise(v, 'white', 'highpass', 3000, .7, .06); lfo(v, 1.7, .45, a.g.gain); lfo(v, 1.7, .05, b.g.gain); };
    LP.flies = v => { [[180, .9, 3.1], [205, 1.3, 2.3], [236, .7, 4.3]].forEach(a => { const o = loopOscLP(v, 'sawtooth', a[0], .22, 900); lfo(v, a[2], 35, o.s.frequency); lfo(v, a[1], .1, o.g.gain); }); };
    LP.faucetHowl = v => {
      const lp = reg(v, C.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = 1800; lp.Q.value = .8;
      const ag = reg(v, C.createGain()); ag.gain.value = .6; lp.connect(ag); ag.connect(v.in);
      const o1 = loopOsc(v, 'sine', 520, .5, lp), o2 = loopOsc(v, 'triangle', 780, .22, lp);
      for (const o of [o1, o2]) { const k = o === o1 ? 1 : 1.5; lfo(v, .42, 160 * k, o.s.frequency); lfo(v, 5.3, 14 * k, o.s.frequency); lfo(v, .13, 60 * k, o.s.frequency); }
      lfo(v, .7, .18, ag.gain); loopNoise(v, 'pink', 'bandpass', 3500, .7, .12);
    };
    LP.water = v => { loopNoise(v, 'pink', 'bandpass', 1300, .5, .6); const b = loopNoise(v, 'pink', 'bandpass', 3200, .8, .2); lfo(v, 3.7, .1, b.g.gain); loopNoise(v, 'brown', 'lowpass', 250, .7, .3); };
    LP.printerMotor = v => { const a = loopOscLP(v, 'square', 90, .65 * .25, 1100); lfo(v, .9, 35, a.s.frequency); lfo(v, 24, .05, a.g.gain); const b = loopOsc(v, 'sawtooth', 188, .1); lfo(v, 1.6, 40, b.s.frequency); loopNoise(v, 'pink', 'bandpass', 600, .5, .25); };
    LP.phoneRing = v => {
      const eg = reg(v, C.createGain()); eg.gain.value = 0; const lpf = reg(v, C.createBiquadFilter()); lpf.type = 'lowpass'; lpf.frequency.value = 3200; eg.connect(lpf); lpf.connect(v.in);
      const am = reg(v, C.createGain()); am.gain.value = .55; am.connect(eg); lfo(v, 22, .45, am.gain);
      for (const f of [[1380, .3], [1870, .2], [690, .12]]) loopOsc(v, 'sine', f[0], f[1], am);
      v.next = v.t + .02;
      v.tick = (now, hz) => { while (v.next < now + hz) { const t0 = v.next, p = eg.gain; for (const r of [0, .55]) { p.setValueAtTime(0, t0 + r); p.linearRampToValueAtTime(1, t0 + r + .012); p.setValueAtTime(1, t0 + r + .38); p.linearRampToValueAtTime(0, t0 + r + .4); } v.next += 2.8; } };
    };
    LP.tv = v => {
      loopNoise(v, 'white', 'highpass', 4200, .6, .014); const sp = mkSpeaker(v, CHAR.tv); v.spk = sp; v.next = v.t; v.nextLaugh = v.t + 3 + R() * 5;
      const lg = reg(v, C.createGain()); lg.gain.value = 0; const ln = nsrc('pink'); const lf = reg(v, C.createBiquadFilter()); lf.type = 'bandpass'; lf.frequency.value = 1500; lf.Q.value = .8; ln.connect(lf); lf.connect(lg); lg.connect(v.in); srcStart(v, ln, v.t);
      v.tick = (now, hz) => {
        if (v.next < now) v.next = now;
        while (v.next < now + hz) { const f = (R() < .5 ? 120 : 190) + R() * 40, d = .07 + R() * .08; sp.syll(v.next, d, f * 1.06, f * .94, CHAR.tv.vows[0 | (R() * 6)], .55 + R() * .4); v.next += d + (R() < .2 ? .12 + R() * .2 : .015 + R() * .03); }
        if (now > v.nextLaugh) { const t = Math.max(now, v.next), p = lg.gain; p.setValueAtTime(0, t); for (let i = 0; i < 6; i++) { p.linearRampToValueAtTime(.18, t + i * .12 + .04); p.linearRampToValueAtTime(.06, t + i * .12 + .1); } p.linearRampToValueAtTime(0, t + .9); v.nextLaugh = now + 6 + R() * 9; }
      };
    };
    LP.fridgeHum = v => { const a = loopOsc(v, 'sine', 50, .5); loopOsc(v, 'sine', 100, .18); loopOsc(v, 'sine', 150, .06); loopOscLP(v, 'sawtooth', 100, .15, 250); lfo(v, .4, .08, a.g.gain); loopNoise(v, 'pink', 'lowpass', 500, .7, .08); };
    LP.bathBuzz = v => { const b = loopOsc(v, 'square', 100, 1, null); b.g.disconnect(); const bp = reg(v, C.createBiquadFilter()); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 1.4; const g = reg(v, C.createGain()); g.gain.value = .12; b.g.connect(bp); bp.connect(g); g.connect(v.in); loopOsc(v, 'sine', 100, .06); loopOsc(v, 'sine', 200, .03); lfo(v, 7.3, .03, g.gain); };
    LP.workFans = v => { loopNoise(v, 'pink', 'bandpass', 400, .6, .4); const b = loopNoise(v, 'pink', 'bandpass', 900, .7, .15); lfo(v, .27, .08, b.g.gain); loopOsc(v, 'sine', 80, .1); const c = loopOsc(v, 'sine', 161, .05); lfo(v, .3, 1.5, c.s.frequency); };
    // room beds (auto-crossfaded by camera position)
    LP.amb_hall = v => { const a = loopNoise(v, 'pink', 'lowpass', 280, .7, .5); lfo(v, .13, .18, a.g.gain); loopOsc(v, 'sine', 55, .08); const w = loopNoise(v, 'white', 'bandpass', 1100, 12, .05); lfo(v, .21, .03, w.g.gain); };
    LP.amb_living = v => { LP.tv(v); loopNoise(v, 'brown', 'lowpass', 160, .7, .45); loopNoise(v, 'pink', 'bandpass', 700, .4, .05); };
    LP.amb_kitchen = v => { LP.fridgeHum(v); loopNoise(v, 'pink', 'bandpass', 1500, .5, .03); };
    LP.amb_bath = v => { LP.bathBuzz(v); loopNoise(v, 'pink', 'lowpass', 400, .6, .1); v.nextDrip = v.t + 1 + R() * 2; v.tick = now => { if (now > v.nextDrip) { play('drip', { vol: .7, bus: ambBus }); v.nextDrip = now + 2 + R() * 3.5; } }; };
    LP.amb_work = v => { LP.workFans(v); loopNoise(v, 'white', 'highpass', 5000, .6, .01); };

    /* ======================================================= spatialisation */
    function roomIdAt(x) { const L = BB.LAYOUT; return L && L.roomOf ? L.roomOf(x).id : 'hall'; }
    const camX = () => (BB.cam && typeof BB.cam.x === 'number') ? BB.cam.x : 0;
    function spat(x) {
      if (typeof x === 'function') x = x();
      const dx = x - camX(), ad = Math.abs(dx); const same = roomIdAt(x) === roomIdAt(camX());
      let g = 1 / (1 + Math.pow(ad / 520, 1.4)); if (!same) g *= .7;
      let fc = 16000 / (1 + ad / 380); if (!same) fc = Math.min(fc, 800 + 600 / (1 + ad / 700)); fc = clamp(fc, 600, 16000);
      return { g: Math.max(g, .04), pan: clamp(dx / 650, -1, 1) * .85, fc };
    }
    function chainFor(v, bus, o, name, isLoop) {
      let tail = v.out; let g = 1;
      if (o.x != null || isLoop) {
        const sp = o.x != null ? spat(o.x) : { g: 1, pan: 0, fc: 18000 }; g = sp.g;
        v.lpf = reg(v, C.createBiquadFilter()); v.lpf.type = 'lowpass'; v.lpf.frequency.value = sp.fc; v.lpf.Q.value = .5; v.out.connect(v.lpf); tail = v.lpf;
        if (C.createStereoPanner) { v.pan = reg(v, C.createStereoPanner()); v.pan.pan.value = sp.pan; tail.connect(v.pan); tail = v.pan; }
        v.spx = o.x;
      }
      tail.connect(bus);
      const w = (o.wet != null ? o.wet : WET[name]) || 0;
      if (w > 0) { const sg = reg(v, C.createGain()); sg.gain.value = w; v.out.connect(sg); sg.connect(revIn); }
      v.vol = (o.vol == null ? 1 : o.vol) * trimOf(isLoop ? 'L_' + name : name);
      v.out.gain.value = v.vol * g;
    }

    /* ======================================================= engine ops */
    const startTime = o => C.currentTime + (o.delay || 0) + (offline ? 0 : .006);
    function emitSub(name, o) { if (cfg().subs && !(o && o.silent) && SUB[name] && BB.emit) { try { BB.emit('sfx', { name, sub: SUB[name] }); } catch (e) { } } }
    function play(name, o) {
      o = o || {}; const fn = S[name]; if (!fn) return false;
      const now = C.currentTime;
      if (!offline) {
        if (C.state !== 'running') return false;
        const gap = GAP[name] != null ? GAP[name] : .02; if (lastPlay[name] != null && now - lastPlay[name] < gap) return false;
        if (live >= MAXV + (PRIO[name] ? 10 : 0)) return false;
      }
      lastPlay[name] = now;
      const v = newV(startTime(o));
      try {
        v.rate = o.rate || 1;
        chainFor(v, o.bus || sfxBus, o, name, false);
        fn(v, o);
        if (v.n === 0) { kill(v); return false; }
      } catch (e) { kill(v); if (typeof console !== 'undefined') console.warn('[audio] ' + name, e); return false; }
      return true;
    }
    function sfx(name, o) {
      o = o || {};
      if (!S[name]) { if (LP[name] && name.indexOf('amb_') !== 0) { emitSub(name, o); loop(name, true, Object.assign({ silent: true }, o)); setTimeout(() => stopLoop(name), (o.dur || 1.6) * 1000); return true; } return false; }
      emitSub(name, o);
      return play(name, o);
    }
    function loop(name, on, o) {
      o = o || {}; const f = LP[name]; if (!f) return false;
      const l = loops[name];
      if (on) {
        if (l && !l.dying) { l.opt = o; if (o.x != null) l.spx = o.x; if (o.vol != null) l.vol = o.vol * trimOf('L_' + name); return true; }
        if (!offline && C.state !== 'running') return false;
        if (Object.keys(loops).length >= MAXL) return false;
        emitSub(name, o);
        const v = newV(startTime(o)); loops[name] = v; v.name = name; v.opt = o;
        try {
          const lf = reg(v, C.createGain()); lf.gain.value = 0; lf.gain.setTargetAtTime(1, v.t, .09); lf.connect(v.out); v.in = lf; v.fade = lf;
          chainFor(v, o.bus || (name.indexOf('amb_') === 0 ? ambBus : sfxBus), o, name, true); v.base = v.vol;
          f(v, o); if (v.tick) v.tick(C.currentTime, offline ? 8 : .8);
        } catch (e) { kill(v); delete loops[name]; console.warn('[audio] loop ' + name, e); return false; }
        return true;
      }
      if (l) stopLoop(name);
      return true;
    }
    function stopLoop(name, fast) {
      const l = loops[name]; if (!l || l.dying) return; l.dying = true; delete loops[name];
      const t = C.currentTime, tau = fast ? .03 : .09;
      try { l.fade.gain.cancelScheduledValues(t); l.fade.gain.setTargetAtTime(0, t, tau); } catch (e) { }
      const endT = t + tau * 7 + .02; for (const s of l.srcs) { try { s.stop(endT); } catch (e) { } }
      l.killAt = endT;
    }

    /* ---------------- ambience: beds per room, crossfaded by BB.cam.x */
    let ambOn = true, lastUpd = 0, curWet = .1;
    function updateAmbience(dt) {
      const L = BB.LAYOUT; if (!L) return; const cx = camX(); let sum = 0; const w = {};
      for (const r of L.rooms) { const d = cx < r.x0 ? r.x0 - cx : cx > r.x1 ? cx - r.x1 : 0; const k = ambOn ? Math.max(0, 1 - d / 260) : 0; w[r.id] = k; sum += k; }
      let wet = 0;
      for (const r of L.rooms) {
        const nrm = sum > 0 ? w[r.id] / sum : 0, name = 'amb_' + r.id; wet += nrm * (ROOMWET[r.id] || .1);
        let l = loops[name];
        if (nrm > .02 && !l && (C.state === 'running' || offline)) { loop(name, true, { silent: true }); l = loops[name]; }
        if (l && nrm <= .02) stopLoop(name);
        else if (l) l.out.gain.setTargetAtTime(l.base * nrm, C.currentTime, .25);
      }
      curWet += (wet - curWet) * Math.min(1, dt * 2); revWet.gain.setTargetAtTime(curWet, C.currentTime, .1);
    }
    function update(dt) {
      dt = dt || .016; const now = C.currentTime; lastUpd = performance.now();
      applyVolumes();
      for (const name in loops) {
        const l = loops[name]; if (l.tick) l.tick(now, .8);
        if (l.spx != null && !l.dying) {
          const sp = spat(l.spx); l.out.gain.setTargetAtTime((l.vol != null ? l.vol : l.base) * sp.g, now, .08);
          l.pan && l.pan.pan.setTargetAtTime(sp.pan, now, .08); l.lpf && l.lpf.frequency.setTargetAtTime(sp.fc, now, .1);
        } else if (name.indexOf('amb_') !== 0 && !l.dying && l.vol != null) l.out.gain.setTargetAtTime(l.vol, now, .08);
      }
      updateAmbience(dt);
      M.I += (M.tI - M.I) * Math.min(1, dt * 1.2);
    }
    function watchdog() {
      const now = C.currentTime;
      for (const v of Array.from(voices)) { if (v.killAt && now > v.killAt + .5) kill(v); else if (!v.name && v.end > 0 && now > v.end + 3) kill(v); }
      if (lastUpd && performance.now() - lastUpd > 1500) for (const n of Object.keys(loops)) if (n.indexOf('amb_') === 0) stopLoop(n);   // game not ticking (menu): let the beds go
    }

    /* ======================================================= MUSIC */
    const M = { on: false, step: 0, next: 0, I: .2, tI: .2, gate: null, key: 0, pending: false };
    const BASS = [0, null, 0, null, 0, null, 12, 0, null, 0, null, 3, 5, null, 3, null];
    const BASS2 = [0, null, null, 0, null, 7, null, 0, 5, null, 0, null, 3, null, 5, 6];
    const CHORD = [0, 0, -2, 5];
    const LEAD = [[[0, 19], [2, 22], [3, 19], [6, 17], [8, 19], [10, 15]], [[0, 22], [1, 22], [4, 24], [6, 22], [8, 19], [9, 18], [10, 19]]];
    const bpmNow = () => 98 + 54 * clamp(M.I, 0, 1);
    function musStep(s, t, I) {
      const bar = (s >> 4) & 3, st = s & 15, sd = 60 / bpmNow() / 4;
      const v = newV(t); v.out.gain.value = trimOf('music'); v.out.connect(M.gate); const lpR = 1 + I * 1.8;
      const root = 33 + M.key + CHORD[bar];
      const bn = ((bar & 1) ? BASS2 : BASS)[st];
      if (bn != null) {
        const prio = (st % 8 === 0) ? 1 : (st % 4 === 0 || st === 3 || st === 6 || st === 11) ? 2 : 3;
        if (prio <= 1 + Math.round(I * 2.2)) {
          const dur = sd * 1.7;
          T(v, { type: 'sawtooth', f: mtof(root + 12 + bn), a: .006, h: dur * .4, d: dur * .6, fl: 'lowpass', fc: 380 * lpR * 2.6, fc2: 380 * lpR, q: 2.5, vol: .5 });
          T(v, { type: 'sine', f: mtof(root + bn), a: .008, h: dur * .4, d: dur * .6, vol: .55 });
        }
      }
      const kicks = I < .25 ? [0, 8] : I < .6 ? [0, 6, 8] : [0, 3, 6, 8, 11, 14];
      if (kicks.indexOf(st) >= 0) { T(v, { f: 150, f2: 44, d: .13, vol: .9 }); N(v, { fl: 'lowpass', fc: 900, a: .001, d: .015, vol: .25 }); }
      if (st === 4 || st === 12) { N(v, { fl: 'bandpass', fc: 1800, q: .8, a: .001, d: .13, vol: .5 }); T(v, { type: 'triangle', f: 190, f2: 120, d: .08, vol: .35 }); }
      else if (I > .5 && (st === 7 || st === 15)) N(v, { fl: 'bandpass', fc: 1800, q: .8, a: .001, d: .06, vol: .14 });
      if (I < .3 ? (st % 2 === 0) : true) { const acc = st % 4 === 2 ? 1.4 : 1, open = I > .55 && st === 14; N(v, { fl: 'highpass', fc: 7000, a: .001, d: open ? .09 : .025, vol: (I < .3 ? .16 : .12) * acc }); }
      if (I > .7 && st % 4 === 2) { T(v, { type: 'square', f: 810, a: .001, d: .05, fl: 'bandpass', fc: 810, q: 3, vol: .2 }); T(v, { type: 'square', f: 1215, a: .001, d: .05, fl: 'bandpass', fc: 1215, q: 3, vol: .12 }); }
      if (I > .12 && (st === 2 || st === 10) && (bar === 0 || bar === 2)) for (const n of [3, 6, 10]) T(v, { type: 'sawtooth', f: mtof(root + 24 + n), a: .004, d: .12, fl: 'lowpass', fc: 1700, q: 1, vol: .11 });
      if ((bar === 1 && I > .15) || (bar === 3 && I > .35)) for (const nn of LEAD[bar === 1 ? 0 : 1]) if (nn[0] === st) {
        const f = mtof(root + 12 + nn[1]); T(v, { type: 'square', f, a: .004, h: sd * .5, d: sd * 1.1, fl: 'lowpass', fc: 2400, q: 1, vol: .17, vib: [6, 18] }); T(v, { type: 'triangle', f: f * 2, a: .004, d: sd, vol: .06 });
      }
      if (I > .78 && st % 2 === 0) N(v, { fl: 'bandpass', fc: 2600, q: 4, a: .001, d: .015, vol: .12 });
      if (v.n === 0) kill(v);
    }
    function musSched(until) {
      if (!M.on) return; const now = C.currentTime;
      if (!offline && M.next < now - .15) M.next = now + .03;
      let guard = 0;
      while (M.next < until && guard++ < (offline ? 5000 : 64)) {
        if ((M.step & 15) === 0) M.key = [0, 0, 2, 3][Math.min(3, Math.floor(M.I * 3.99))];
        musStep(M.step, M.next, M.I);
        const sw = .1 * (1 - M.I); M.next += 60 / bpmNow() / 4 * ((M.step & 1) ? 1 - sw : 1 + sw); M.step = (M.step + 1) & 63;
      }
    }
    let musTimer = null;
    function music(on, intensity) {
      if (intensity != null) M.tI = clamp(+intensity || 0, 0, 1);
      if (on === false) { musicStop(); return; }
      if (on == null || M.on) return;
      if (!offline && C.state !== 'running') { M.pending = true; return; }
      M.pending = false; M.on = true; M.I = M.tI; M.step = 0; M.next = C.currentTime + .08; M.key = 0;
      M.gate = C.createGain(); M.gate.gain.value = 0; M.gate.gain.setTargetAtTime(1, C.currentTime, .15); M.gate.connect(musBus);
      musTimer = setInterval(() => musSched(C.currentTime + .35), 80); musSched(C.currentTime + .35);
    }
    function musicStop() {
      M.pending = false; if (!M.on) return; M.on = false; if (musTimer) { clearInterval(musTimer); musTimer = null; }
      const g = M.gate; M.gate = null; if (!g) return;
      try { g.gain.cancelScheduledValues(C.currentTime); g.gain.setTargetAtTime(0, C.currentTime, .12); } catch (e) { }
      setTimeout(() => { try { g.disconnect(); } catch (e) { } }, 1500);
    }
    function renderMusic(I, secs) { M.tI = M.I = I; M.on = true; M.gate = C.createGain(); M.gate.gain.value = 1; M.gate.connect(musBus); M.step = 0; M.next = .01; M.key = 0; musSched(secs); }

    function stopAll() { musicStop(); for (const n of Object.keys(loops)) stopLoop(n, true); }
    function stepSfx(roomId, run) { return play('step', { surface: SURF[roomId] || 'wood', run: !!run, vol: run ? 1.12 : .88 }); }

    return {
      S, LP, play, sfx, loop, stopLoop, music, musicStop, stopAll, update, watchdog, applyVolumes, stepSfx, renderMusic, loops, M,
      ambience: on => { ambOn = on !== false; },
      get live() { return live; }, get peakLive() { return peakLive; }, buses: { sfxBus, musBus, ambBus, mix, master, out: outNode }, ctx: C, spat
    };
  }

  /* ============================================================ FACADE */
  let eng = null, ctx = null, started = false, wired = false, names = null;
  const A = BB.audio = BB.audio || {};
  function hookUp() { if (!wired && BB.hooks && BB.hooks.update) { wired = true; BB.hooks.update.push(dt => { try { A.update(dt); } catch (e) { } }); } }
  hookUp();
  let gestureBound = false;
  function bindGesture() {
    if (gestureBound) return; gestureBound = true;
    const evs = ['pointerdown', 'keydown', 'touchstart', 'mousedown'];
    const f = () => { A.init(); if (ctx && ctx.state === 'running') { evs.forEach(e => window.removeEventListener(e, f, true)); gestureBound = false; } };
    evs.forEach(e => window.addEventListener(e, f, true));
  }
  A.init = function () {
    hookUp();
    if (!eng) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
      try { ctx = new AC({ latencyHint: 'interactive' }); eng = Engine(ctx, {}); } catch (e) { ctx = null; eng = null; return false; }
      ctx.onstatechange = () => { if (ctx.state === 'running' && eng.M.pending) eng.music(true); };
      document.addEventListener('visibilitychange', () => { if (!ctx || !started) return; if (document.hidden) ctx.suspend().catch(() => { }); else ctx.resume().catch(() => { }); });
      setInterval(() => { if (eng) eng.watchdog(); }, 500);
    }
    if (ctx.state !== 'running') { ctx.resume().catch(() => { }); bindGesture(); }
    started = true; return true;
  };
  A.resume = function () { if (!eng) return A.init(); ctx.resume().catch(() => { }); started = true; return true; };
  A.sfx = function (name, o) {
    if (!eng) { if (BB.CFG && BB.CFG.subs && SUB[name] && BB.emit && !(o && o.silent)) BB.emit('sfx', { name, sub: SUB[name] }); return false; }
    try { return eng.sfx(name, o); } catch (e) { return false; }
  };
  A.loop = function (name, on, o) { if (!eng) return false; try { return eng.loop(name, on !== false, o); } catch (e) { return false; } };
  A.music = function (on, intensity) { if (eng) try { eng.music(on, intensity); } catch (e) { } };
  A.ambience = function (on) { if (eng) eng.ambience(on); };
  A.step = function (roomId, run) { if (eng) try { eng.stepSfx(roomId, run); } catch (e) { } };
  A.voice = function (who, len) { return A.sfx(who === 'landlord' ? 'landlordVoice' : who === 'dan' ? 'danVoice' : who === 'bamboul' ? 'bamboulVoice' : who, { len }); };
  A.setVolume = function (kind, v) {
    v = clamp(+v, 0, 1); const key = (kind === 'master' || kind === 'vol') ? 'vol' : (kind === 'music' || kind === 'sfx') ? kind : null; if (!key) return;
    BB.CFG = BB.CFG || {}; BB.CFG[key] = v; if (eng) eng.applyVolumes();
  };
  A.getVolume = function (kind) { const c = BB.CFG || {}; const k = kind === 'master' ? 'vol' : kind; const d = { vol: .8, music: .7, sfx: .9 }; return c[k] == null ? d[k] : c[k]; };
  A.stopAll = function () { if (eng) eng.stopAll(); };
  A.update = function (dt) { if (eng) eng.update(dt); };
  function scanNames() {
    if (names) return names; names = { sfx: [], loops: [], amb: [] };
    try {
      const e = Engine(new OfflineAudioContext(1, 128, 8000), { offline: true, raw: true });
      names.sfx = Object.keys(e.S); for (const n of Object.keys(e.LP)) (n.indexOf('amb_') === 0 ? names.amb : names.loops).push(n);
    } catch (err) { console.warn('[audio] name scan', err); }
    return names;
  }
  A.isLoop = n => scanNames().loops.indexOf(n) >= 0;
  A.subtitleFor = name => SUB[name] || null;
  A.list = function () {
    const n = scanNames();
    return { sfx: n.sfx.slice(), loops: n.loops.slice(), voices: ['landlordVoice', 'danVoice', 'bamboulVoice'], ambience: n.amb.slice(), music: true, all: n.sfx.concat(n.loops.filter(x => n.sfx.indexOf(x) < 0)) };
  };
  A.stats = () => eng ? { live: eng.live, peak: eng.peakLive, loops: Object.keys(eng.loops), state: ctx.state, music: eng.M.on } : { live: 0, loops: [], state: 'none' };
  Object.defineProperty(A, 'ctx', { get: () => ctx, configurable: true });
  Object.defineProperty(A, 'engine', { get: () => eng, configurable: true });
  A._Engine = Engine; A._SUB = SUB; A._TRIM = TRIM; A._ROOMWET = ROOMWET;
})();

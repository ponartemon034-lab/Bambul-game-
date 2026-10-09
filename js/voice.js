/* ==========================================================================
   BB.voice - spoken Russian lines through the browser's speech synthesis (Web Speech API).
   No audio files: uses the voices installed on the player's device. Each speaker gets its own
   pitch/rate (and a different voice when the device has several Russian ones).
   ========================================================================== */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const ss = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
  const PROFILE = { bamboul: { pitch: .82, rate: 1.08 }, landlord: { pitch: .45, rate: .98 }, dan: { pitch: 1.0, rate: 1.12 }, narr: { pitch: 1, rate: 1.05 } };
  let voices = [], last = '', lastT = 0, MAN = null, cur = null;
  /* pre-generated clips (Piper, tools/gen_voice.py): manifest maps fnv1a(who|normalized text) -> mp3 */
  const norm = t => String(t).trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
  function fnv(str) { let h = 0x811c9dc5; for (const ch of str) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }
  try { fetch('assets/voice/manifest.json').then(r => r.ok ? r.json() : null).then(m => { MAN = m; }).catch(() => { }); } catch (e) { }
  function load() { if (!ss) return; voices = ss.getVoices().filter(v => /^ru/i.test(v.lang)); }
  if (ss) { load(); if (ss.addEventListener) ss.addEventListener('voiceschanged', load); }
  function pickVoice(who) {
    if (!voices.length) return null;
    const male = voices.filter(v => /pavel|yuri|dmitri|dmitry|maxim|ivan|male|мужск/i.test(v.name));
    const pool = male.length ? male : voices; const order = { bamboul: 0, landlord: 1, dan: 2, narr: 0 }[who] || 0;
    return pool[order % pool.length];
  }
  const on = () => !!ss && !(BB.CFG && BB.CFG.voice === false) && !BB.paused;
  BB.voice = {
    available: !!ss,
    speak(text, who) {
      if (!on() || !text) return; who = PROFILE[who] ? who : 'bamboul';
      const rawKey = fnv(who + '|' + norm(text)), clip = MAN && MAN[rawKey];
      if (clip && typeof Audio !== 'undefined' && !(BB.CFG && BB.CFG.voice === false)) {
        try { if (cur) { cur.pause(); cur = null; } ss && ss.cancel(); const a = new Audio('assets/voice/' + clip); a.volume = Math.max(0, Math.min(1, (BB.CFG && BB.CFG.vol != null ? BB.CFG.vol : .7) * (BB.CFG && BB.CFG.voiceVol != null ? BB.CFG.voiceVol : 1) * 1.3)); cur = a; BB.voice.stats.clip++; a.play().catch(() => { cur = null; }); return; } catch (e) { /* fall through to speech */ }
      }
      BB.voice.stats.fallback++;
      const clean = String(text).replace(/\*+/g, '').replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, '').replace(/\s+/g, ' ').trim(); if (!clean) return;
      const now = performance.now(); if (clean === last && now - lastT < 1500) return; last = clean; lastT = now;
      try {
        ss.cancel();
        const u = new SpeechSynthesisUtterance(clean), p = PROFILE[who], v = pickVoice(who);
        u.lang = 'ru-RU'; if (v) u.voice = v; u.pitch = p.pitch; u.rate = p.rate; u.volume = Math.max(0, Math.min(1, (BB.CFG && BB.CFG.vol != null ? BB.CFG.vol : .7) * (BB.CFG && BB.CFG.voiceVol != null ? BB.CFG.voiceVol : 1) * 1.25));
        // shouting lines (mostly capitals) get louder and faster
        const caps = clean.replace(/[^А-ЯЁA-Z]/g, '').length / Math.max(1, clean.replace(/[^А-Яа-яЁёA-Za-z]/g, '').length); if (caps > .6) { u.rate += .12; u.pitch += .12; u.volume = 1; }
        ss.speak(u);
      } catch (e) { /* speech is a bonus: never break the game */ }
    },
    isSpeaking() { return !!(cur && !cur.paused && !cur.ended) || !!(ss && ss.speaking); },
    stats: { clip: 0, fallback: 0 },
    stop() { try { ss && ss.cancel(); if (cur) { cur.pause(); cur = null; } } catch (e) { } },
    _key: (who, text) => fnv(who + '|' + norm(text))
  };
})();

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
  let voices = [], last = '', lastT = 0;
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
      const clean = String(text).replace(/\*+/g, '').replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, '').replace(/\s+/g, ' ').trim(); if (!clean) return;
      const now = performance.now(); if (clean === last && now - lastT < 1500) return; last = clean; lastT = now;
      try {
        ss.cancel();
        const u = new SpeechSynthesisUtterance(clean), p = PROFILE[who], v = pickVoice(who);
        u.lang = 'ru-RU'; if (v) u.voice = v; u.pitch = p.pitch; u.rate = p.rate; u.volume = Math.max(0, Math.min(1, (BB.CFG && BB.CFG.vol != null ? BB.CFG.vol : .7) * 1.25));
        // shouting lines (mostly capitals) get louder and faster
        const caps = clean.replace(/[^А-ЯЁA-Z]/g, '').length / Math.max(1, clean.replace(/[^А-Яа-яЁёA-Za-z]/g, '').length); if (caps > .6) { u.rate += .12; u.pitch += .12; u.volume = 1; }
        ss.speak(u);
      } catch (e) { /* speech is a bonus: never break the game */ }
    },
    stop() { try { ss && ss.cancel(); } catch (e) { } }
  };
})();

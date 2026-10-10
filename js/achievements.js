/* ==========================================================================
   BB.ach - medals, personal bests and the daily run.
   Medals are judged once, when a run ends (BB.emit('story:end', {score, stats, ending})), and stored in
   localStorage 'bamboul.ach'. The result screen asks BB.ach.html() for this run's medals.
   Daily run: one seed for everybody per calendar day (BB.ach.dailySeed()); best score is kept per day.
   ========================================================================== */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const KEY = 'bamboul.ach';
  const MEDALS = [
    { id: 'shine', ico: '✨', name: 'Чистюля', text: 'Чистота 90% и выше', test: r => r.score >= 90 },
    { id: 'ok', ico: '🙂', name: 'Жить можно', text: 'Чистота 60% и выше', test: r => r.score >= 60 },
    { id: 'museum', ico: '🏛', name: 'Музей катастроф', text: 'Хозяин ушёл за участковым', test: r => r.ending === 'museum' },
    { id: 'early', ico: '⏱', name: 'Успел с запасом', text: 'Встретил хозяина раньше срока при чистоте 85%+', test: r => r.stats.early && r.score >= 85 },
    { id: 'sofa', ico: '🛋', name: 'Диванный стратег', text: 'Так и не встал', test: r => r.ending === 'sofa' },
    { id: 'mortgage', ico: '🏠', name: 'Ипотека', text: 'Хозяин предложил купить квартиру', test: r => r.ending === 'mortgage' },
    { id: 'honest', ico: '🤝', name: 'Честный мудак', text: 'Не соврал ни разу и взял все звонки', test: r => r.stats.lies === 0 && r.stats.missed === 0 && r.stats.answered >= 3 && r.score >= 60 },
    { id: 'liar', ico: '🤥', name: 'Врун-виртуоз', text: 'Соврал хозяину два раза и больше', test: r => r.stats.lies >= 2 },
    { id: 'solo', ico: '📵', name: 'Сам с усами', text: 'Ни разу не звонил Дэну, чистота 75%+', test: r => r.stats.hints === 0 && r.score >= 75 },
    { id: 'flood', ico: '🌊', name: 'Потоп пережил', text: 'Три поломки за забег и чистота 70%+', test: r => r.chaos >= 3 && r.score >= 70 },
    { id: 'panic', ico: '🔥', name: 'Паника', text: 'Режим «5 минут» и чистота 80%+', test: r => r.stats.total === 300 && r.score >= 80 },
    { id: 'lazy', ico: '😴', name: 'Лежебока', text: 'Поваляться на диване, у ТВ и за компом 5 раз', test: r => r.stats.lazy >= 5 },
    { id: 'iron', ico: '💪', name: 'Железный Бамбуль', text: 'Ни разу не присел отдохнуть, чистота 80%+', test: r => r.stats.lazy === 0 && r.score >= 80 },
    { id: 'daily', ico: '📅', name: 'Забег дня', text: 'Прошёл ежедневный забег', test: r => !!r.daily }
  ];
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const save = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { } };
  const ymd = (d) => { d = d || new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
  let last = { earned: [], fresh: [] };

  const ach = BB.ach = {
    MEDALS,
    dailySeed: () => ymd() * 7 + 13,
    dailyId: () => ymd(),
    data: load,
    last: () => last,
    judge(res, S) {
      const r = { score: res.score, stats: res.stats || {}, ending: res.ending && res.ending.id, chaos: S && S.chaos ? S.chaos.n : 0, daily: S && S.daily };
      const d = load(); d.got = d.got || {}; d.runs = (d.runs || 0) + 1;
      const earned = MEDALS.filter(m => { try { return m.test(r); } catch (e) { return false; } }), fresh = [];
      for (const m of earned) if (!d.got[m.id]) { d.got[m.id] = Date.now(); fresh.push(m); }
      if (r.daily) { d.daily = d.daily || {}; d.daily[r.daily] = Math.max(d.daily[r.daily] || 0, r.score); }
      d.best = d.best || {}; const k = String(r.stats.total || 480); d.best[k] = Math.max(d.best[k] || 0, r.score);
      save(d); last = { earned, fresh, score: r.score, daily: r.daily, dailyBest: r.daily ? d.daily[r.daily] : null };
      return last;
    },
    html() {
      if (!last.earned.length && !last.daily) return '';
      const li = m => '<li class="' + (last.fresh.includes(m) ? 'new' : '') + '"><span class="mi">' + m.ico + '</span><span><b>' + m.name + '</b><small>' + m.text + '</small></span>' + (last.fresh.includes(m) ? '<i class="rec">новая!</i>' : '') + '</li>';
      return '<div class="medals"><h4>Медали за забег' + (last.daily ? ' · ежедневный забег, лучший: ' + last.dailyBest + '%' : '') + '</h4><ul>' + (last.earned.length ? last.earned.map(li).join('') : '<li class="none"><span>Сегодня без медалей. Хозяин не впечатлён.</span></li>') + '</ul></div>';
    },
    allHtml() {
      const d = load(), got = d.got || {};
      return '<ul class="medal-all">' + MEDALS.map(m => '<li class="' + (got[m.id] ? 'got' : 'lock') + '"><span class="mi">' + (got[m.id] ? m.ico : '🔒') + '</span><span><b>' + m.name + '</b><small>' + m.text + '</small></span></li>').join('') + '</ul>' +
        '<p class="fine">Открыто ' + Object.keys(got).length + ' из ' + MEDALS.length + ' · забегов: ' + (d.runs || 0) + '</p>';
    },
    reset() { try { localStorage.removeItem(KEY); } catch (e) { } last = { earned: [], fresh: [] }; }
  };
  BB.on('story:end', res => { try { const S = BB.S; const L = ach.judge(res, S); L.fresh.forEach((m, i) => setTimeout(() => { BB.ui && BB.ui.toast && BB.ui.toast('Медаль: ' + m.name); }, 1400 + i * 900)); } catch (e) { console.error('[ach]', e); } });
})();

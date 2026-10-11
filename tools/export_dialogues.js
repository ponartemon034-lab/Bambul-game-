// Usage: node tools/export_dialogues.js [out.txt]
// Dumps every spoken line and scripted dialogue of the game into one readable text file, grouped by hero, by action and by story.
const { chromium } = require('./_pw');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), OUT = process.argv[2] || path.join(root, 'docs', 'bambul_dialogues.txt');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };

/* ---- how categories are grouped in the file: [regex on category id, section id, title] (first match wins) ---- */
const GROUPS = [
  ['A1', 'Хождение по хате: ворчание, настроение, паника (самые частые реплики)', /^pain:/],
  ['A2', 'Безделье, лень, усталость, отмазки', /^(idle|tired$|wait$|chore:avoid$|oops$)/],
  ['A3', 'Вход в комнату', /^roomEnter:/],
  ['A4', 'Мусор, одежда, мешок и бак, коробки', /^(pickup|bagFull|toss|noTrash|cloth|clothIn|noClothes|stash|boom|boxes:)/],
  ['A5', 'Пылесос', /^vac:/], ['A6', 'Швабра и мытьё пола', /^mop:/], ['A7', 'Холодильник', /^fridge:/],
  ['A8', 'Кран в ванной', /^faucet:/], ['A9', 'Унитаз', /^toilet:/], ['A10', '3D-принтер', /^printer:/],
  ['A11', 'Посуда, зеркало, плита, ванна', /^(dishes|mirror|stove|tub)$/], ['A12', 'Стиральная машина', /^laundry:/],
  ['A13', 'Инструменты и «мне это сейчас не взять»', /^(tool:|needTool:|unavailable|spam)/],
  ['A14', 'Диван, телевизор, компьютер (прокрастинация)', /^(sofa|tv:|pc)$|^tv:/],
  ['A15', 'Прыжки', /^(jump|land)$/], ['A16', 'Телефон и входная дверь', /^(phone:|door:|owner:|allDone)/],
  ['A17', 'Давление времени: 5 минут, 2 минуты, минута, 30 секунд, 10 секунд', /^time:/],
  ['A18', 'Итоги: успех, провал, оценка чистоты', /^(success|fail|cleanHigh|cleanLow)$/],
  ['A19', 'Хаос: хата ломается сама', /^chaos:/]
];
const CAT_RU = {
  'idle': 'Простой, обычные отмазки', 'idle:l1': 'Лестница лени, ступень 1 (слегка)', 'idle:l2': 'Лестница лени, ступень 2', 'idle:l3': 'Лестница лени, ступень 3', 'idle:l4': 'Лестница лени, ступень 4', 'idle:l5': 'Лестница лени, ступень 5 (дно)',
  'pain:walk:early': 'Идёт по хате: времени много (больше 60%), ноет и тянет', 'pain:walk:mid': 'Идёт по хате: середина (25–60%), нервничает', 'pain:walk:late': 'Идёт по хате: времени мало (меньше 25%), паника и ярость',
  'pain:drink': 'Хочется бухать и нихуя не делать', 'pain:owner': 'Злость на хозяина', 'pain:lazy': 'Лень и нежелание', 'pain:pain': 'Экзистенциальная боль, чёрный юмор',
  'pain:room:hall': 'Идёт по прихожей', 'pain:room:living': 'Идёт по гостиной', 'pain:room:kitchen': 'Идёт по кухне', 'pain:room:bath': 'Идёт по ванной', 'pain:room:work': 'Идёт по мастерской',
  'move': 'Старое ворчание при ходьбе (отключено, строки перенесены в pain:walk:early / mid)', 'tired': 'Устал (раз в ~100 секунд)', 'wait': 'Стоит и ничего не делает', 'chore:avoid': 'Не хочет браться за уборку', 'oops': 'Что-то не получилось',
  'roomEnter:hall': 'Вошёл в прихожую', 'roomEnter:living': 'Вошёл в гостиную', 'roomEnter:kitchen': 'Вошёл на кухню', 'roomEnter:bath': 'Вошёл в ванную', 'roomEnter:work': 'Вошёл в мастерскую',
  'pickup': 'Подобрал мусор', 'bagFull': 'Мешок полон', 'toss': 'Бросил мусор в мешок или бак', 'noTrash': 'Мусора рядом нет', 'cloth': 'Подобрал шмотку', 'clothIn': 'Закинул шмотки в стиралку', 'noClothes': 'Шмоток нет',
  'stash': 'Спрятал мусор в шкаф', 'boom': 'Шкаф не выдержал', 'boxes:jump': 'Коробки мешают, надо прыгать', 'boxes:cleared': 'Коробки разобраны',
  'vac:start': 'Включил пылесос', 'vac:run': 'Пылесосит', 'vac:snag': 'Пылесос зажевал шнур', 'vac:stuck': 'Пылесос застрял', 'vac:unjam': 'Расчистил засор', 'vac:done': 'Закончил пылесосить',
  'mop:start': 'Взялся за швабру', 'mop:run': 'Моет пол', 'mop:wet': 'Поскользнулся на мокром', 'mop:done': 'Закончил мыть', 'mop:bucket': 'Ведро',
  'fridge:open': 'Открыл холодильник', 'fridge:disgust': 'Отвращение', 'fridge:rotten': 'Выкидывает гниль', 'fridge:bad': 'Выкинул не то', 'fridge:scrub': 'Отмывает холодильник', 'fridge:close': 'Закрывает дверцу', 'fridge:done': 'Холодильник готов',
  'faucet:open': 'Кран воет, потоп', 'faucet:inspect': 'Осматривает кран', 'faucet:wrong': 'Не та деталь', 'faucet:tighten': 'Затягивает гайку', 'faucet:tested': 'Проверка крана', 'faucet:done': 'Кран починен', 'faucet:neighbours': 'Соседи снизу недовольны',
  'toilet:inspect': 'Осматривает унитаз', 'toilet:clean': 'Начал чистить', 'toilet:scrub': 'Скребёт', 'toilet:wrong': 'Не та деталь', 'toilet:flush': 'Смыв', 'toilet:done': 'Унитаз готов', 'toilet:flushFail': 'Смыв не сработал',
  'printer:error': 'Принтер завис, пластик застрял', 'printer:last': 'Последний шанс', 'printer:inspect': 'Осматривает принтер', 'printer:wrong': 'Не та трубка', 'printer:disconnect': 'Отсоединил трубку', 'printer:clearing': 'Чистит сопло', 'printer:rethread': 'Заправляет пластик', 'printer:test': 'Тестовая печать', 'printer:success': 'Принтер заработал', 'printer:setback': 'Откат назад',
  'dishes': 'Посуда', 'mirror': 'Зеркало', 'stove': 'Плита', 'tub': 'Ванна',
  'laundry:pick': 'Поднимает шмотки', 'laundry:load': 'Загружает стиралку', 'laundry:start': 'Запустил стирку', 'laundry:wait': 'Ждёт стирку', 'laundry:noise': 'Стиралка грохочет',
  'tool:vac': 'Взял пылесос', 'tool:mop': 'Взял швабру', 'tool:box': 'Взял ящик с инструментами', 'needTool:vac': 'Нужен пылесос', 'needTool:mop': 'Нужна швабра', 'needTool:box': 'Нужен ящик с инструментами', 'unavailable': 'Сейчас так нельзя', 'spam': 'Нажимает не туда много раз',
  'sofa': 'Валяется на диване', 'tv:on': 'Включил телевизор', 'tv:off': 'Выключил телевизор', 'pc': 'Сел за компьютер',
  'jump': 'Прыгает', 'land': 'Приземляется', 'phone:ring': 'Звонит телефон', 'phone:answer': 'Берёт трубку', 'phone:ignore': 'Не берёт трубку', 'phone:hangup': 'Положил трубку',
  'door:ask': 'Подошёл к двери', 'door:open': 'Открывает дверь', 'door:early': 'Встречает хозяина раньше срока', 'owner:comes': 'Хозяин звонит или едет', 'owner:left': 'Хозяин ушёл', 'allDone': 'Всё убрано',
  'time:300': 'Осталось 5 минут', 'time:120': 'Осталось 2 минуты', 'time:60': 'Осталась минута', 'time:30': 'Осталось 30 секунд', 'time:10': 'Осталось 10 секунд',
  'success': 'Что-то получилось', 'fail': 'Что-то провалилось', 'cleanHigh': 'Чисто, высокая оценка', 'cleanLow': 'Грязно, низкая оценка',
  'chaos:pipe': 'Лопнул шланг под раковиной (кухня)', 'chaos:washer': 'Протекла стиралка (ванная)', 'chaos:spill': 'Разлил пиво (гостиная)', 'chaos:trash': 'Мусор вывалился обратно', 'chaos:neighbor': 'Сосед стучит, свет моргает', 'chaos:owner': 'Хозяин пишет эсэмэску',
  'landlordBark': 'Хозяин: реплики (звонок, угрозы)', 'landlordMissed': 'Хозяин: не взяли трубку', 'danBark': 'Дэн: реплики', 'dan:busy': 'Дэн: занят, не может говорить'
};
const SCRIPT_RU = {
  'landlord:1': 'Звонок хозяина №1 (первый, с угрозами)', 'landlord:2': 'Звонок хозяина №2', 'landlord:3': 'Звонок хозяина №3', 'landlord:4': 'Звонок хозяина №4 (он уже у подъезда)', 'landlord:5': 'Звонок хозяина №5 (реактивный)', 'landlord:6': 'Звонок хозяина №6 (реактивный)', 'landlord:7': 'Звонок хозяина №7 (реактивный)', 'landlord:8': 'Звонок хозяина №8 (реактивный)', 'landlord:9': 'Звонок хозяина №9 (реактивный)', 'landlord:10': 'Звонок хозяина №10 (реактивный)',
  'danHint:fridge': 'Дэн подсказывает: холодильник', 'danHint:faucet': 'Дэн подсказывает: кран', 'danHint:toilet': 'Дэн подсказывает: унитаз', 'danHint:printer': 'Дэн подсказывает: принтер', 'danHint:dishes': 'Дэн подсказывает: посуда', 'danHint:mirror': 'Дэн подсказывает: зеркало', 'danHint:vacJam': 'Дэн подсказывает: засор пылесоса',
  'printerMonologue:1': 'Монолог у принтера, шаг 1', 'printerMonologue:2': 'Монолог у принтера, шаг 2', 'printerMonologue:3': 'Монолог у принтера, шаг 3', 'printerMonologue:4': 'Монолог у принтера, шаг 4', 'printerMonologue:5': 'Монолог у принтера, шаг 5', 'printerMonologue:6': 'Монолог у принтера, шаг 6',
  'tutorial:move': 'Подсказка: ходьба', 'tutorial:jump': 'Подсказка: прыжок', 'tutorial:interact': 'Подсказка: действие', 'tutorial:pickup': 'Подсказка: подбор мусора', 'tutorial:bag': 'Подсказка: мешок', 'tutorial:vacuum': 'Подсказка: пылесос', 'tutorial:mop': 'Подсказка: швабра', 'tutorial:timer': 'Подсказка: таймер', 'tutorial:tools': 'Подсказка: инструменты', 'tutorial:phone': 'Подсказка: телефон', 'tutorial:dan': 'Подсказка: звонок Дэну', 'tutorial:door': 'Подсказка: дверь', 'tutorial:tasks': 'Подсказка: список дел',
  'intro': 'Вступление: Бамбуль просыпается, звонит хозяин',
  'dan:hint': 'Звонок Дэну: подсказка по текущему состоянию хаты', 'dan:call': 'Дэн звонит сам',
  'ending:good': 'Концовка «Хозяин пришёл — квартира сияет»', 'ending:ok': 'Концовка «Ну… жить можно»', 'ending:bad': 'Концовка «Музей катастроф»', 'ending:secret': 'Секретные концовки («Ипотека», «Диванный стратег»)',
  'printerMonologue': 'Монолог у принтера (вступление)'
};
const WHO_RU = { bamboul: 'БАМБУЛЬ', landlord: 'ХОЗЯИН (Аркадий Семёнович)', dan: 'ДЭН', narr: 'ГОЛОС ЗА КАДРОМ' };

(async () => {
  const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; fs.readFile(path.join(root, p), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': mime[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
  await new Promise(r => srv.listen(0, r));
  const br = await chromium.launch({ args: ['--no-sandbox'] }); const pg = await br.newPage();
  await pg.goto('http://localhost:' + srv.address().port + '/index.html?autostart=1&q=low&enhance=0'); await pg.waitForFunction(() => window.BB && BB.built); await pg.waitForTimeout(1500);
  const data = await pg.evaluate(() => {
    const P = BB.dlg._POOL, pools = {};
    for (const c of Object.keys(P)) pools[c] = { who: BB.dlg._meta(c).who, lines: P[c].map(e => ({ t: typeof e.t === 'function' ? '(динамическая реплика)' : e.t, cond: e.when ? String(e.when).replace(/\s+/g, ' ').slice(0, 90) : '' })) };
    // scripted dialogues: run every script under many game states and seeds, keep every distinct version
    const S = BB.S, ctxs = [];
    for (const time of [660, 480, 300, 180, 90, 40]) for (const done of [0, 1]) {
      const f = Object.assign({}, S.f); for (const k of ['faucetFixed', 'flushFixed', 'fridgeDone', 'printerFixed', 'dishesDone', 'mirrorDone', 'boxesCleared']) f[k] = done; f.toiletClean = done;
      ctxs.push({ S: Object.assign({}, S, { f }), f, time, total: 600, progress: done ? 92 : 12, score: done ? 92 : 12, stage: done ? 3 : 1, n: 1, touch: 0 });
    }
    const flat = lines => (lines || []).map(l => ({ who: l.who, text: l.text, choices: (l.choices || []).map(ch => { let after = []; try { const more = ch.run && ch.run(); after = (Array.isArray(more) ? more : more ? [more] : []).filter(m => m && m.text).map(m => ({ who: m.who, text: m.text })); } catch (e) { } return { text: ch.text, after }; }) }));
    const scripts = {};
    for (const id of BB.dlg.SCRIPT_IDS) {
      const seen = new Map();
      for (const c of ctxs) for (let seed = 1; seed <= 24; seed++) { try { BB.dlg._seed(seed); const orig = Math.random; let x = seed * 7919 + 13; Math.random = () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; }; let seq; try { seq = flat(BB.dlg.script(id, c)); } finally { Math.random = orig; } const key = JSON.stringify(seq); if (seq.length && !seen.has(key)) seen.set(key, seq); } catch (e) { } }
      scripts[id] = [...seen.values()];
    }
    BB.dlg._unseed();
    const variants = {}; for (const id in (BB.dlg._variants || {})) variants[id] = BB.dlg._variants[id];
    return { pools, scripts, variants };
  });
  await br.close(); srv.close();

  /* ---- static texts that live in source files ---- */
  const src = f => fs.readFileSync(path.join(root, f), 'utf8');
  const cyr = s => /[А-Яа-яЁё]{3}/.test(s);
  const strs = text => [...text.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)].map(m => m[1].replace(/\\'/g, "'")).filter(s => cyr(s) && s.length > 5);
  const story = src('js/story.js'), steps = story.slice(story.indexOf('const STEPS = ['), story.indexOf('function tutorial('));
  const tut = [...steps.matchAll(/id: '(\w+)', text: \(\) => ([^\n]*?), when:/g)].map(m => [m[1], strs(m[2])]);
  const mg = src('js/minigames.js'); const mgStrs = [...new Set(strs(mg))];

  /* ---- build the text ---- */
  const L = []; const hr = (c, n) => c.repeat(n || 78); const H1 = t => { L.push('', hr('='), t, hr('=')); }; const H2 = t => { L.push('', hr('-'), t, hr('-')); }; const H3 = t => L.push('', '>>> ' + t);
  let total = 0, byWho = {}; for (const c in data.pools) for (const e of data.pools[c].lines) { if (c === 'move') continue; total++; byWho[data.pools[c].who] = (byWho[data.pools[c].who] || 0) + 1; }
  const scriptLines = new Set(); for (const id in data.scripts) for (const seq of data.scripts[id]) for (const l of seq) { scriptLines.add(l.who + '|' + l.text); for (const ch of l.choices) { scriptLines.add('bamboul|' + ch.text); for (const a of ch.after) scriptLines.add(a.who + '|' + a.text); } }
  L.push(hr('='), 'БАМБУЛЬ: ХОЗЯИН ЕДЕТ', 'ВСЕ РЕПЛИКИ И ДИАЛОГИ ИГРЫ (рабочий документ для чтения и правок)', hr('='), '',
    'Файл собран автоматически из игры (tools/export_dialogues.js), версия 0.2. Тексты без цензуры.', '',
    'КАК ЧИТАТЬ',
    '  • Реплики разбиты тремя способами: ЧАСТЬ 1 — по героям (кто и сколько говорит, как звучит), ЧАСТЬ 2 — по действиям (что делает герой, когда произносится реплика), ЧАСТЬ 3 — сюжетные диалоги (звонки, концовки, обучение).',
    '  • Реплика из ЧАСТИ 2 выбирается случайно из своей группы, без повторов подряд. Чем больше строк в группе, тем реже повтор.',
    '  • [id] в скобках у названия группы — имя категории в коде (js/dialogue*.js), чтобы разработчик мог найти место.',
    '  • ⚑ — условная реплика: появляется только в определённой ситуации (условие показано рядом).',
    '  • В сюжетных диалогах: ► — варианты ответа игрока, ↳ — реакция на выбранный ответ. Один и тот же диалог может иметь несколько версий (выбирается случайно или по состоянию хаты).',
    '  • Каждая реплика озвучена записанным голосом (синтез Silero). Если изменить текст, её нужно озвучить заново (docs/VOICE.md).', '',
    'СОДЕРЖАНИЕ',
    '  ЧАСТЬ 1. Герои и как они говорят',
    '  ЧАСТЬ 2. Реплики по действиям (барки)  — A1…A19 для Бамбуля, B для хозяина, C для Дэна',
    '  ЧАСТЬ 3. Сюжетные диалоги: вступление, звонки хозяина, звонки Дэна, подсказки по мини-играм, концовки, обучение',
    '  ЧАСТЬ 4. Тексты мини-игр (подписи предметов, подсказки)',
    '  ПРИЛОЖЕНИЕ. Памятка для общего промта: голос каждого героя', '',
    `ИТОГО: реплик в группах ${total} (Бамбуль ${byWho.bamboul || 0}, хозяин ${byWho.landlord || 0}, Дэн ${byWho.dan || 0}); различных строк в сюжетных диалогах ${scriptLines.size}; текстов мини-игр ${mgStrs.length}.`);

  /* PART 1 */
  H1('ЧАСТЬ 1. ГЕРОИ И КАК ОНИ ГОВОРЯТ');
  L.push('', '1) БАМБУЛЬ (главный герой, говорит почти всё время)',
    '   Реплик в группах: ' + (byWho.bamboul || 0) + '. Говорит сам с собой при ходьбе, ругается на технику, ноет, оправдывается, паникует.',
    '   Голос: усталый, самоироничный, матерится ритмично; чем меньше времени, тем короче и злее. Страх прячет за шуткой.',
    '   Любимые темы: хозяин едет, убираться не хочется, хочется бухать и нихуя не делать, ненависть к мусору и технике, нежность к принтеру «Бамбушке».', '',
    '2) ХОЗЯИН — Аркадий Семёнович (говорит по телефону и при приходе)',
    '   Реплик в группах: ' + (byWho.landlord || 0) + ' + десять звонков в сюжетной части.',
    '   Голос: протокольная раздражённая речь, угрозы выселением и вычетом из залога, бюрократические обороты, вялый мат «по-хозяйски».',
    '   Скрытая глубина: боится, что квартира, оставшаяся от жены, придёт в негодность.', '',
    '3) ДЭН (брат, служба поддержки)',
    '   Реплик в группах: ' + (byWho.dan || 0) + ' + подсказки по каждой мини-игре и звонки.',
    '   Голос: сухой сарказм, практичность, короткие фразы. Помогает, но берёт цену (шаурма, мытьё машины).', '',
    '4) ГОЛОС ЗА КАДРОМ / подсказки интерфейса',
    '   Короткие тексты обучения («Подойди и нажми E»), см. ЧАСТЬ 3.');

  /* PART 2 */
  H1('ЧАСТЬ 2. РЕПЛИКИ ПО ДЕЙСТВИЯМ');
  const catsBy = who => Object.keys(data.pools).filter(c => data.pools[c].who === who);
  const printCat = c => { const p = data.pools[c]; H3(`${CAT_RU[c] || c}  [${c}]  — ${p.lines.length} шт.`); p.lines.forEach((e, i) => L.push(`  ${String(i + 1).padStart(2)}. ${e.t}${e.cond ? '   ⚑ если: ' + e.cond : ''}`)); };
  H2('A. БАМБУЛЬ');
  const used = new Set();
  for (const [gid, title, rx] of GROUPS) {
    const cs = catsBy('bamboul').filter(c => rx.test(c) && !used.has(c)); if (!cs.length) continue; cs.forEach(c => used.add(c));
    const n = cs.reduce((a, c) => a + data.pools[c].lines.length, 0); H2(`${gid}. ${title}  (${n} шт.)`); cs.forEach(printCat);
  }
  used.add('move'); // legacy pool: its lines were merged into pain:walk:early / pain:walk:mid
  const rest = catsBy('bamboul').filter(c => !used.has(c)); if (rest.length) { H2('A20. Прочее'); rest.forEach(printCat); }
  H2('B. ХОЗЯИН (Аркадий Семёнович): короткие реплики'); catsBy('landlord').forEach(printCat);
  H2('C. ДЭН: короткие реплики'); catsBy('dan').forEach(printCat);

  /* PART 3 */
  H1('ЧАСТЬ 3. СЮЖЕТНЫЕ ДИАЛОГИ');
  L.push('', 'Здесь реплики идут как сцены: кто, что, и что игрок может ответить. Версий у одной сцены несколько: игра выбирает по состоянию хаты, времени и случаю. Основная версия напечатана целиком, у остальных показаны только строки, которых раньше не было.');
  const printSeq = seq => { for (const l of seq) { L.push(`    ${WHO_RU[l.who] || l.who}: ${l.text}`); for (const ch of l.choices) { L.push(`      ► ОТВЕТ ИГРОКА: ${ch.text}`); for (const a of ch.after) L.push(`          ↳ ${WHO_RU[a.who] || a.who}: ${a.text}`); } } };
  const groupsOfScripts = [
    ['3.1. Вступление', ['intro']],
    ['3.2. Звонки хозяина (запланированные №1–4 и реактивные №5–10)', Object.keys(data.scripts).filter(i => /^landlord:/.test(i))],
    ['3.3. Звонки Дэна и подсказки по состоянию хаты', ['dan:hint', 'dan:call']],
    ['3.4. Подсказки Дэна по мини-играм', Object.keys(data.scripts).filter(i => /^danHint:/.test(i))],
    ['3.5. Монологи у принтера', Object.keys(data.scripts).filter(i => /^printerMonologue/.test(i))],
    ['3.6. Концовки', Object.keys(data.scripts).filter(i => /^ending:/.test(i))],
    ['3.7. Обучающие подсказки (tutorial)', Object.keys(data.scripts).filter(i => /^tutorial:/.test(i))]
  ];
  for (const [title, ids] of groupsOfScripts) {
    H2(title);
    for (const id of ids) {
      const vs = data.scripts[id] || []; H3(`${SCRIPT_RU[id] || id}  [${id}]  — версий: ${vs.length}`);
      if (!vs.length) { L.push('    (в этой версии игры пусто)'); continue; }
      const shown = new Set(); const key = (w, t) => w + '|' + t;
      vs.forEach((seq, i) => {
        if (i === 0) { L.push('  --- версия 1 (основная) ---'); printSeq(seq); seq.forEach(l => { shown.add(key(l.who, l.text)); l.choices.forEach(ch => { shown.add(key('p', ch.text)); ch.after.forEach(a => shown.add(key(a.who, a.text))); }); }); return; }
        const fresh = []; for (const l of seq) { const ch = l.choices.map(c => ({ text: c.text, after: c.after.filter(a => !shown.has(key(a.who, a.text))), isNew: !shown.has(key('p', c.text)) })).filter(c => c.isNew || c.after.length);
          if (!shown.has(key(l.who, l.text)) || ch.length) fresh.push({ who: l.who, text: l.text, choices: ch, old: shown.has(key(l.who, l.text)) }); }
        seq.forEach(l => { shown.add(key(l.who, l.text)); l.choices.forEach(ch => { shown.add(key('p', ch.text)); ch.after.forEach(a => shown.add(key(a.who, a.text))); }); });
        if (!fresh.length) return;
        L.push(`  --- версия ${i + 1}: только строки, которых нет выше ---`);
        for (const l of fresh) { L.push(`    ${WHO_RU[l.who] || l.who}: ${l.text}${l.old ? '   (строка уже была, новая только реакция)' : ''}`); for (const c of l.choices) { L.push(`      ► ОТВЕТ ИГРОКА: ${c.text}`); for (const a of c.after) L.push(`          ↳ ${WHO_RU[a.who] || a.who}: ${a.text}`); } }
      });
    }
  }
  H2('3.8. Дополнительные версии звонков (добавлены в v0.2: каждая выбирается случайно вместе с оригиналом)');
  for (const id in data.variants) { H3(`[${id}]`); data.variants[id].forEach((seq, i) => { L.push(`  --- вариант ${i + 1} ---`); printSeq(seq.map(l => Object.assign({ choices: [] }, l))); }); }
  H2('3.9. Подсказки обучения на экране (всплывающие плашки, тексты из js/story.js)');
  for (const [id, ss] of tut) { H3(`шаг «${id}»`); ss.forEach(s => L.push('    • ' + s)); }

  /* PART 4 */
  H1('ЧАСТЬ 4. ТЕКСТЫ МИНИ-ИГР (js/minigames.js)');
  L.push('', 'Подписи предметов, подсказки и шутки внутри мини-игр. Порядок как в коде; интерфейсные подписи тоже попали сюда.', '');
  mgStrs.forEach((s, i) => L.push(`  ${String(i + 1).padStart(3)}. ${s}`));

  /* appendix */
  H1('ПРИЛОЖЕНИЕ. ПАМЯТКА ДЛЯ ОБЩЕГО ПРОМТА');
  L.push('',
    'ПРАВИЛА ТЕКСТА (общие):',
    '  • Русский разговорный, смешной и грубый. Мат — ритм и эмоция, не набор слов. Одна и та же ругань не должна идти подряд.',
    '  • Реплика короткая (одна-две фразы), помещается в облако над героем, читается за 3–6 секунд.',
    '  • Чем меньше времени, тем короче и злее. Первая треть забега: ноет и тянет; середина: нервничает; последняя четверть: паника и ярость.',
    '  • Конкретика вместо общих слов («пятно старше некоторых государств», а не «грязно»).',
    '  • Бьём вверх и по себе: по хозяину, обстоятельствам, технике, лени героя. Не издеваемся над слабыми, болезнями, национальностью и ориентацией. Ругань не направлена на группы людей.',
    '  • Режим «без мата» (звёздочки) должен читаться: шутка держится и без ругани.', '',
    'ГОЛОСА:',
    '  БАМБУЛЬ: усталый, самоироничный, паникёр с вспышками героизма. Любимые формулы: «Щас начну», «Я не ленивый, я в режиме энергосбережения». Нежно ругается на принтер («Бамбушка»), яростно на кран и хозяина.',
    '  ХОЗЯИН: Аркадий Семёнович, педант и зануда. «Не пизди мне», «Я приеду и проверю лично», «Вычту из залога». Угрожает, но не злодей.',
    '  ДЭН: сухой сарказм, короткие фразы, без лишних эмоций. Помогает, но напоминает, что Бамбуль ему должен.', '',
    'КАК ДОБАВЛЯТЬ РЕПЛИКИ В ИГРУ:',
    '  1) Короткие реплики: js/dialogue_pain_data.js (формат [текст, эмоция]) и js/dialogue.js / dialogue_plus.js.',
    '  2) Сюжетные звонки: js/dialogue.js (сценарии) и js/dialogue_plus.js; новые версии звонков: js/dialogue_pain_data.js → P.variants.',
    '  3) После правок: node tools/collect_lines.js, затем /tmp/sv/bin/python tools/gen_voice_incremental.py /tmp/lines.json (озвучит только новое), затем node tools/test_voice.js.',
    '  4) Этот файл пересобирается командой: node tools/export_dialogues.js');
  fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, L.join('\n') + '\n');
  console.log('written', OUT, L.length, 'lines,', (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB;', 'pool lines', total, JSON.stringify(byWho), 'script lines', scriptLines.size, 'minigame texts', mgStrs.length);
})();

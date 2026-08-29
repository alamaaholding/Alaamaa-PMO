// ═══════════════════════════════════════════════════════════════════════
//  src/screens.js — سجلّ الشاشات: كسر دورة التنقّل (الموجة W2)
// ═══════════════════════════════════════════════════════════════════════
//
// القياس الذي أوجب الوحدة: أربع عشرة نداءةَ تنقّل عابرة للملفات بين سبعة
// ملفات، تشكّل **دورة حقيقية** لا مسألة ترتيب:
//
//     portfolio ⇄ clienthome        و  lifecycle · pgantt · session ·
//     كلٌّ منهما ينادي الآخر            contractsign ⟶ main.openProject
//
// ولا ترتيبَ تحويلٍ يفكّها: أيّ ملف يتحوّل أولًا سيحتاج `import` من ملف لم
// يتحوّل. فالسجلّ ربطٌ متأخّر — الشاشة تُسجّل نفسها، والمُنادي يطلب المفتاح.
//
// وما يحرسه هذا الملف ثلاثة أشياء، ثالثها هو الأدقّ:
//
//  ١) دلالات السجلّ نفسه — والأخطاء تُرمى ولا تُبتلع.
//  ٢) أن الشاشات العشر مُسجَّلة فعلًا في الحزمة المبنيّة.
//  ٣) **برهان التكافؤ**: كان `onclick=renderPortfolio` يمرّر كائن الحدث وسيطًا
//     أول. وصار `onclick=()=>showScreen('portfolio')` لا يمرّر شيئًا. وهذا
//     تكافؤ **مشروط** بأن تلك الدوال لا تُصرّح بوسائط — فيُفحَص الشرط نفسه.

const fs = require('fs');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { JSDOM } = require('jsdom');

let ok = 0, fail = 0;
const t = (n, c, x) => { if (c) { ok++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? ' → ' + x : '')); } };
const eq = (n, got, want) => t(n, got === want, `توقّعنا ${JSON.stringify(want)} وجاء ${JSON.stringify(got)}`);
const throws = (n, fn, re) => { let m = null; try { fn(); } catch (e) { m = e.message; } t(n, m !== null && (!re || re.test(m)), m === null ? 'لم يُرمَ شيء' : m); };

const bundle = fs.readFileSync('app.bundle.js', 'utf8');
const screensSrc = fs.readFileSync('src/screens.js', 'utf8');

// الشاشة → الملف الذي يعرّف دالتها
const SCREENS = {
  portfolio: ['renderPortfolio', 'src/app/portfolio.js'],
  clienthome: ['renderClientHome', 'src/app/clienthome.js'],
  contractshub: ['renderContractsHub', 'src/app/contractshub.js'],
  workload: ['renderWorkload', 'src/app/workload.js'],
  staffaccess: ['renderStaffAccess', 'src/app/staffaccess.js'],
  archived: ['renderArchived', 'src/app/lifecycle.js'],
  project: ['openProject', 'src/app/main.js'],
  ptimeline: ['renderPortfolioTimeline', 'src/app/main.js'],
  audit: ['renderAuditLog', 'src/app/main.js'],
  leads: ['renderLeads', 'src/app/main.js']
};

console.log('\n▸ دلالات السجلّ — والأخطاء تُرمى ولا تُبتلع');
{
  const built = execFileSync('node_modules/.bin/esbuild',
    ['src/screens.js', '--bundle', '--format=iife', '--global-name=__s'], { encoding: 'utf8' });
  const ctx = { console };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(built, ctx);
  const S = ctx.__s;

  t('يبدأ فارغًا', S.registeredScreens().length === 0);
  S.registerScreen('a', (x, y) => 'a:' + x + ':' + y);
  t('hasScreen يرى المُسجَّل', S.hasScreen('a') && !S.hasScreen('b'));
  eq('showScreen يمرّر الوسائط ويُعيد القيمة', S.showScreen('a', 1, 2), 'a:1:2');
  eq('registerScreen يُعيد الدالة كما هي', typeof S.registerScreen('r', () => 1), 'function');

  // مفتاح مجهول: النداء الوحيد الذي يصل بمفتاح غير مُسجَّل خطأ مطبعيّ، وابتلاعه
  // يُنتج زرًّا لا يفعل شيئًا بلا أثر واحد في الطرفية.
  throws('مفتاح غير مُسجَّل يرمي', () => S.showScreen('لا-شيء'), /غير مُسجَّلة/);
  t('والرسالة تسمّي المُسجَّل ليُقارَن', /a, r/.test((() => { try { S.showScreen('x'); } catch (e) { return e.message; } })()));

  // تسجيل مكرَّر: أسوأ عطل ممكن هنا لأنه يعتمد على ترتيب البناء لا على الكود —
  // نصف النداءات تذهب لشاشة والنصف الآخر لأخرى.
  throws('تسجيل مكرَّر يرمي', () => S.registerScreen('a', () => 2), /مرتين/);
  throws('تسجيل بغير دالة يرمي', () => S.registerScreen('z', 'ليست دالة'), /بغير دالة/);
  throws('مفتاح فارغ يرمي', () => S.registerScreen('', () => 1), /غير صالح/);

  // القيد المعماري: إعادة توجيه ولا شيء غيرها.
  t('السجلّ لا يلمس SCREEN', !/\bSCREEN\b/.test(screensSrc.replace(/^\s*\/[/*].*$/gm, '')));
}

console.log('\n▸ الشاشات العشر مُسجَّلة في الحزمة المبنيّة');
{
  // **الهيكل الحقيقي لا `<body></body>` فارغ.** التسجيل يجري في الملفات القديمة
  // التي تُلحَق بعد قطعة ESM، وفيها ربطُ DOM في المستوى الأعلى. فجسمٌ فارغ يُسقط
  // السكربت في منتصفه فلا يصل التسجيل — وهذا عيبٌ في الاختبار لا في الكود، لكنه
  // كشف قيدًا حقيقيًا يستحق الحراسة: **ما بعد أوّل استثناء في المستوى الأعلى لا
  // يُنفَّذ**، فالتسجيل ليس مضمونًا إلا بقدر ضمان ما قبله.
  const shell = fs.readFileSync('index.html', 'utf8')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/g, '')   // لا تحميل حزمة من الوسم
    .replace(/<link[^>]*>/g, '');
  const dom = new JSDOM(shell, { runScripts: 'dangerously' });
  const w = dom.window;
  w.eval(`window.supabase={createClient:()=>({rpc:()=>Promise.resolve({data:[],error:null}),
    from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null})})}),
    auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
    channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>{}})}`);
  const sc = w.document.createElement('script');
  sc.textContent = bundle;
  w.document.body.appendChild(sc);   // أخطاء ربط DOM متوقَّعة: لا هيكل

  const reg = w.registeredScreens();
  // أن تصل الحزمة إلى هنا أصلًا هو التأكيد الأول: التسجيل المكرَّر كان سيرمي
  // أثناء تحميلها فيُفرغ السجلّ.
  t('الحزمة حُمّلت بلا تسجيل مكرَّر', Array.isArray(reg));
  Object.keys(SCREENS).forEach(k => t(`«${k}» مُسجَّلة`, reg.includes(k)));
  eq('ولا مفتاح زائد', reg.length, Object.keys(SCREENS).length);
  t('showScreen تصل عبر الجسر', typeof w.showScreen === 'function');
}

console.log('\n▸ برهان التكافؤ: الإحالة المجرَّدة كانت تمرّر كائن الحدث');
{
  // `onclick=renderPortfolio` تُنادى بـ(MouseEvent). و`()=>showScreen('portfolio')`
  // تُنادى بلا شيء. التكافؤ قائم **فقط** ما دامت الدالة لا تقرأ وسيطًا.
  const bare = ['renderPortfolio', 'renderContractsHub', 'renderWorkload',
    'renderStaffAccess', 'renderArchived', 'renderAuditLog', 'renderLeads', 'renderPortfolioTimeline'];
  for (const fn of bare) {
    const [, file] = Object.values(SCREENS).find(([n]) => n === fn);
    const src = fs.readFileSync(file, 'utf8');
    const sig = (src.match(new RegExp('(?:async )?function ' + fn + '\\(([^)]*)\\)')) || [])[1];
    t(`${fn} لا تُصرّح بوسائط`, sig === '', `التوقيع (${sig})`);
  }
  // والشاشتان اللتان تأخذان وسيطًا لم تكونا إحالةً مجرَّدة قط — تُمرَّر الوسائط.
  t("showScreen('clienthome', …) تُمرَّر بوسيطها",
    /showScreen\('clienthome',\s*\w/.test(fs.readFileSync('src/app/main.js', 'utf8')));
}

console.log('\n▸ الدورة مكسورة — وتبقى مكسورة');
{
  // الحارس الحقيقي: لا ملف ينادي دالةَ شاشةٍ يعرّفها ملفٌ آخر مباشرةً. أي عودة
  // لذلك تُعيد الحافة التي أُزيلت، فتُعيد الدورة معها بلا أن يسقط شيء آخر.
  const offenders = [];
  for (const [fn, owner] of Object.values(SCREENS)) {
    for (const dir of ['src', 'src/app']) {
      for (const f of fs.readdirSync(dir)) {
        const path = `${dir}/${f}`;
        if (!f.endsWith('.js') || path === owner || f === 'qrgen.js' || f === 'screens.js') continue;
        const code = fs.readFileSync(path, 'utf8').split('\n')
          .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
        if (new RegExp('(?<![\\w.$])' + fn + '(?![\\w$])').test(code)) offenders.push(`${path}:${fn}`);
      }
    }
  }
  t('لا نداء تنقّل مباشر عابر للملفات', offenders.length === 0, offenders.join(' '));

  // والقيد الذي يقوم عليه امتناع السجلّ عن لمس SCREEN: كل شاشة تضبطه بنفسها.
  //
  //
  // وكان «leads» استثناءً كشفه هذا التأكيد نفسه: `renderLeads` وحدها لا تضبط
  // SCREEN ولا تنادي hideChrome، بخلاف شقيقتيها المجاورتين لها في الملف نفسه.
  // أُصلح في دفعته المستقلة (سلوك لا بنية)، فسقط الاستثناء ولم يبقَ إلا القاعدة.
  const noSelfSet = [];
  for (const [key, [fn, owner]] of Object.entries(SCREENS)) {
    const src = fs.readFileSync(owner, 'utf8');
    const at = src.indexOf(`function ${fn}(`);
    const body = src.slice(at, at + 400);
    // صيغتان بحكم الهجرة، والمعنى واحد: الملف غير المُحوَّل يكتب `SCREEN='x'`
    // (واصفٌ على globalThis)، والوحدة المُحوَّلة تكتب `setState('SCREEN','x')`.
    // فيُفحَص المعنى لا الإملاء — وإلا سقط التأكيد على كل ملف يتحوّل، وهو أسوأ
    // ما يمكن أن يفعله حارس: أن يعاقب التقدّم الذي وُضع ليحميه.
    const setsIt = new RegExp(`SCREEN\\s*=\\s*'${key}'`).test(body)
      || new RegExp(`setState\\(\\s*'SCREEN'\\s*,\\s*'${key}'\\s*\\)`).test(body);
    if (!setsIt) noSelfSet.push(`${fn}→${key}`);
  }
  t('كل شاشة بلا استثناء تضبط SCREEN بنفسها', noSelfSet.length === 0, noSelfSet.join(' '));
  // وكل شاشة تُخفي الإطار كذلك — عدا 'project' وحدها، فهي الشاشة التي يخصّها.
  const noHide = [];
  for (const [key, [fn, owner]] of Object.entries(SCREENS)) {
    if (key === 'project') continue;
    const src = fs.readFileSync(owner, 'utf8');
    const at = src.indexOf(`function ${fn}(`);
    if (!/hideChrome\(\)/.test(src.slice(at, at + 700))) noHide.push(fn);
  }
  t('وكل شاشة سوى المشروع تُخفي الإطار', noHide.length === 0, noHide.join(' '));
}

console.log('\nنجح ' + ok + ' · فشل ' + fail);
process.exit(fail ? 1 : 0);

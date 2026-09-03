// ===== اختبار: أول وحدة ESM والجسر الهجين (الموجة W2) =====
//
// AUDIT §أ-١: النطاق العام هو المعمارية — 403 دالة و~35 متغيّرًا في نطاق واحد،
// بلا حدود ولا شجرة تبعيات يمكن التحقق منها، ولا إمكانية تصغير أو tree-shaking.
// الهجرة إلى ESM تدريجية بالضرورة: 17 ملفًا دفعةً واحدة فرقٌ غير قابل للمراجعة.
//
// ما يحرسه هذا الملف قيدان تنهار الهجرة كلها بسقوط أيٍّ منهما:
//
// ١) **الحزمة تبقى سكربتًا عاديًا.** ستة عشر ملف اختبار تحقن app.bundle.js كنص
//    داخل jsdom. لو صار الإخراج ESM، تسقط شبكة الأمان كلها دفعةً واحدة — وهو ما
//    تمنعه القاعدة الحاكمة الثالثة صراحةً. فصيغة IIFE قيد مفروض لا تفضيل.
//
// ٢) **الجسر يصل فعلًا.** الكود غير المُحوَّل ما زال يقرأ الأسماء من globalThis.
//    لو انقطع الجسر، لا يظهر العطل وقت البناء بل عند أول مستخدم يفتح مشروعًا.

const fs = require('fs');
const { JSDOM } = require('jsdom');

let ok = 0, fail = 0;
const t = (n, c, x) => { if (c) { ok++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? ' → ' + x : '')); } };

const engine = fs.readFileSync('src/engine.js', 'utf8');
const entry  = fs.readFileSync('src/bundle-entry.js', 'utf8');
const config = fs.readFileSync('src/config.js', 'utf8');
const bundle = fs.readFileSync('app.bundle.js', 'utf8');
const buildPy = fs.readFileSync('build.py', 'utf8');

const EXPORTS = ['D', 'setHolidays', 'isoLocal', 'isWorkday', 'wdBetween', 'scheduleTasks', 'computeTracking'];

console.log('\n▸ engine.js صارت وحدة ESM حقيقية');
EXPORTS.forEach(n => t(`${n} مُصدَّرة`, new RegExp(`export (function|const) ${n}\\b`).test(engine)));
t('لا تعريف عام مسرَّب: HOLIDAYS تبقى داخل الوحدة',
  /^let HOLIDAYS/m.test(engine) && !/export let HOLIDAYS/.test(engine));

console.log('\n▸ مصدر حقيقة واحد لـD بعد نقلها');
t('D معرَّفة في engine.js', /export const D = /.test(engine));
t('config.js لم تعد تعرّفها', !/const D=s=>/.test(config));
{
  // المقصود «تعريف **عام** واحد» لا «اسم واحد في المشروع». التمييز مهم: في
  // contracttemplate.js قاموسُ بيانات محلّي اسمه D داخل mergeContract — يحجب
  // مساعد التاريخ داخل تلك الدالة وحدها ولا يستعمله، فليس تعارضًا.
  // (وهو مع ذلك مثالٌ حيّ على ما تمنعه الوحدات: اسم من حرف واحد في نطاق مشترك.)
  const files = ['src/engine.js', 'src/config.js',
    ...fs.readdirSync('src').filter(f => f.endsWith('.js')).map(f => `src/${f}`),
    ...fs.readdirSync('src/app').filter(f => f.endsWith('.js')).map(f => `src/app/${f}`)];
  const defs = [...new Set(files)]
    .reduce((n, f) => n + ((fs.readFileSync(f, 'utf8').match(/^(?:export )?(?:const|let|var) D\s*=/gm) || []).length), 0);
  t('تعريف عام واحد لا اثنان', defs === 1, defs + ' تعريفًا في المستوى الأعلى');
}

console.log('\n▸ القيد الحاكم: الحزمة سكربت عادي لا ESM');
t('لا export في المستوى الأعلى للحزمة', !/^export[\s{]/m.test(bundle));
t('لا import في المستوى الأعلى للحزمة', !/^import[\s{'"]/m.test(bundle));
t('البناء يفرض صيغة IIFE صراحةً', buildPy.includes('--format=iife'));
t('قطعة ESM موسومة في الناتج', bundle.includes('/* ===== وحدات ESM (esbuild) ===== */'));
{
  // القاعدة الحاكمة السادسة: القدرة المفحوصة لم تتغيّر، موضعها تغيّر. كان التأكيد
  // مثبَّتًا على `config.js` بصفتها أول ملف في الدمج النصي — ثم تحوّلت هي نفسها،
  // فاختفى المرساة وسقط التأكيد. العلاج ليس تثبيته على الملف التالي (فيسقط مجددًا
  // مع كل تحويل)، بل أن يقرأ المرساة من build.py: **أوّل ملف قديم أيًّا كان**.
  const first = (buildPy.match(/CORE=\[\s*'src\/(?:app\/)?([\w.-]+)'/) || [])[1];
  t('build.py ما زالت تُعلن ملفات دمج نصي', !!first, 'تعذّرت قراءة أول عنصر في CORE');
  t('القطعة توضع **أولًا** — قبل الكود القديم الذي يقرأ منها',
    bundle.includes(`===== ${first} =====`) &&
    bundle.indexOf('وحدات ESM (esbuild)') < bundle.indexOf(`===== ${first} =====`),
    `أول ملف قديم: ${first}`);
}
t('engine.js خرجت من قائمة الدمج النصي (تُحزَم لا تُلصَق)',
  !/CORE=\[[^\]]*'src\/engine\.js'/.test(buildPy));

console.log('\n▸ الجسر يصل فعلًا — تشغيل الحزمة الحقيقية');
{
  const dom = new JSDOM('<body></body>', { runScripts: 'dangerously' });
  const w = dom.window;
  w.eval(`window.supabase={createClient:()=>({rpc:()=>Promise.resolve({data:[],error:null}),
    from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null})})}),
    auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
    channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>{}})}`);
  const s = w.document.createElement('script');
  s.textContent = bundle;
  w.document.body.appendChild(s);   // أخطاء ربط DOM متوقَّعة هنا: لا هيكل — لا تعنينا

  EXPORTS.forEach(n => t(`${n} وصلت إلى globalThis`, typeof w[n] === 'function'));
  const S = w.scheduleTasks([{ id: 'A', type: 'task', duration: 3, deps: [] }], '2026-08-02');
  t('جدولة حقيقية تعمل من خلال الجسر',
    w.isoLocal(S.R.A.ES) === '2026-08-02' && w.isoLocal(S.R.A.EF) === '2026-08-04');
  t('D تعمل من خلال الجسر', w.isoLocal(w.D('2026-08-05')) === '2026-08-05');
}

console.log('\n▸ انحدار كاد يمرّ صامتًا: تلوين العطلات في الجانت');
// views.js كان يقرأ المجموعة HOLIDAYS مباشرةً من النطاق العام، بحارس
// `typeof HOLIDAYS!=='undefined'`. وبتحويل المحرك إلى وحدة صارت خاصّة — فكان
// الحارس **سيبتلع العطل صامتًا**: تختفي أعمدة العطلات من الجانت بلا خطأ ولا أثر.
// أمسكه no-undef على الحزمة قبل أن يصل لمستخدم. العلاج واجهة صريحة لا تسريب بنية.
{
  const views = fs.readFileSync('src/views.js', 'utf8');
  t('views.js لم يعد يفتّش داخل HOLIDAYS', !views.includes('HOLIDAYS'));
  t('يسأل الواجهة الصريحة بدلًا عنها', views.includes('isHoliday(iso)'));
  t('engine.js يصدّر isHoliday', /export function isHoliday\(/.test(engine));

  const { execFileSync } = require('child_process');
  const vm = require('vm');
  const built = execFileSync('node_modules/.bin/esbuild',
    ['src/engine.js', '--bundle', '--format=iife', '--global-name=E'], { encoding: 'utf8' });
  const ctx = { console };
  vm.createContext(ctx); vm.runInContext(built, ctx);
  ctx.E.setHolidays(['2026-08-04']);
  t('isHoliday تُميّز العطلة المسجَّلة', ctx.E.isHoliday('2026-08-04') === true);
  t('ولا تُخطئ في يوم عمل', ctx.E.isHoliday('2026-08-05') === false);
  ctx.E.setHolidays([]);
  t('وتتبع تفريغ القائمة', ctx.E.isHoliday('2026-08-04') === false);
}

console.log('\n▸ الدفعة الثانية: format.js و app/dialogs.js');
// المساعدات النقية المدفونة داخل الملفات الكبيرة هي ما كان يصنع الدورات في مخطط
// الاعتماد: `esc` (سطر واحد) عاشت في views.js، فصار app/dialogs.js — أصغر ملف في
// طبقة التطبيق — يعتمد على أكبر ملف عرض. وإخراجها كسر الدورة عند مصدرها.
{
  const format  = fs.readFileSync('src/format.js', 'utf8');
  const dialogs = fs.readFileSync('src/app/dialogs.js', 'utf8');
  const views   = fs.readFileSync('src/views.js', 'utf8');

  ['esc', 'fmt', 'fmtY', 'todayISO', 'slugify', 'uniqueSlug']
    .forEach(n => t(`format يصدّر ${n}`, new RegExp(`export (function|const) ${n}\\b`).test(format)));
  // النطاق العام ينقص فعلًا: ما لا يحتاجه أحد خارج الملف لا يُصدَّر.
  t('AR_TRANSLIT لم تعد عامّة', !/export const AR_TRANSLIT/.test(format));
  t('transliterateArabic لم تعد عامّة', !/export function transliterateArabic/.test(format));
  t('format.js ورقة: لا تستورد شيئًا', !/^import /m.test(format));

  t('dialogs يصدّر dialog', /export function dialog\(/.test(dialogs));
  t('dialogs يصدّر confirmDialog', /export async function confirmDialog\(/.test(dialogs));

  // أول استيراد بين وحدتين مُحوَّلتين — الجسر لم يعد المسار الوحيد.
  t('dialogs يستورد esc صراحةً من format', /import \{ esc \} from '\.\.\/format\.js'/.test(dialogs));

  t('مصدر حقيقة واحد لـesc: views.js لم تعد تعرّفها', !/^function esc\(/m.test(views));
  t('config.js لم تعد تعرّف fmt/fmtY/todayISO',
    !/^const fmt=/m.test(config) && !/^const fmtY=/m.test(config) && !/^function todayISO\(/m.test(config));
  t('config.js لم تعد تعرّف slugify/uniqueSlug',
    !/^function slugify\(/m.test(config) && !/^function uniqueSlug\(/m.test(config));
  t('dialogs.js خرج من قائمة الدمج النصي', !/CORE=\[[^\]]*'src\/app\/dialogs\.js'/.test(buildPy));
}

console.log('\n▸ الاستيراد الصريح لا يمرّ عبر globalThis');
// الفرق ليس شكليًا: لو ظلّ dialogs يقرأ esc من النطاق العام، لبقيت الدورة قائمة
// وبقي الترتيب مهمًّا. الدليل القاطع: احذف globalThis.esc ثم افتح حوارًا — إن ظلّ
// يرمّز، فالربط لغويّ داخل القطعة كما يجب.
{
  const dom = new JSDOM('<div id="dlgOverlay"></div><div id="dlgBox"></div>', { runScripts: 'dangerously' });
  const w = dom.window;
  w.eval(`window.supabase={createClient:()=>({rpc:()=>Promise.resolve({data:[],error:null}),
    from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null})})}),
    auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
    channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>{}})}`);
  const s2 = w.document.createElement('script');
  s2.textContent = bundle;
  w.document.body.appendChild(s2);

  ['esc', 'fmt', 'fmtY', 'todayISO', 'slugify', 'uniqueSlug', 'dialog', 'confirmDialog']
    .forEach(n => t(`${n} وصلت إلى globalThis`, typeof w[n] === 'function'));

  delete w.esc;
  t('esc أُزيلت من النطاق العام فعلًا', typeof w.esc === 'undefined');
  w.dialog({ title: '<b>x</b>' });
  const box = w.document.getElementById('dlgBox');
  t('الحوار ما زال يرمّز بعد إزالتها — الربط لغويّ لا عام',
    box.querySelectorAll('b').length === 0 && box.textContent.includes('<b>x</b>'));
}

console.log('\n▸ الدفعة الثالثة: app/contracttemplate.js — التغليف يظهر بأوضح صوره');
// عشرة أسماء في المستوى الأعلى، أربعة فقط يستدعيها أحد من الخارج. الستة الباقية
// كانت في النطاق العام بلا سبب — وأثقلها نصّا النموذجين: مستندان قانونيان كاملان
// مكشوفان لأي كود في المنصّة يمكنه تعديلهما.
{
  const ct = fs.readFileSync('src/app/contracttemplate.js', 'utf8');
  ['CONTRACT_TEMPLATES', 'mergeContract', 'renderMergedContractHTML', 'renderCustomContractHTML']
    .forEach(n => t(`${n} مُصدَّرة`, new RegExp(`export (function|const) ${n}\\b`).test(ct)));
  ['CONTRACT_TEMPLATE', 'CONTRACT_TEMPLATE_V2', 'fmtLong', 'ctrMdInline', 'ctrBodyHtml', 'ctrPartyTable']
    .forEach(n => t(`${n} لم تعد عامّة`, !new RegExp(`export (function|const) ${n}\\b`).test(ct)));
  t('تستورد esc من format لا من النطاق العام', /import \{ esc \} from '\.\.\/format\.js'/.test(ct));
  t('خرجت من قائمة الدمج النصي', !/CORE=\[[^\]]*contracttemplate/.test(buildPy));
}

console.log('\n▸ api.js — أكبر ملف، والتصغير صار ممكنًا');
{
  const api = fs.readFileSync('src/api.js', 'utf8');
  const exported = (api.match(/^export (async function|function|const|let|class)/gm) || []).length;
  // ١٦٤ بعد أن انتقلت ذاكرة أعضاء الفريق إلى جوار جالبها (+ensureMembersCache
  // +cachedTeamMembers): كانت رابطةً خاصّة في app/clienthome.js يقرؤها contractshub.
  t('١٦٤ اسمًا مُصدَّرًا', exported === 164, exported + ' تصريحًا مُصدَّرًا');
  ['fetchProjectCounts', 'ensureXLSX', '_planPayload', 'refreshClientContracts', 'fetchRolesFlat']
    .forEach(n => t(`${n} تبقى خاصّة`, !new RegExp(`^export (async )?function ${n}\\b`, 'm').test(api)));
  t('خرجت من الدمج النصي', !/CORE=\[[^\]]*'src\/api\.js'/.test(buildPy));

  // BUILD_V تُحقن في أول الحزمة لا داخل قطعة ESM (تُحسب من محتوى الحزمة كلها،
  // فحقنها في جزء منها دورٌ مغلق). كانت تُقرأ ضمنيًا، وأمسكها no-undef أول مرة
  // صار فيها دقيقًا على هذا الملف.
  {
    // يُفحَص الكود لا التعليقات: الترويسة تشرح BUILD_V فتذكره بلا بادئة.
    const code = api.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    const bare = (code.match(/(?<!\.)\bBUILD_V\b/g) || []).length;
    t('لا قراءة ضمنية واحدة باقية', bare === 0, bare + ' موضعًا بلا بادئة');
    // سبعة بعد استضافة xlsx ذاتيًا (AUDIT §د-٢): صارت تُحمَّل من نفس الأصل
    // ببصمة الإصدار كبقية الوحدات الكسولة، لا من cdnjs.
    t('وسبعة مواضع صريحة — كل تحميل كسول', (code.match(/globalThis\.BUILD_V/g) || []).length === 7);
  }
  // كان التأكيد هنا `/const BUILD_V=/` — وهذا **إملاء الوصول لا نتيجته**، فمرّ
  // العطل كاملًا: الإعلان بـconst في نص كلاسيكي يُنشئ رابطة معجمية لا خاصية على
  // globalThis، فكانت كل قراءة `globalThis.BUILD_V` تعطي undefined، وتُطلَب كل
  // وحدة كسولة بـ`?v=undefined` — كاسر تخزين مؤقت ميت منذ تحويل api.js.
  // فصار التأكيد على **القيمة الواصلة** لا على شكل السطر الذي يُفترض أن ينتجها.
  t('وbuild.py تحقنها خاصيةً على globalThis لا رابطةً معجمية',
    /globalThis\.BUILD_V=/.test(buildPy) && !/^core_js="const BUILD_V=/m.test(buildPy));

  // الوحدات الكسولة ربط متأخّر متعمَّد: الملف غير موجود أصلًا وقت تحميل الحزمة.
  ['dolOpen', 'importerOpen', 'pganttOpen', 'timelineRender', 'timelinePortfolio', 'trelloMenu']
    .forEach(n => t(`${n} تبقى مربوطة متأخّرًا`, new RegExp(`window\\.${n}\\b`).test(api)));
}

console.log('\n▸ التصغير: مساحة بلا فقد إمكانية التشخيص');
{
  // القرار: --minify-whitespace و--minify-syntax **دون** تصغير الأسماء. الأخير
  // يوفّر ١٦ KB ويكلّف أثرًا لا يُقرأ في كل تتبّع خطأ يصل من مستخدم.
  // تُقرأ **وسائط esbuild** لا الملف كله: التعليق أعلاها يذكر --minify-identifiers
  // ليشرح سبب استبعادها، فالفحص النصّي الساذج ينقلب على نفسه.
  const argsBlock = (buildPy.match(/subprocess\.run\(\[_esbuild[\s\S]*?\]/) || [''])[0];
  const flags = (argsBlock.match(/'--[a-z-]+'/g) || []).map(f => f.slice(1, -1));
  t('التصغير مفعَّل', flags.includes('--minify-whitespace') && flags.includes('--minify-syntax'));
  t('وتصغير الأسماء **ليس** مفعَّلًا',
    !flags.includes('--minify-identifiers') && !flags.includes('--minify'), flags.join(' '));
  t('فالأسماء تبقى مقروءة في الحزمة',
    bundle.includes('scheduleTasks') && bundle.includes('loadProject') && bundle.includes('computeTracking'));
  t('والقرار موثَّق بسببه', /تتبّع خطأ|خرائط مصدر/.test(buildPy));
}

// ═══ كاسر التخزين المؤقت يصل فعلًا إلى قطعة ESM ═══
//
// هذا هو التأكيد الذي كان **غائبًا** فمرّ العطل. كل ما سبقه يفحص المصدر: أن
// api.js تكتب `globalThis.BUILD_V`، وأن build.py تحقن سطرًا. وكلاهما كان صحيحًا
// والقيمة لا تصل — لأن `const` في نص كلاسيكي رابطة معجمية لا خاصية.
//
// فالفحص هنا يُحمّل الحزمة كما يُحمّلها المتصفح ويسأل عن **القيمة**:
{
  const dom = new JSDOM('<body></body>', { runScripts: 'dangerously' });
  const w = dom.window;
  w.eval(`window.supabase={createClient:()=>({rpc:()=>Promise.resolve({data:[],error:null}),
    from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null})})}),
    auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
    channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>{}})}`);
  const sc = w.document.createElement('script');
  sc.textContent = bundle;
  w.document.body.appendChild(sc);   // أخطاء ربط DOM متوقَّعة: لا هيكل

  const viaProperty = w.eval('globalThis.BUILD_V');
  const viaBare = w.eval('BUILD_V');
  t('قطعة ESM تقرأ بصمةً حقيقية لا undefined',
    /^[0-9a-f]{8}$/.test(String(viaProperty)), 'جاء ' + String(viaProperty));
  t('والكود القديم يقرأ الاسم المجرَّد كما كان', viaBare === viaProperty,
    String(viaBare) + ' مقابل ' + String(viaProperty));
  // والقيمة نفسها التي تُحقن في index.html — وإلا خُدمت نواة ووحدات كسولة من نشرتين.
  const inHtml = (fs.readFileSync('index.html', 'utf8').match(/v=([0-9a-f]{8})/) || [])[1];
  t('وهي بصمة index.html نفسها', inHtml === viaProperty, inHtml + ' مقابل ' + viaProperty);
}

// ═══ حجم النواة، والحرف العربي الذي كان يُهرَّب ═══
//
// انحدارٌ صامت مرّ بلا خطأ واحد: esbuild يُخرج بـ--charset=ascii افتراضيًا،
// فيهرّب كل محرف غير ASCII إلى \\uXXXX — **ستة بايتات بدل اثنين**. وواجهة هذا
// المشروع عربية بالكامل.
//
// ولم يظهر إلا بتقدّم W2 نفسه: كل ملف يتحوّل ينتقل من الدمج النصي (حيث نصّه كما
// هو) إلى قطعة esbuild (حيث يُهرَّب). فكانت النواة **تنمو كلما تحسّنت بنيتها**
// — ٥٢٠ ← ٦٢١ KB — ولا مقياس يشتكي.
//
// فحارسان: أن العلم موجود، وأن **النتيجة** عربية لا مهرَّبة. والثالث سقفٌ للحجم
// هو ما كان غيابه يسمح بالنموّ أصلًا.
{
  const argsBlock = (buildPy.match(/subprocess\.run\(\[_esbuild[\s\S]*?\]/) || [''])[0];
  t('--charset=utf8 مُفعَّل', /'--charset=utf8'/.test(argsBlock));

  // النتيجة لا الإملاء: الحزمة تحمل عربيًا حقيقيًا ولا تهريب لنطاق العربية.
  const arabic = (bundle.match(/[\u0600-\u06FF]/g) || []).length;
  const escaped = (bundle.match(/\\u06[0-9a-fA-F]{2}/g) || []).length;
  t('الحزمة تحمل نصًّا عربيًا حقيقيًا', arabic > 5000, arabic + ' محرفًا');
  t('ولا محرف عربي مهرَّب', escaped === 0, escaped + ' مهرَّبًا');

  // وسقف الحجم — ينقص ولا يزيد. غيابُه هو ما سمح بمئة كيلوبايت من النموّ الصامت.
  const KB = Math.round(bundle.length / 1024);
  const CORE_KB_CAP = 420;   // W2: 621 (ascii) ← 414 (utf8). الهدف < 250 (W6).
  t(`النواة ${KB} KB ≤ ${CORE_KB_CAP}`, KB <= CORE_KB_CAP,
    KB + ' KB — إن نقصت فأنزِل السقف');
}

console.log('\n▸ الجسر مؤقّت بطبيعته — موثَّق لا منسيّ');
t('bundle-entry يُصرّح أنه مرحلي', /مؤقّت|مرحلي/.test(entry));
t('يشرح سبب IIFE لا ESM', entry.includes('jsdom') && entry.includes('IIFE'));

console.log('\nنجح ' + ok + ' · فشل ' + fail);
process.exit(fail ? 1 : 0);

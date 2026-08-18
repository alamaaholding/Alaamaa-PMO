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
t('القطعة توضع **أولًا** — قبل الكود القديم الذي يقرأ منها',
  bundle.indexOf('وحدات ESM (esbuild)') < bundle.indexOf('===== config.js ====='));
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

console.log('\n▸ الجسر مؤقّت بطبيعته — موثَّق لا منسيّ');
t('bundle-entry يُصرّح أنه مرحلي', /مؤقّت|مرحلي/.test(entry));
t('يشرح سبب IIFE لا ESM', entry.includes('jsdom') && entry.includes('IIFE'));

console.log('\nنجح ' + ok + ' · فشل ' + fail);
process.exit(fail ? 1 : 0);

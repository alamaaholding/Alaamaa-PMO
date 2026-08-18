// ===== مصفوفة حالات محرك CPM (بند W7-1 من المسار الهندسي) =====
//
// لماذا هذا الملف: `src/engine.js` أخطر كود في المنصّة — كل تاريخ يراه المستخدم، وكل
// معلم، وكل حكم بالتأخير، وكل حساب طاقة يخرج منه. وكان — قبل هذا الملف — يُلمس من
// **ملف اختبار واحد** يفحص نصوصًا لا سلوكًا. الخطأ فيه لا يُسقط الصفحة عادةً؛ يُنتج
// تاريخًا خاطئًا بثقة، فيُتّخذ قرار حوكمي على أساسه. (AUDIT.md §هـ-١)
//
// المنهج: تحميل المحرك في سياق vm معزول واستدعاء دواله مباشرة — لا فحص نصوص ولا بناء
// DOM. كل قيمة متوقَّعة أدناه **قيست من المحرك نفسه ثم رُوجعت يدويًا** مقابل تقويم
// العمل، لا افتُرضت.
//
// تقويم العمل المعتمد: الجمعة (5) والسبت (6) عطلة + العطلات الرسمية من القاعدة.
// كل التواريخ هنا في أغسطس 2026:
//   الأحد 02 · الإثنين 03 · الثلاثاء 04 · الأربعاء 05 · الخميس 06 · [جمعة 07 · سبت 08]
//   الأحد 09 · الإثنين 10 · الثلاثاء 11 · الأربعاء 12 · الخميس 13 · [جمعة 14 · سبت 15]

const { execFileSync } = require('child_process');
const vm = require('vm');

// المحرك صار وحدة ESM (الموجة W2)، فلم يعد يُقرأ كسكربت. القدرة المفحوصة لم تتغيّر
// — 75 تأكيدًا كما هي — وإنما موضعها: يُحزَم بـesbuild في IIFE ويُشغَّل في سياق معزول.
// وهذا **أدقّ** من السابق: كان الاختبار يحقن D من عنده محاكيًا config.js، والآن تأتي
// من الوحدة نفسها كما تصل للمستخدم. (القاعدة الحاكمة السادسة: حدّث التأكيد، لا تعطّله.)
const built = execFileSync('node_modules/.bin/esbuild',
  ['src/engine.js', '--bundle', '--format=iife', '--global-name=__engine'],
  { encoding: 'utf8' });

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(built, ctx);
const { scheduleTasks, computeTracking, setHolidays, isWorkday, wdBetween } = ctx.__engine;

let ok = 0, fail = 0;
const t = (n, c, x) => { if (c) { ok++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? ' → ' + x : '')); } };
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const eq = (n, got, want) => t(n, got === want, `توقّعنا ${want} وجاء ${got}`);

/** بند افتراضي — يُغطَّى بما يمرَّر */
const T = (id, o = {}) => Object.assign(
  { id, name: id, type: 'task', duration: 1, deps: [], status: 'notstarted', progress: 0 }, o);
const S = (tasks, start = '2026-08-02') => scheduleTasks(tasks, start);

// ═════════════════════════════════════════════════════════════════
console.log('\n▸ ١) تقويم العمل');
// ═════════════════════════════════════════════════════════════════
setHolidays([]);
t('الأحد يوم عمل', isWorkday(new Date(2026, 7, 2)));
t('الخميس يوم عمل', isWorkday(new Date(2026, 7, 6)));
t('الجمعة عطلة', !isWorkday(new Date(2026, 7, 7)));
t('السبت عطلة', !isWorkday(new Date(2026, 7, 8)));
eq('wdBetween شامل الطرفين عبر نهاية أسبوع (الأحد→الأحد = 6 أيام عمل)',
  wdBetween(new Date(2026, 7, 2), new Date(2026, 7, 9)), 6);

setHolidays(['2026-08-04']);
t('العطلة الرسمية تُستثنى من أيام العمل', !isWorkday(new Date(2026, 7, 4)));
eq('العطلة الرسمية تُزيح النهاية: بند بـ3 أيام يمتد للأربعاء 05',
  iso(S([T('A', { duration: 3 })]).R.A.EF), '2026-08-05');
setHolidays([]);
t('setHolidays([]) تعيد الثلاثاء يوم عمل', isWorkday(new Date(2026, 7, 4)));

// ═════════════════════════════════════════════════════════════════
console.log('\n▸ ٢) المرور الأمامي — أنواع الروابط');
// ═════════════════════════════════════════════════════════════════
{
  const r = S([T('A', { duration: 3 }), T('B', { duration: 2, deps: ['A'] })]).R;
  eq('FS · A يبدأ في تاريخ بدء المشروع', iso(r.A.ES), '2026-08-02');
  eq('FS · A(3) ينتهي الثلاثاء 04', iso(r.A.EF), '2026-08-04');
  eq('FS · B يبدأ يوم العمل التالي لنهاية A', iso(r.B.ES), '2026-08-05');
  eq('FS · B(2) ينتهي الخميس 06', iso(r.B.EF), '2026-08-06');
}
{
  const r = S([T('A', { duration: 5 }), T('B', { duration: 3, deps: ['A'], depsX: [{ ref: 'A', type: 'SS', lag: 1 }] })]).R;
  eq('SS+1 · B يبدأ بعد يوم عمل من بداية A لا من نهايته', iso(r.B.ES), '2026-08-03');
  eq('SS+1 · مدة B تُحترم كاملة', iso(r.B.EF), '2026-08-05');
}
{
  const r = S([T('A', { duration: 5 }), T('B', { duration: 2, deps: ['A'], depsX: [{ ref: 'A', type: 'FF', lag: 0 }] })]).R;
  eq('FF+0 · B ينتهي مع A تمامًا — بلا فجوة يوم عمل', iso(r.B.EF), iso(r.A.EF));
  eq('FF+0 · بداية B مشتقّة عكسيًا من نهايتها ومدتها', iso(r.B.ES), '2026-08-05');
}
{
  const r = S([T('A', { duration: 5 }), T('B', { duration: 2, deps: ['A'], depsX: [{ ref: 'A', type: 'FF', lag: 2 }] })]).R;
  eq('FF+2 · نهاية B تتأخّر يومَي عمل عن نهاية A (عبر نهاية الأسبوع)', iso(r.B.EF), '2026-08-10');
}
{
  const r = S([T('A', { duration: 3 }), T('B', { duration: 2, deps: ['A'], depsX: [{ ref: 'A', type: 'FS', lag: -1 }] })]).R;
  eq('FS بإزاحة سالبة · B يتداخل مع A بيوم عمل', iso(r.B.ES), '2026-08-04');
  t('FS بإزاحة سالبة · التداخل حقيقي: بداية B ليست بعد نهاية A', r.B.ES <= r.A.EF);
}
{
  // سلوك مثبَّت لا حكم عليه: SS بإزاحة سالبة قد يدفع البند قبل تاريخ بدء المشروع.
  // رياضيًا صحيح (ابدأ قبل بداية السابق بيومين)، لكنه قرار نمذجة يستحق مراجعة الفريق.
  const S2 = S([T('A', { duration: 5 }), T('B', { duration: 3, deps: ['A'], depsX: [{ ref: 'A', type: 'SS', lag: -2 }] })]);
  eq('SS-2 · B يبدأ قبل بدء المشروع (سلوك مثبَّت — انظر التعليق)', iso(S2.R.B.ES), '2026-07-29');
  t('SS-2 · البداية قبل تاريخ بدء المشروع فعلًا', S2.R.B.ES < S2.pStart);
}

// ═════════════════════════════════════════════════════════════════
console.log('\n▸ ٣) أنواع البنود الخاصة');
// ═════════════════════════════════════════════════════════════════
{
  const r = S([T('A', { duration: 3 }), T('M', { type: 'milestone', duration: 0, deps: ['A'] })]).R;
  eq('المعلم بلا مدة: ES = EF', iso(r.M.ES), iso(r.M.EF));
  eq('المعلم يقع في نفس يوم نهاية سابقه — لا اليوم التالي', iso(r.M.EF), iso(r.A.EF));
}
{
  const r = S([T('A', { duration: 3 }), T('B', { duration: 6 }),
    T('M', { type: 'milestone', duration: 0, deps: ['A', 'B'] })]).R;
  eq('المعلم بعد مسارين ينتظر أبطأهما', iso(r.M.EF), iso(r.B.EF));
  t('المسار الأبطأ حرج والأسرع لا', r.B.critical && !r.A.critical);
}
{
  const s = S([T('A', { duration: 8 }), T('C', { type: 'cont', duration: 2 })]);
  eq('البند المستمر يمتد لنهاية المشروع مهما كانت مدته المعلنة', iso(s.R.C.EF), iso(s.pEnd));
  t('البند المستمر لا يُحتسب حرجًا أبدًا', s.R.C.critical === false);
  t('البند المستمر لا يمدّ نهاية المشروع بنفسه', iso(s.pEnd) === iso(s.R.A.EF));
}
{
  const r = S([T('A', { duration: 3 }), T('Z', { duration: 0, deps: ['A'] })]).R;
  eq('مدة صفرية تُعامَل كنقطة: ES = EF', iso(r.Z.ES), iso(r.Z.EF));
  eq('البند الصفري لا يقفز يوم عمل بعد سابقه', iso(r.Z.ES), iso(r.A.EF));
}
{
  const s = S([T('A', { duration: 3 }), T('F', { type: 'fixed', duration: 2, fixedDate: '2026-08-12' })]);
  eq('البند الثابت يبدأ في تاريخه المفروض لا في المشتقّ', iso(s.R.F.ES), '2026-08-12');
  t('البند الثابت حرج دائمًا بصرف النظر عن المهلة', s.R.F.critical === true && s.R.F.slack === 0);
  t('البند الثابت يمدّ نهاية المشروع', iso(s.pEnd) === '2026-08-13');
}

// ═════════════════════════════════════════════════════════════════
console.log('\n▸ ٤) المرور الخلفي — المهلة والمسار الحرج');
// ═════════════════════════════════════════════════════════════════
{
  const r = S([T('L', { duration: 6 }), T('Sh', { duration: 2 }), T('E', { duration: 1, deps: ['L', 'Sh'] })]).R;
  eq('الفرع الطويل بلا مهلة', r.L.slack, 0);
  eq('الفرع القصير يملك مهلة = فرق المدّتين بأيام العمل', r.Sh.slack, 4);
  t('الحرج يشمل الفرع الطويل والملتقى فقط', r.L.critical && r.E.critical && !r.Sh.critical);
  eq('LF للفرع القصير يساوي LF للفرع الطويل (كلاهما يغذّي E)', iso(r.Sh.LF), iso(r.L.LF));
}
{
  // المرور الخلفي يعكس المرور الأمامي بدقّة: LS/LF لسلسلة بلا مهلة = ES/EF نفسها.
  const r = S([T('A', { duration: 3 }), T('B', { duration: 2, deps: ['A'] }), T('C', { duration: 4, deps: ['B'] })]).R;
  ['A', 'B', 'C'].forEach(id => {
    t(`سلسلة حرجة · ${id}: LS = ES و LF = EF (عكس دقيق للمرور الأمامي)`,
      iso(r[id].LS) === iso(r[id].ES) && iso(r[id].LF) === iso(r[id].EF));
  });
}
{
  const r = S([T('A', { duration: 5 }), T('B', { duration: 3, deps: ['A'], depsX: [{ ref: 'A', type: 'SS', lag: 1 }] })]).R;
  t('SS · المرور الخلفي يحوّل قيد البداية لمكافئ نهاية (لا يخلط النوعين)',
    iso(r.A.LF) === '2026-08-09' && r.A.slack === 1);
}

// ═════════════════════════════════════════════════════════════════
console.log('\n▸ ٥) التبعية الدائرية — لا انهيار');
// ═════════════════════════════════════════════════════════════════
// سبب النشأة: كان المرور الخلفي يقرأ LS/LF للاحق لم يُحسب بعد (الترتيب الطبولوجي
// يسقط مع الدورة) فيرمي TypeError — فتفشل scheduleTasks ثم compute() ثم render()،
// وتبقى شاشة المشروع بيضاء بلا مخرج. والدورة قابلة للبلوغ: المستورد يحذّر منها ولا
// يمنعها، وbulkInsertDeps لا تتحقق منها إطلاقًا.
{
  let threw = null, s = null;
  try { s = S([T('A', { duration: 2, deps: ['B'] }), T('B', { duration: 2, deps: ['A'] })]); }
  catch (e) { threw = e; }
  t('دورة مباشرة A⇄B لا ترمي استثناءً', threw === null, threw && threw.message);
  t('الدورة تُبلَّغ عبر hasCycle', !!(s && s.hasCycle));
  t('الدورة تُنتج تحذيرًا نصيًا للمستخدم', !!(s && s.warnings.some(w => w.includes('دائرية'))));
  t('الجدولة تبقى كاملة رغم الدورة — لكل بند نتيجة', !!(s && s.R.A && s.R.B && s.R.A.LS && s.R.B.LS));
}
{
  let threw = null, s = null;
  try {
    s = S([T('A', { duration: 2, deps: ['C'] }), T('B', { duration: 2, deps: ['A'] }), T('C', { duration: 2, deps: ['B'] })]);
  } catch (e) { threw = e; }
  t('دورة ثلاثية A→B→C→A لا ترمي استثناءً', threw === null, threw && threw.message);
  t('دورة ثلاثية · لكل بند نتيجة كاملة', !!(s && ['A', 'B', 'C'].every(id => s.R[id] && s.R[id].LF)));
}
{
  const s = S([T('A', { duration: 3 }), T('B', { duration: 2, deps: ['A'] })]);
  t('المشروع السليم لا يُبلَّغ عنه كدورة', s.hasCycle === false && s.warnings.length === 0);
}

// ═════════════════════════════════════════════════════════════════
console.log('\n▸ ٦) حزم العمل');
// ═════════════════════════════════════════════════════════════════
{
  const tasks = [{ id: 'P', name: 'P', type: 'package', duration: 0, deps: [] },
    T('c1', { duration: 3, parent: 'P' }), T('c2', { duration: 5, parent: 'P' })];
  const r = S(tasks).R;
  eq('الحزمة تبدأ مع أبكر أبنائها', iso(r.P.ES), iso(r.c1.ES));
  eq('الحزمة تنتهي مع آخر أبنائها', iso(r.P.EF), iso(r.c2.EF));
  eq('مدة الحزمة تُحتسب بأيام العمل شاملة الطرفين', r.P.dur, 5);
  t('الحزمة حرجة إن كان أحد أبنائها حرجًا', r.P.critical === true);
  t('الحزمة مُعلَّمة كحزمة', r.P.pkg === true);
  t('الابن الأقصر يحتفظ بمهلته داخل الحزمة', r.c1.slack === 2);
}
{
  const r = S([{ id: 'PE', name: 'PE', type: 'package', duration: 0, deps: [] }, T('x', { duration: 2 })]).R;
  t('الحزمة الفارغة لا تنهار — تُعلَّم empty بمدة صفر', r.PE.empty === true && r.PE.dur === 0);
}

// ═════════════════════════════════════════════════════════════════
console.log('\n▸ ٧) المتابعة — computeTracking');
// ═════════════════════════════════════════════════════════════════
{
  const tasks = [T('A', { duration: 5, status: 'notstarted' })];
  const s = S(tasks);
  const at = dd => computeTracking(tasks, s, dd).A;
  eq('يوم البدء · تبدأ تلقائيًا', at('2026-08-02').effStatus, 'inprogress');
  eq('يوم البدء · لا تأخير بعد', at('2026-08-02').delay, null);
  eq('منتصف المدة · تقدّم تلقائي 50%', at('2026-08-04').autoPct, 50);
  eq('التقدّم التلقائي مسقوف بـ90% حتى الإنجاز اليدوي', at('2026-08-06').autoPct, 90);
  eq('بعد النهاية · السقف لا يُخترق', at('2026-08-10').autoPct, 90);
  eq('بند «لم تبدأ» بعد موعد بدايته = تأخير على علامة', at('2026-08-04').delay, 'alamah');
}
{
  const tasks = [T('A', { duration: 5, status: 'done', progress: 40 })];
  const s = S(tasks);
  const k = computeTracking(tasks, s, '2026-08-10').A;
  eq('المكتمل يُعرض 100% مهما كان التقدّم المسجَّل', k.dispPct, 100);
  eq('المكتمل لا يُحتسب متأخرًا أبدًا', k.delay, null);
}
{
  const mk = () => [T('R', { duration: 3, requirements: [
    { desc: 'ملف', owner: 'client', blocking: true, sla: 2, requested: '2026-08-02', received: null }] })];
  const run = dd => { const x = mk(), s = S(x); const k = computeTracking(x, s, dd).R; return { k, req: x[0].requirements[0] }; };
  const before = run('2026-08-03'), after = run('2026-08-06');
  eq('متطلب حاجز غير مُستلَم = البند متوقف', before.k.effStatus, 'blocked');
  eq('قبل تجاوز SLA · حالة المتطلب «بانتظار»', before.req._state, 'pending');
  eq('قبل تجاوز SLA · لا تأخير منسوب لأحد', before.k.delay, null);
  eq('بعد تجاوز SLA · حالة المتطلب «متأخر»', after.req._state, 'overdue');
  eq('بعد تجاوز SLA · التأخير يُنسب للشريك مالك المتطلب', after.k.delay, 'client');
  t('البند يبقى متوقفًا بعد تجاوز SLA', after.k.effStatus === 'blocked');
}
{
  const x = [T('R', { duration: 3, requirements: [
    { desc: 'ملف', owner: 'client', blocking: true, sla: 2, requested: '2026-08-02', received: '2026-08-09' }] })];
  const k = computeTracking(x, S(x), '2026-08-10').R;
  eq('المُستلَم بعد SLA يُوسَم latejust لا overdue', x[0].requirements[0]._state, 'latejust');
  t('المُستلَم — ولو متأخرًا — يرفع الحجب عن البند', k.blocked === false);
}
{
  const x = [T('R', { duration: 3, requirements: [
    { desc: 'مرجع', owner: 'client', blocking: false, sla: 1, requested: '2026-08-02', received: null }] })];
  const k = computeTracking(x, S(x), '2026-08-10').R;
  t('المتطلب غير الحاجز المتأخر لا يوقف البند', k.blocked === false && k.effStatus !== 'blocked');
}
{
  const tasks = [{ id: 'P', name: 'P', type: 'package', duration: 0, deps: [] },
    T('c1', { duration: 2, parent: 'P', status: 'done', progress: 100 }),
    T('c2', { duration: 6, parent: 'P', status: 'notstarted' })];
  const k = computeTracking(tasks, S(tasks), '2026-08-02');
  t('تقدّم الحزمة موزون بمدد أبنائها لا بعددهم', k.P.dispPct === 25, 'جاء ' + k.P.dispPct);
  eq('الحزمة «جارية» ما دام أحد أبنائها بدأ ولم يكتملوا', k.P.effStatus, 'inprogress');
  t('الحزمة مُعلَّمة كحزمة في المتابعة', k.P.pkg === true);
}

console.log('\nنجح ' + ok + ' · فشل ' + fail);
process.exit(fail ? 1 : 0);

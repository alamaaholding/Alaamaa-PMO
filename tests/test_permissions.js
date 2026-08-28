// ===== src/config.js — مصفوفة الصلاحيات ونطاق وصول الفريق =====
//
// لماذا هذا الملف موجود، وموضع نشأته مهم: `can()` و`canSeeProject()` هما الحكم
// الوحيد على مَن يعدّل ماذا ومَن يرى ماذا في المنصّة كلها — ولم يكن **أيّ** اختبار
// يلمسهما. اكتُشف ذلك في اللحظة التي كان يجب أن يُكتشف فيها: عند تحويل `config.js`
// إلى وحدة ESM، حيث أُعيدت صياغة قراءات الحالة الـ٣٩ داخل هذه الدوال بالذات.
//
// إعادة صياغة كود تفويض بلا اختبار يحرسه مقامرة، مهما بدت الصياغة مكافئة. فهذه
// المصفوفة تثبّت السلوك المقصود قبل أن يعتمد عليه أحد أكثر مما يعتمد اليوم.
//
// المبدأ الحاكم المكتوب في المصدر: **موظف بلا أي سجل في MY_ACCESS يرى كل شيء كما
// كان دائمًا.** نظام النطاقات يُضيف قيودًا على من خُصِّص له، ولا يقلب الافتراض على
// من لم يُخصَّص له شيء. أكثر من نصف التأكيدات أدناه تحرس هذا التوافق الخلفي تحديدًا،
// لأن كسره لا يُنتج خطأً — يُنتج موظفين لا يرون عملهم فجأة.

const fs = require('fs');
const { JSDOM } = require('jsdom');

let ok = 0, fail = 0;
const t = (n, c, x) => { if (c) { ok++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? ' → ' + x : '')); } };
const eq = (n, got, want) => t(n, got === want, `توقّعنا ${JSON.stringify(want)} وجاء ${JSON.stringify(got)}`);

const dom = new JSDOM('<body></body>', { runScripts: 'dangerously' });
const w = dom.window;
w.eval(`window.supabase={createClient:()=>({rpc:()=>Promise.resolve({data:[],error:null}),
  from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null})})}),
  auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>{}})}`);
const sc = w.document.createElement('script');
sc.textContent = fs.readFileSync('app.bundle.js', 'utf8');
w.document.body.appendChild(sc);   // أخطاء ربط DOM متوقَّعة: لا هيكل

/** يضبط الحالة عبر نفس المسار الذي يسلكه الكود القديم — إسناد بلا تصريح. */
const setup = o => {
  const d = { ROLE: 'pmo', IS_OWNER: false, MY_ACCESS: [], PID: null, CID: null,
              PROJ_DEPTS: {}, CRS: [], PROJECT: null };
  Object.assign(d, o);
  for (const k in d) w.eval(`${k} = ${JSON.stringify(d[k])}`);
};
const EDIT = ['editStruct', 'editProg', 'editReqs', 'approveContract'];

console.log('\n▸ الأدوار الثلاثة — الحدّ الأساسي قبل أي تخصيص');
setup({ ROLE: 'pmo' });
EDIT.forEach(p => t(`pmo يملك ${p}`, w.can(p) === true));
setup({ ROLE: 'delivery' });
['editStruct', 'editProg', 'editReqs'].forEach(p => t(`delivery يملك ${p}`, w.can(p) === true));
eq('delivery لا يعتمد العقود', w.can('approveContract'), false);
setup({ ROLE: 'client' });
EDIT.forEach(p => eq(`client لا يملك ${p}`, w.can(p), false));
setup({ ROLE: 'unknown-role' });
eq('دور غير معروف لا يملك شيئًا', w.can('editStruct'), false);
setup({ ROLE: null });
eq('بلا دور لا يملك شيئًا', w.can('editStruct'), false);

console.log('\n▸ التوافق الخلفي: بلا تخصيص = بلا قيود');
// هذا هو المبدأ الذي يحمي كل موظف قائم. كسره لا يُنتج خطأً — يُنتج موظفين
// لا يرون عملهم فجأة، وهو أسوأ من العطل الصريح.
setup({ ROLE: 'pmo', MY_ACCESS: [], PID: 'p1' });
EDIT.forEach(p => t(`MY_ACCESS فارغة → ${p} مسموح`, w.can(p) === true));
t('canSeeProject تسمح بأي مشروع', w.canSeeProject('p-any', 'dept-any', 'c-any') === true);
eq('hasCompanyScope لغير المالك بلا تخصيص', w.hasCompanyScope(), false);

console.log('\n▸ المالك يتجاوز كل تخصيص');
setup({ ROLE: 'pmo', IS_OWNER: true, PID: 'p1',
        MY_ACCESS: [{ scope_type: 'project', scope_value: 'other', access_level: 'view' }] });
EDIT.forEach(p => t(`المالك يملك ${p} رغم تقييده صراحةً`, w.can(p) === true));
t('المالك يرى أي مشروع', w.canSeeProject('p-unrelated', null, null) === true);
t('hasCompanyScope للمالك', w.hasCompanyScope() === true);

console.log('\n▸ مستوى view يمنع التعديل ولا يمنع الرؤية');
setup({ ROLE: 'pmo', PID: 'p1',
        MY_ACCESS: [{ scope_type: 'project', scope_value: 'p1', access_level: 'view' }] });
EDIT.forEach(p => eq(`view → ${p} ممنوع`, w.can(p), false));
t('لكنه يرى المشروع نفسه', w.canSeeProject('p1', null, null) === true);
t('ولا يرى مشروعًا آخر', w.canSeeProject('p2', null, null) === false);

console.log('\n▸ مستوى edit يسمح');
setup({ ROLE: 'pmo', PID: 'p1',
        MY_ACCESS: [{ scope_type: 'project', scope_value: 'p1', access_level: 'edit' }] });
EDIT.forEach(p => t(`edit → ${p} مسموح`, w.can(p) === true));
// سجلّان على المشروع نفسه: الأعلى يفوز — وإلا لأبطل سجلٌّ ثانوي صلاحية ممنوحة.
setup({ ROLE: 'pmo', PID: 'p1', MY_ACCESS: [
  { scope_type: 'project', scope_value: 'p1', access_level: 'view' },
  { scope_type: 'project', scope_value: 'p1', access_level: 'edit' }] });
t('عند تعدّد السجلات يفوز الأعلى (edit)', w.can('editStruct') === true);

console.log('\n▸ نطاق الشركة يشمل كل شيء');
setup({ ROLE: 'pmo', PID: 'p1',
        MY_ACCESS: [{ scope_type: 'company', scope_value: null, access_level: 'edit' }] });
t('hasCompanyScope', w.hasCompanyScope() === true);
t('يرى أي مشروع', w.canSeeProject('p-any', 'd-any', 'c-any') === true);
t('ويعدّل', w.can('editStruct') === true);

console.log('\n▸ نطاق الشريك ونطاق القسم');
setup({ ROLE: 'pmo', MY_ACCESS: [{ scope_type: 'client', scope_value: 'c1', access_level: 'edit' }] });
t('يرى مشروع الشريك المخصَّص', w.canSeeProject('p9', 'dX', 'c1') === true);
t('ولا يرى مشروع شريك آخر', w.canSeeProject('p9', 'dX', 'c2') === false);
setup({ ROLE: 'pmo', MY_ACCESS: [{ scope_type: 'department', scope_value: 'تسويق', access_level: 'edit' }] });
t('يرى مشروع قسمه', w.canSeeProject('p9', 'تسويق', 'cZ') === true);
t('ولا يرى مشروع قسم آخر', w.canSeeProject('p9', 'مالية', 'cZ') === false);
t('ولا ينهار حين لا قسم للمشروع', w.canSeeProject('p9', null, null) === false);

console.log('\n▸ القسم يُقرأ من PROJ_DEPTS عند فحص التعديل');
// can() لا تتلقّى القسم؛ تستنتجه من PROJ_DEPTS[PID]. هذا ربط صامت يستحق تثبيتًا.
setup({ ROLE: 'pmo', PID: 'p5', PROJ_DEPTS: { p5: 'تسويق' },
        MY_ACCESS: [{ scope_type: 'department', scope_value: 'تسويق', access_level: 'view' }] });
eq('view عبر القسم يمنع التعديل', w.can('editStruct'), false);
setup({ ROLE: 'pmo', PID: 'p5', PROJ_DEPTS: { p5: 'تسويق' },
        MY_ACCESS: [{ scope_type: 'department', scope_value: 'تسويق', access_level: 'edit' }] });
t('edit عبر القسم يسمح', w.can('editStruct') === true);
console.log('\n▸ الفجوة مُغلَقة: «لا سجل مطابق» صارت «ممنوع»');
// كانت can() تفحص `=== 'view'` فقط، فتمرّ `null` — وهي أشدّ من 'view' لا أخفّ:
// تعني «مقيَّد ولا سجل واحد يشمل هذا المشروع». فمن مُنِح قراءةً على مشروع كانت
// الواجهة تسمح له بتعديل مشروع **لم يُمنح عليه شيئًا**، بينما تمنع من مُنِح
// قراءةً عليه — أي أن القيد كان ينقلب على نفسه.
//
// صارت تفحص `!== 'edit'`: يُقارَن ما هو مسموح لا ما هو ممنوع.
//
// وقد فُحصت السياسات على قاعدة البيانات قبل التغيير: كل كتابة محميّة بـ
// `pmo_is_staff() AND pmo_can_edit_project(project_id)`، وتلك تشترط منحًا
// صريحًا بمستوى edit. فالخادم كان يرفض الكتابة على أي حال — الأثر كان زرًّا
// يُعرَض ثم يفشل برسالة خام، لا خرقًا. ومع ذلك: طبقة دفاع ناقصة تُصلَح.
setup({ ROLE: 'pmo', PID: 'p5', PROJ_DEPTS: {},
        MY_ACCESS: [{ scope_type: 'department', scope_value: 'تسويق', access_level: 'edit' }] });
eq('بلا سجل مطابق: can تمنع', w.can('editStruct'), false);

setup({ ROLE: 'pmo', PID: 'p2',
        MY_ACCESS: [{ scope_type: 'project', scope_value: 'p1', access_level: 'view' }] });
t('مقيَّد على p1 لا يرى p2', w.canSeeProject('p2', null, null) === false);
eq('ولا يعدّله أيضًا', w.can('editStruct'), false);

// ═══ ما لا يجوز أن يتغيّر مع هذا الإصلاح ═══
// الخطر الحقيقي في تشديد قيد تفويض ليس أن يظلّ فضفاضًا، بل أن يمنع من لا يجب
// منعه. فهذه التأكيدات تحرس المسارات الثلاثة التي تمرّ **قبل** الفحص المُشدَّد.
setup({ ROLE: 'pmo', PID: 'p1', MY_ACCESS: [] });
EDIT.forEach(p => t(`بلا تخصيص إطلاقًا: ${p} يبقى مسموحًا`, w.can(p) === true));
setup({ ROLE: 'pmo', IS_OWNER: true, PID: 'p9',
        MY_ACCESS: [{ scope_type: 'project', scope_value: 'other', access_level: 'view' }] });
t('المالك يبقى فوق التخصيص', w.can('editStruct') === true);
setup({ ROLE: 'pmo', PID: null,
        MY_ACCESS: [{ scope_type: 'project', scope_value: 'p1', access_level: 'view' }] });
t('خارج مشروع بعينه لا قيد', w.can('editStruct') === true);
setup({ ROLE: 'pmo', PID: 'p1',
        MY_ACCESS: [{ scope_type: 'company', scope_value: null, access_level: 'edit' }] });
t('نطاق الشركة بـedit يبقى يعدّل', w.can('editStruct') === true);
setup({ ROLE: 'pmo', PID: 'p1',
        MY_ACCESS: [{ scope_type: 'company', scope_value: null, access_level: 'view' }] });
eq('ونطاق الشركة بـview يُمنع', w.can('editStruct'), false);

console.log('\n▸ بلا PID مفتوح لا يُطبَّق تقييد المشروع');
setup({ ROLE: 'pmo', PID: null,
        MY_ACCESS: [{ scope_type: 'project', scope_value: 'p1', access_level: 'view' }] });
t('خارج مشروع بعينه لا قيد على can', w.can('editStruct') === true);

console.log('\n▸ الأفعال غير التعديلية لا تخضع لنظام النطاقات');
setup({ ROLE: 'pmo', PID: 'p1',
        MY_ACCESS: [{ scope_type: 'project', scope_value: 'p1', access_level: 'view' }] });
eq('crAction للـpmo يبقى approve', w.can('crAction'), true);
setup({ ROLE: 'client' });
eq('crAction للشريك request (قيمة صادقة)', w.can('crAction'), true);

console.log('\n▸ openCRs — أي طلب يفتح البنية فعلًا');
const CR = (o) => Object.assign({ status: 'approved', executed_at: null, kind: 'add' }, o);
setup({ CRS: [CR({})] });
eq('طلب معتمَد غير منفَّذ وبنيوي', w.openCRs().length, 1);
t('structuralUnlocked معه', w.structuralUnlocked() === true);
setup({ CRS: [CR({ status: 'pending' })] });
eq('غير معتمَد لا يُحتسب', w.openCRs().length, 0);
setup({ CRS: [CR({ executed_at: '2026-01-01' })] });
eq('منفَّذ لا يُحتسب', w.openCRs().length, 0);
setup({ CRS: [CR({ kind: 'dates' })] });
eq('نوع غير بنيوي لا يُحتسب', w.openCRs().length, 0);
['add', 'remove', 'deps', 'other'].forEach(k => {
  setup({ CRS: [CR({ kind: k })] });
  eq(`النوع البنيوي ${k} يُحتسب`, w.openCRs().length, 1);
});
setup({ CRS: [] });
eq('قائمة فارغة', w.openCRs().length, 0);
t('structuralUnlocked=false بلا طلبات', w.structuralUnlocked() === false);

console.log('\n▸ الوحدة لا تسرّب ما لا يخصّ أحدًا');
// المفتاح المجهول عام بطبيعته ومحميّ بـRLS لا بالإخفاء — لكن لا داعي أصلًا لوجوده
// في النطاق العام: لا يستعمله إلا سطر إنشاء العميل داخل الملف.
t('SUPABASE_ANON لم تعد في النطاق العام', typeof w.SUPABASE_ANON === 'undefined');
t('EDIT_ACTIONS تفصيل داخلي', typeof w.EDIT_ACTIONS === 'undefined');
t('myAccessLevelFor تفصيل داخلي', typeof w.myAccessLevelFor === 'undefined');
t('myDeptScopes تفصيل داخلي', typeof w.myDeptScopes === 'undefined');
t('لكن الواجهة المقصودة تصل', typeof w.can === 'function' && typeof w.canSeeProject === 'function');

console.log(`\nنجح ${ok} · فشل ${fail}`);
process.exit(fail ? 1 : 0);

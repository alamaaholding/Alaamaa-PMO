// ===== src/app/state.js — الحالة المشتركة خلف نقطة واحدة (الموجة W2) =====
//
// AUDIT §أ-١: إحدى وعشرون رابطة `let` سائبة في نطاق مشترك، يملكها الجميع ولا
// يملكها أحد. القياس الذي حسم التصميم: **٦٩ موضع كتابة مقابل ٦٣١ موضع قراءة**.
// أي حلٍّ يفرض تعديل القراءات يعني فرقًا في سبعمئة موضع دفعةً واحدة — وهو ما
// تمنعه القاعدة الحاكمة الثانية صراحةً.
//
// فالحلّ واصفات (getter/setter) على globalThis تشير إلى كائن واحد تملكه الوحدة.
// وهذا الملف يحرس القيود التي ينهار الحلّ بسقوط أيٍّ منها:
//
//  ١) المفاتيح **واصفات لا قيم**. لو عاد أحدهم فنسخها بـObject.assign، تجمّدت
//     القيمة عند لحظة النسخ: يكتب الكود القديم `CID = x` فلا ترى الوحدة شيئًا،
//     وتُصبح الحالة نسختين تفترقان بصمت. هذا أخطر انحدار ممكن هنا، ولا يُنتج
//     خطأً واحدًا في الطرفية.
//  ٢) الكتابة والقراءة القديمتان تعملان **بلا تعديل حرف**. هذا شرط الهجرة كلها.
//  ٣) لا مفتاح يُضاف أو يُحذف بلا أن يعرف الجسر وESLint به.

const { execFileSync } = require('child_process');
const fs = require('fs');
const vm = require('vm');
const { JSDOM } = require('jsdom');

let ok = 0, fail = 0;
const t = (n, c, x) => { if (c) { ok++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? ' → ' + x : '')); } };
const eq = (n, got, want) => t(n, got === want, `توقّعنا ${JSON.stringify(want)} وجاء ${JSON.stringify(got)}`);

// ───────── الوحدة معزولة ─────────
const built = execFileSync('node_modules/.bin/esbuild',
  ['src/app/state.js', '--bundle', '--format=iife', '--global-name=__st'], { encoding: 'utf8' });
const ctx = { console, localStorage: { getItem: () => null, setItem() {} } };
vm.createContext(ctx);
vm.runInContext(built, ctx);
const S = ctx.__st;

console.log('\n▸ سطح الوحدة');
t('تُصدَّر STATE_KEYS', Array.isArray(S.STATE_KEYS));
t('تُصدَّر getState', typeof S.getState === 'function');
t('تُصدَّر setState', typeof S.setState === 'function');
eq('أربعة وعشرون مفتاحًا', S.STATE_KEYS.length, 24);   // +SCREEN +TFILTER +FOCUS_REF (W2)
t('القائمة مجمَّدة — لا تُعدَّل من الخارج', Object.isFrozen(S.STATE_KEYS));
// الكائن نفسه **لا يُصدَّر**: لو صُدِّر لالتفّ أي مستهلك حول نقطة الرصد بمرجع مباشر.
t('كائن الحالة نفسه لا يُصدَّر', S.state === undefined);

console.log('\n▸ القيم الابتدائية كما كانت قبل التحويل');
eq('ROLE', S.getState('ROLE'), null);
eq('IS_OWNER', S.getState('IS_OWNER'), false);
eq('PX', S.getState('PX'), 20);
eq('VIEW', S.getState('VIEW'), 'dashboard');
eq('PFILTER', S.getState('PFILTER'), 'all');
eq('PSORT', S.getState('PSORT'), 'alerts');
eq('PSEARCH', S.getState('PSEARCH'), '');
t('CLIENTS مصفوفة فارغة', Array.isArray(S.getState('CLIENTS')) && S.getState('CLIENTS').length === 0);
// instanceof لا يعبر حدود سياق vm — الصنف هناك غير الصنف هنا.
t('PEXPANDED مجموعة', S.getState('PEXPANDED').constructor.name === 'Set');
t('PALERTS مجموعة', S.getState('PALERTS').constructor.name === 'Set');
t('PROJ_DEPTS كائن', typeof S.getState('PROJ_DEPTS') === 'object');
t('DATA_DATE بصيغة ISO', /^\d{4}-\d{2}-\d{2}$/.test(S.getState('DATA_DATE')));

console.log('\n▸ القراءة والكتابة');
S.setState('CID', 'c-1');
eq('ما يُكتب يُقرأ', S.getState('CID'), 'c-1');
eq('setState تُرجع القيمة', S.setState('PX', 30), 30);
eq('والقيمة استقرّت', S.getState('PX'), 30);
S.setState('PX', 20);

console.log('\n▸ المفتاح المجهول خطأ صريح لا undefined صامتة');
// السبب: الخطأ المطبعي في اسم مفتاح حالة كان يُنتج `undefined` تمرّ في الشروط
// كقيمة كاذبة، فيظهر الأثر بعيدًا عن سببه. الآن يظهر عند مصدره.
let threwR = false, threwW = false;
try { S.getState('CIDD'); } catch (e) { threwR = /CIDD/.test(e.message); }
try { S.setState('CIDD', 1); } catch (e) { threwW = /CIDD/.test(e.message); }
t('getState ترفض مفتاحًا مجهولًا وتسمّيه', threwR);
t('setState ترفض مفتاحًا مجهولًا وتسمّيه', threwW);

console.log('\n▸ استعادة التفضيلات من localStorage');
{
  const saved = JSON.stringify({ PFILTER: 'mine', PSORT: 'name', PALERTS: ['blocked', 'reqs'] });
  const c2 = { console, localStorage: { getItem: () => saved, setItem() {} } };
  vm.createContext(c2); vm.runInContext(built, c2);
  eq('PFILTER مُستعاد', c2.__st.getState('PFILTER'), 'mine');
  eq('PSORT مُستعاد', c2.__st.getState('PSORT'), 'name');
  t('PALERTS مُستعادة كمجموعة', c2.__st.getState('PALERTS').has('blocked'));

  // localStorage محظور (وضع خاص) — ليس عطلًا، والتفضيلات ترجع لافتراضياتها.
  const c3 = { console, localStorage: { getItem() { throw new Error('blocked'); } } };
  vm.createContext(c3);
  let boom = false;
  try { vm.runInContext(built, c3); } catch (e) { boom = true; }
  t('تعذُّر localStorage لا يُسقط التحميل', !boom);
  t('والتفضيلات ترجع لافتراضياتها', c3.__st && c3.__st.getState('PFILTER') === 'all');
}

// ───────── الحزمة الحقيقية ─────────
console.log('\n▸ الجسر على الحزمة الحقيقية: واصفات لا نسخ');
{
  const dom = new JSDOM('<body></body>', { runScripts: 'dangerously' });
  const w = dom.window;
  w.eval(`window.supabase={createClient:()=>({rpc:()=>Promise.resolve({data:[],error:null}),
    from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null})})}),
    auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
    channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>{}})}`);
  const sc = w.document.createElement('script');
  sc.textContent = fs.readFileSync('app.bundle.js', 'utf8');
  w.document.body.appendChild(sc);   // أخطاء ربط DOM متوقَّعة: لا هيكل

  // القيد الأول، وهو الأخطر: لو صارت هذه قيمًا منسوخة لتجمّدت الحالة بصمت.
  let accessors = 0, dataProps = [];
  for (const k of S.STATE_KEYS) {
    const d = Object.getOwnPropertyDescriptor(w, k);
    if (d && typeof d.get === 'function' && typeof d.set === 'function') accessors++;
    else dataProps.push(k);
  }
  eq('كل المفاتيح الأربعة والعشرين واصفات', accessors, 24);
  t('ولا مفتاح واحد صار قيمة منسوخة', dataProps.length === 0, dataProps.join(' '));
  t('الواصفات قابلة للحذف يوم يكتمل التحويل',
    Object.getOwnPropertyDescriptor(w, 'CID').configurable === true);

  // القيد الثاني: ٦٣١ قراءة و٦٩ كتابة تعمل بلا تعديل حرف واحد فيها.
  w.eval("CID = 'c-42';");
  eq('الكتابة القديمة بلا تصريح تصل', w.CID, 'c-42');
  w.eval("PROJECT = {tasks:[1,2,3]};");
  eq('القراءة القديمة ترى ما كُتب', w.PROJECT.tasks.length, 3);
  w.eval("PROJECT.tasks.push(4);");
  eq('التعديل داخل الكائن يمرّ (لا نسخة)', w.PROJECT.tasks.length, 4);
  w.eval("PX = PX + 5;");
  eq('القراءة والكتابة في تعبير واحد', w.PX, 25);
  t('حراسة typeof الموروثة تبقى صحيحة', w.eval("typeof PROJECT !== 'undefined'"));
  t('PALERTS تبقى مجموعة عبر الجسر', w.eval("PALERTS instanceof Set"));

  console.log('\n▸ الجسر لا يخلط بين الحالة والدوال');
  const entry = fs.readFileSync('src/bundle-entry.js', 'utf8');
  t('الحالة تُنصَّب بـdefineProperty', /Object\.defineProperty\(globalThis/.test(entry));
  t('ولا تُمرَّر في Object.assign', !/Object\.assign\(globalThis[^)]*\bstate\b/.test(entry));
  t('السبب موثَّق لا منسيّ', /ينسخ القيمة مرة واحدة|تتجمّد/.test(entry));
}

console.log('\n▸ لا انحراف بين مصادر قائمة المفاتيح');
{
  const entry  = fs.readFileSync('src/bundle-entry.js', 'utf8');
  const esl    = fs.readFileSync('eslint.config.mjs', 'utf8');
  t('الجسر يقرأ القائمة من الوحدة لا يكرّرها', /STATE_KEYS/.test(entry) && !/'PROJECT_ACCESS_DENIED'/.test(entry));
  // ESLint مضطرّ لتكرارها (لا يستورد الوحدة)، فيقارنها آليًا بمصدرها ويتوقّف عند الفرق.
  t('ESLint يقارن قائمته بمصدرها', esl.includes('لا تطابق src/app/state.js'));
  const declared = [...esl.matchAll(/'([A-Z_][A-Z0-9_]+)'/g)].map(m => m[1]);
  t('كل مفاتيح الوحدة مُعلَنة في ESLint',
    S.STATE_KEYS.every(k => declared.includes(k)),
    S.STATE_KEYS.filter(k => !declared.includes(k)).join(' '));
}

console.log('\n▸ مفتاح pmo_pfilters له مالك واحد — الكتابة والقراءة معًا');
{
  // كانت `savePFilters` في app/main.js والاستعادة هنا: ملفّان يملكان مفتاح تخزين
  // واحد، ولا يعرف أحدهما الآخر. فأيّ تغيير في شكل المفتاح يجب أن يُطبَّق مرّتين
  // — وهو بالضبط ما يُنتج انحرافًا لا يُنتج خطأً.
  //
  // ويُفحَص هذا بالرحلة كاملةً: نكتب بوحدة، ونقرأ **بوحدة ثانية جديدة** من نفس
  // التخزين. فلو انحرف الشكل بين الطرفين لسقط الاختبار، ولا يسقط بأيّ فحص نصّي.
  const store = {};
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const mk = () => { const c = { console, localStorage: ls }; vm.createContext(c); vm.runInContext(built, c); return c.__st; };

  const A = mk();
  A.setState('PFILTER', 'late');
  A.setState('PSORT', 'name');
  A.setState('PALERTS', new Set(['over', 'risk']));
  A.savePFilters();
  t('الكتابة تصل إلى pmo_pfilters', typeof store.pmo_pfilters === 'string');

  const B = mk();   // وحدة جديدة تمامًا: تستعيد عند التحميل
  eq('PFILTER يعود كما كُتب', B.getState('PFILTER'), 'late');
  eq('PSORT يعود كما كُتب', B.getState('PSORT'), 'name');
  t('PALERTS يعود مجموعةً لا مصفوفة',
    B.getState('PALERTS').constructor.name === 'Set' && B.getState('PALERTS').has('risk'));

  // والمفتاح لا يُذكر خارج هذه الوحدة — وإلا عاد الانقسام من باب آخر.
  const others = ['src/app/main.js', 'src/app/portfolio.js', 'src/urlstate.js']
    .filter(f => fs.readFileSync(f, 'utf8').includes('pmo_pfilters'));
  t('ولا ملف آخر يمسّ المفتاح', others.length === 0, others.join(' '));

  // وتصل للكود القديم: ستّة مواضع في portfolio.js تناديها بلا تصريح.
  t('savePFilters مُجسَّرة بالاسم',
    /Object\.assign\(globalThis,\s*\{\s*savePFilters\s*\}\)/.test(fs.readFileSync('src/bundle-entry.js', 'utf8')));
}

console.log(`\nنجح ${ok} · فشل ${fail}`);
process.exit(fail ? 1 : 0);

// ===== src/undo.js — التراجع صار الافتراض لا الاستثناء (الموجة W5) =====
//
// AUDIT §ج-٢: النمط كان موجودًا وناضجًا — **وفي موضع واحد فقط**.
// `handleDeleteTask` تلتقط لقطة كاملة للبند (حقوله · روابطه بالاتجاهين ·
// متطلباته) ثم تعرض توستًا بزر تراجع يعيد بناءه كما كان. حلٌّ صحيح تمامًا،
// ومطبَّق مرة واحدة من بين خمسة عشر إجراءً هدّامًا.
//
// بل إن حوار حذف التعليق كان يقول حرفيًا **«لا يمكن التراجع»** — وعدٌ لم يكن
// ثمّة سبب تقنيّ لقطعه.
//
// ما يحرسه هذا الملف ترتيبٌ يسهل قلبه بلا أن يظهر خطأ: التوست **بعد** نجاح
// الحذف وبعد تحديث الشاشة. لو ظهر قبله، عُرض على المستخدم زرُّ تراجعٍ عن شيء
// لم يُحذف أصلًا — ونقره يُنشئ نسخة ثانية.

const { execFileSync } = require('child_process');
const fs = require('fs');
const { JSDOM } = require('jsdom');

let ok = 0, fail = 0;
const t = (n, c, x) => { if (c) { ok++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? ' → ' + x : '')); } };
const eq = (n, got, want) => t(n, got === want, `توقّعنا ${JSON.stringify(want)} وجاء ${JSON.stringify(got)}`);

// الوحدة تعتمد على toast الذي يحتاج DOM — فتُشغَّل في نافذة، لا في vm عارٍ.
const built = execFileSync('node_modules/.bin/esbuild',
  ['src/undo.js', '--bundle', '--format=iife', '--global-name=__u'], { encoding: 'utf8' });
const dom = new JSDOM('<body><div id="toastWrap"></div></body>', { runScripts: 'dangerously' });
const w = dom.window, doc = w.document;
w.eval(built);
const U = w.__u;
const wrap = doc.getElementById('toastWrap');
const clear = () => { wrap.innerHTML = ''; };
const undoBtn = () => wrap.querySelector('.undo-btn');

console.log('\n▸ الترتيب: التوست بعد الحذف وبعد التحديث');
{
  clear();
  const seen = [];
  // التوست يُرصد بمراقبة الحاوية: ظهور العنصر هو الحدث، لا استدعاء داخلي.
  const p = U.undoable({
    label: 'حُذف',
    remove: async () => { seen.push('remove'); },
    refresh: async () => { seen.push('refresh'); t('لا توست قبل التحديث', wrap.children.length === 0); },
    restore: async () => {}
  });
  p.then(() => {
    eq('remove ثم refresh بهذا الترتيب', seen.join('>'), 'remove>refresh');
    t('والتوست ظهر بعدهما', wrap.children.length === 1);
    t('وفيه زر تراجع', !!undoBtn());
    run2();
  });
}

function run2() {
  console.log('\n▸ فشل الحذف: لا توست تراجع إطلاقًا');
  clear();
  let refreshed = 0;
  U.undoable({
    label: 'حُذف',
    remove: async () => { throw new Error('صلاحية مرفوضة'); },
    refresh: async () => { refreshed++; },
    restore: async () => {}
  }).then(
    () => { t('الخطأ يجب أن يُرمى للمستدعي', false); run3(); },
    err => {
      t('الخطأ يُرمى للمستدعي كما كان', err.message === 'صلاحية مرفوضة');
      eq('ولا تحديث', refreshed, 0);
      eq('ولا توست تراجع عن شيء لم يُحذف', wrap.children.length, 0);
      run3();
    });
}

function run3() {
  console.log('\n▸ التراجع: يستعيد ثم يحدّث ثم يؤكّد');
  clear();
  const seen = [];
  U.undoable({
    label: 'حُذف البند',
    remove: async () => {},
    refresh: async () => { seen.push('refresh'); },
    restore: async () => { seen.push('restore'); },
    doneMsg: 'استُعيد البند'
  }).then(async () => {
    seen.length = 0;
    undoBtn().click();
    await tick(3);
    eq('restore ثم refresh', seen.join('>'), 'restore>refresh');
    t('ورسالة التأكيد المخصّصة تظهر', wrap.textContent.includes('استُعيد البند'));
    run4();
  });
}

function run4() {
  console.log('\n▸ فشل التراجع يُبلَّغ لا يُبتلع');
  clear();
  U.undoable({
    label: 'حُذف',
    remove: async () => {},
    refresh: async () => {},
    restore: async () => { throw new Error('الصفّ مفقود'); }
  }).then(async () => {
    undoBtn().click();
    await tick(3);
    t('يظهر سبب تعذّر التراجع', /تعذّر التراجع/.test(wrap.textContent));
    t('ونصّ الخطأ معه', /الصفّ مفقود/.test(wrap.textContent));
    run5();
  });
}

function run5() {
  console.log('\n▸ refresh اختياري');
  clear();
  U.undoable({ label: 'حُذف', remove: async () => {}, restore: async () => {} }).then(async () => {
    t('يعمل بلا refresh', wrap.children.length === 1);
    undoBtn().click();
    await tick(3);
    t('والتراجع كذلك', wrap.textContent.includes('استُعيد ما حُذف'));
    surface();
  });
}

function surface() {
  console.log('\n▸ التعميم: النمط خرج من موضعه الواحد');
  const views = fs.readFileSync('src/views.js', 'utf8');
  // ما كان يُفحَص في app/main.js انتقل كلّه إلى app/projectactions.js في W2.
  const pact = fs.readFileSync('src/app/projectactions.js', 'utf8');
  const life = fs.readFileSync('src/app/lifecycle.js', 'utf8');
  t('حذف التعليق صار قابلًا للتراجع', /label:'حُذف التعليق'/.test(views));
  t('حذف الطلب كذلك', /label:'حُذف الطلب'/.test(views));
  t('حذف المتطلب كذلك', /label:'حُذف المتطلب'/.test(pact));
  t('حذف المرحلة كذلك', /label:'حُذفت المرحلة/.test(life));
  // الوعد المكسور الذي صار صحيحًا
  t('حوار التعليق لم يعد يقول «لا يمكن التراجع»', !views.includes('حذف هذا التعليق؟ لا يمكن التراجع'));
  t('وحذف البند يبقى على نمطه الناضج', /toastUndo\('حُذف «'/.test(pact));

  console.log('\n▸ الحدود مُعلَنة لا مسكوت عنها');
  const src = fs.readFileSync('src/undo.js', 'utf8');
  t('مسح الخطة: لقطات الخطة هي شبكته', /savePlanSnapshot|لقطات الخطة/.test(src));
  t('حلّ الحزمة: مستثنى بسبب مذكور', /حلّ الحزمة/.test(src));
  t('وسبب اختيار اللقطة على الحذف الناعم موثَّق', /الحذف الناعم/.test(src));

  console.log(`\nنجح ${ok} · فشل ${fail}`);
  process.exit(fail ? 1 : 0);
}

function tick(n) { return new Promise(r => { let i = 0; const s = () => (++i >= n ? r() : setTimeout(s, 0)); setTimeout(s, 0); }); }

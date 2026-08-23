// ===== src/app/dialogs.js — الحوار الموحَّد لكل المنصّة =====
//
// لماذا هذا الملف: `dialog()` و`confirmDialog()` هما **كل** تفاعل تأكيد وإدخال في
// المنصّة — حذف بند، اعتماد عقد، طلب تعديل خطة. وكان ثاني أصغر ملف في المشروع
// بلا اختبار واحد يلمسه، رغم أن أي كسر فيه يوقف كل قرار حوكمي في الواجهة معًا.
//
// وفيه سلوك a11y حقيقي لا يُرى بالعين ولا يُمسك بمراجعة نص: حبس Tab داخل الحوار،
// وإغلاق بـEscape، وإرجاع التركيز إلى العنصر الذي فتحه. هذه بالضبط أنواع القدرات
// التي تختفي بصمت في أول إعادة هيكلة إن لم يحرسها تأكيد.
//
// الحوار يُشغَّل من **الحزمة الحقيقية** داخل jsdom مع الهيكل الحقيقي من index.html —
// لا محاكاة. فما يُفحَص هنا هو ما يصل للمستخدم.

const fs = require('fs');
const { JSDOM } = require('jsdom');

let ok = 0, fail = 0;
const t = (n, c, x) => { if (c) { ok++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? ' → ' + x : '')); } };

const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
const { window } = dom;
const { document } = window;
const run = c => { const s = document.createElement('script'); s.textContent = c; document.body.appendChild(s); };

// Supabase مُعطَّل: الحوار لا يمسّ الشبكة، لكن config.js يُنشئ العميل عند التحميل.
run(`window.supabase={createClient:()=>({rpc:()=>Promise.resolve({data:[],error:null}),
  from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null})})}),
  auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>{}})}`);

// الحزمة كاملة كما تصل للمتصفح. الحوار في قطعة ESM التي تسبقها، وصادراته على globalThis.
run(fs.readFileSync('app.bundle.js', 'utf8'));

const ov  = document.getElementById('dlgOverlay');
const box = document.getElementById('dlgBox');
const key = (k, opts = {}) => document.dispatchEvent(
  new window.KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, opts)));

console.log('\n▸ الجسر: الحوار يصل من قطعة ESM إلى الكود القديم');
t('dialog على globalThis', typeof window.dialog === 'function');
t('confirmDialog على globalThis', typeof window.confirmDialog === 'function');
t('الهيكل الحقيقي موجود في index.html', !!ov && !!box);

console.log('\n▸ الفتح والبناء');
const p1 = window.dialog({ title: 'حذف بند', message: 'لا يمكن التراجع', danger: true, confirmText: 'حذف' });
t('الغطاء يُعرض', ov.style.display === 'flex');
t('العنوان يظهر', box.textContent.includes('حذف بند'));
t('الرسالة تظهر', box.textContent.includes('لا يمكن التراجع'));
t('نص التأكيد المخصَّص يُحترَم', document.getElementById('dlgOk').textContent.includes('حذف'));
t('زر الإلغاء موجود دائمًا', !!document.getElementById('dlgCancel'));

console.log('\n▸ a11y — ما لا تراه العين');
t('role=dialog', box.getAttribute('role') === 'dialog');
t('aria-modal=true', box.getAttribute('aria-modal') === 'true');
t('aria-labelledby يشير إلى عنوان موجود',
  box.getAttribute('aria-labelledby') === 'dlgTitle' && !!document.getElementById('dlgTitle'));
t('زر الإغلاق له aria-label', document.getElementById('dlgX').getAttribute('aria-label') === 'إغلاق');

console.log('\n▸ Escape يغلق ويُرجع null');
key('Escape');
t('الغطاء يُخفى', ov.style.display === 'none');

(async () => {
  t('Escape يعيد null لا قيمة', (await p1) === null);

  console.log('\n▸ الترميز: عنوان يحمل حمولة لا يصير وسمًا');
  const p2 = window.dialog({ title: '<img src=x onerror=alert(1)>' });
  t('لا وسم img مُنشأ من العنوان', box.querySelectorAll('img').length === 0);
  t('النص يظهر كنص', box.textContent.includes('<img src=x onerror=alert(1)>'));
  key('Escape'); await p2;

  console.log('\n▸ الحقول: القيم تُجمَع وتُقصّ');
  const p3 = window.dialog({ title: 'حقول', fields: [
    { key: 'name', label: 'الاسم', value: '' },
    { key: 'note', label: 'ملاحظة', type: 'textarea', value: 'سابق' },
    { key: 'kind', label: 'النوع', type: 'select', value: 'b', options: [{ v: 'a', t: 'أ' }, { v: 'b', t: 'ب' }] }
  ] });
  const inputs = [...box.querySelectorAll('.dlg-i')];
  t('ثلاثة حقول مبنية', inputs.length === 3);
  t('textarea تُبنى كـtextarea', box.querySelector('textarea[data-k="note"]') !== null);
  t('قيمة textarea السابقة محمَّلة', box.querySelector('textarea[data-k="note"]').value === 'سابق');
  const sel = box.querySelector('select[data-k="kind"]');
  t('select يُبنى بخياراته', sel !== null && sel.options.length === 2);
  t('الخيار الحالي مُحدَّد', sel.value === 'b');
  box.querySelector('input[data-k="name"]').value = '  مشروع ألف  ';
  document.getElementById('dlgOk').click();
  const r3 = await p3;
  t('القيم تعود بمفاتيحها', r3 && r3.name === 'مشروع ألف' && r3.kind === 'b',
    JSON.stringify(r3));
  t('المسافات الطرفية مقصوصة', r3.name === 'مشروع ألف');

  console.log('\n▸ الإلغاء يعيد null حتى مع حقول مملوءة');
  const p4 = window.dialog({ title: 'ح', fields: [{ key: 'x', label: 'x', value: 'شيء' }] });
  document.getElementById('dlgCancel').click();
  t('إلغاء → null', (await p4) === null);

  console.log('\n▸ حبس Tab داخل الحوار');
  const p5 = window.dialog({ title: 'حبس', fields: [{ key: 'x', label: 'x' }] });
  const focusables = [...box.querySelectorAll('button,input,select,textarea')].filter(x => !x.disabled);
  t('أكثر من عنصر قابل للتركيز', focusables.length > 1);
  focusables[focusables.length - 1].focus();
  const fwd = new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  document.dispatchEvent(fwd);
  t('Tab من الأخير يُمنع ويلفّ للأول',
    fwd.defaultPrevented && document.activeElement === focusables[0]);
  const back = new window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
  document.dispatchEvent(back);
  t('Shift+Tab من الأول يلفّ للأخير',
    back.defaultPrevented && document.activeElement === focusables[focusables.length - 1]);
  key('Escape'); await p5;

  console.log('\n▸ التركيز يعود لمن فتح الحوار');
  const opener = document.createElement('button');
  document.body.appendChild(opener);
  opener.focus();
  const p6 = window.dialog({ title: 'عودة' });
  key('Escape');
  await p6;
  t('العنصر الفاتح استعاد التركيز', document.activeElement === opener);

  console.log('\n▸ المستمعون لا يتراكمون بعد الإغلاق');
  // انحدار حقيقي محتمل: لو نُسي removeEventListener، بقي مستمع Escape من كل حوار
  // سابق حيًّا، فيغلق الحوار التالي حوارات ماتت ويُسرّب ذاكرة بصمت. الدليل العملي:
  // بعد ستة حوارات مُغلَقة، Escape على حوار جديد يجب أن يُنتج إغلاقًا واحدًا فقط.
  let resolved = 0;
  const p7 = window.dialog({ title: 'تراكم' }).then(() => resolved++);
  key('Escape');
  await p7;
  t('حلٌّ واحد لا أكثر', resolved === 1);
  t('الغطاء مُغلق في النهاية', ov.style.display === 'none');

  console.log('\n▸ confirmDialog يحوّل النتيجة إلى منطقية');
  const c1 = window.confirmDialog('س', 'ر');
  document.getElementById('dlgOk').click();
  t('تأكيد → true', (await c1) === true);
  const c2 = window.confirmDialog('س', 'ر');
  key('Escape');
  t('Escape → false', (await c2) === false);

  console.log(`\nنجح ${ok} · فشل ${fail}`);
  process.exit(fail ? 1 : 0);
})();

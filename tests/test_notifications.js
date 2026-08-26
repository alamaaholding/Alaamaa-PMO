// ===== src/notifications.js — مركز الإشعارات (الموجة W5) =====
//
// AUDIT §ج: «الخطأ يختفي بعد ٣٫٢ ثانية بلا أثر يُراجَع». والقياس أسوأ مما وُصف:
//
//     ١٩٣ كتلة catch في المشروع
//      ٩٩ تُخبر المستخدم بـtoast
//      ٤٥ **فارغة تمامًا** — الخطأ يُبتلع
//       ٠ تُسجّل في الطرفية
//
// الصفر الأخير هو المفاجأة: لا سطر `console` واحد في المصدر كلّه. فكل خطأ إمّا
// توست يعيش ٣٫٢ ثانية ثم يزول، أو لا شيء. ولا موضع ثالث يُراجَع بعد فوات اللحظة.
//
// ما يحرسه هذا الملف أن الأثر **يبقى**: كل ما يمرّ بـtoast يُسجَّل، والسجلّ
// يُقرأ متى شاء المستخدم. وأن السجلّ نفسه لا يصير عبئًا — محدود السعة، ولا
// يسرّب مرجعًا يُعدَّل من الخارج، ولا يُخزَّن على القرص.

const { execFileSync } = require('child_process');
const fs = require('fs');
const vm = require('vm');
const { JSDOM } = require('jsdom');

let ok = 0, fail = 0;
const t = (n, c, x) => { if (c) { ok++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? ' → ' + x : '')); } };
const eq = (n, got, want) => t(n, got === want, `توقّعنا ${JSON.stringify(want)} وجاء ${JSON.stringify(got)}`);

// ───────── الوحدة معزولة ─────────
const built = execFileSync('node_modules/.bin/esbuild',
  ['src/notifications.js', '--bundle', '--format=iife', '--global-name=__n'], { encoding: 'utf8' });
const mk = () => { const c = { console }; vm.createContext(c); vm.runInContext(built, c); return c.__n; };

console.log('\n▸ التسجيل والقراءة');
{
  const N = mk();
  eq('يبدأ فارغًا', N.notifications().length, 0);
  N.record('حُفظ', 'ok'); N.record('تعذّر', 'err');
  eq('يسجّل الاثنين', N.notifications().length, 2);
  eq('الأحدث أولًا', N.notifications()[0].msg, 'تعذّر');
  eq('والنوع محفوظ', N.notifications()[0].kind, 'err');
  // instanceof لا يعبر حدود سياق vm — يُفحَص بالسلوك لا بالصنف.
  t('ومعه وقت', typeof N.notifications()[0].at.getTime === 'function');
  // نسخة لا مرجع: مستهلك يعدّل ما يُعاد إليه لا يمسّ السجلّ.
  const snap = N.notifications(); snap.length = 0; snap.push({ msg: 'دخيل' });
  eq('القراءة نسخة لا مرجع', N.notifications().length, 2);
}

console.log('\n▸ نوع غير معروف لا يُسقط الخبر');
{
  const N = mk();
  N.record('س', 'nonsense'); N.record('ص');
  eq('نوع مجهول يصير info', N.notifications()[1].kind, 'info');
  eq('وبلا نوع كذلك', N.notifications()[0].kind, 'info');
  N.record(null);
  eq('null يصير نصًا فارغًا لا ينهار', N.notifications()[0].msg, '');
}

console.log('\n▸ حدّ السعة — سجلّ بلا حدّ تسريبُ ذاكرة');
{
  const N = mk();
  for (let i = 1; i <= 260; i++) N.record('م' + i, 'info');
  eq('السعة محدودة بـ200', N.notifications().length, 200);
  eq('والأحدث محفوظ', N.notifications()[0].msg, 'م260');
  eq('والأقدم أُسقط', N.notifications()[199].msg, 'م61');
}

console.log('\n▸ عدّ غير المقروء');
{
  const N = mk();
  eq('يبدأ صفرًا', N.unseenCount(), 0);
  N.record('أ', 'ok'); N.record('ب', 'err'); N.record('ج', 'err');
  eq('ثلاثة غير مقروءة', N.unseenCount(), 3);
  eq('منها خطآن', N.unseenErrors(), 2);
  N.markAllSeen();
  eq('بعد القراءة صفر', N.unseenCount(), 0);
  eq('والأخطاء صفر', N.unseenErrors(), 0);
  N.record('د', 'warn');
  eq('والجديد بعدها يُعدّ', N.unseenCount(), 1);
  eq('ولا يُحتسب خطأً', N.unseenErrors(), 0);
  // المسح لا يُبقي عدّادًا معلّقًا
  N.clearNotifications();
  eq('المسح يُفرغ السجلّ', N.notifications().length, 0);
  eq('ولا يترك غير مقروء', N.unseenCount(), 0);
}

console.log('\n▸ الاشتراك');
{
  const N = mk();
  let hits = 0, last = null;
  const off = N.onNotification(e => { hits++; last = e; });
  N.record('أ', 'err');
  eq('المشترك يُستدعى', hits, 1);
  eq('ويصله المدخل', last && last.msg, 'أ');
  N.markAllSeen();
  t('ويُستدعى عند تغيّر الحالة أيضًا', hits === 2);
  off();
  N.record('ب');
  eq('وبعد الإلغاء لا يُستدعى', hits, 2);
  // مشترك ينهار لا يُسقط التسجيل ولا بقية المشتركين.
  let good = 0;
  N.onNotification(() => { throw new Error('boom'); });
  N.onNotification(() => good++);
  N.record('ج');
  eq('مشترك ينهار لا يوقف غيره', good, 1);
}

console.log('\n▸ لا تخزين على القرص');
// قرار مقصود: رسائل الأخطاء تحمل نصوص خادم قد تتضمّن معرّفات أو أسماء عملاء،
// وتخزينها على جهاز مشترك يوسّع سطح التسريب بلا مقابل.
{
  const src = fs.readFileSync('src/notifications.js', 'utf8');
  // يُفحَص الكود لا التعليقات: الترويسة تشرح سبب تجنّب localStorage فتذكره.
  const code = src.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  t('لا localStorage في الكود', !code.includes('localStorage'));
  t('لا sessionStorage', !code.includes('sessionStorage'));
  t('والسبب موثَّق في الترويسة', /سطح التسريب/.test(src));
}

// ───────── الحزمة الحقيقية ─────────
console.log('\n▸ الوصل بـtoast: كل ما يُعرَض يُسجَّل');
(async () => {

  const html = fs.readFileSync('index.html', 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window, doc = w.document;
  const run = c => { const s = doc.createElement('script'); s.textContent = c; doc.body.appendChild(s); };
  run(`window.supabase={createClient:()=>({rpc:()=>Promise.resolve({data:[],error:null}),
    from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null})})}),
    auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
    channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>{}})}`);
  run(fs.readFileSync('app.bundle.js', 'utf8'));

  const before = w.notifications().length;
  w.toast('حُفظ المشروع', 'ok');
  w.toast('تعذّر الحفظ', 'err');
  eq('التوست يُسجَّل', w.notifications().length - before, 2);
  eq('بنوعه', w.notifications()[0].kind, 'err');

  // الحالة التي كانت تضيع كليًا: إشعار قبل بناء الصفحة أو بعد هدمها.
  const wrap = doc.getElementById('toastWrap');
  const parent = wrap.parentNode; parent.removeChild(wrap);
  const n0 = w.notifications().length;
  w.toast('خطأ بلا حاوية', 'err');
  eq('يُسجَّل حتى بلا حاوية توست', w.notifications().length - n0, 1);
  parent.appendChild(wrap);

  console.log('\n▸ المركز في الهيكل الحقيقي');
  t('زر الجرس موجود', !!doc.getElementById('ntfBtn'));
  t('وله aria-haspopup', doc.getElementById('ntfBtn').getAttribute('aria-haspopup') === 'dialog');
  const ov = doc.getElementById('ntfOverlay');
  t('الغطاء موجود', !!ov);
  const box = ov.querySelector('.rqmodal');
  t('role=dialog', box.getAttribute('role') === 'dialog');
  t('aria-modal', box.getAttribute('aria-modal') === 'true');
  t('aria-labelledby يشير لعنوان موجود',
    box.getAttribute('aria-labelledby') === 'ntfTitle' && !!doc.getElementById('ntfTitle'));

  console.log('\n▸ الشارة');
  w.markAllSeen(); w.refreshNotificationBadge();
  const badge = doc.getElementById('ntfBadge');
  t('مخفية بلا جديد', badge.hidden);
  w.toast('تنبيه', 'warn'); w.refreshNotificationBadge();
  t('تظهر مع الجديد', !badge.hidden);
  eq('وتحمل العدد', badge.textContent, '1');
  t('وبلا صنف الخطأ', !badge.classList.contains('has-err'));
  w.toast('عطل', 'err'); w.refreshNotificationBadge();
  eq('العدد يتراكم', badge.textContent, '2');
  t('وصنف الخطأ يظهر', badge.classList.contains('has-err'));
  t('واسم الزر يذكر العدد', /2/.test(doc.getElementById('ntfBtn').getAttribute('aria-label')));

  console.log('\n▸ الفتح والعرض');
  doc.getElementById('ntfBtn').onclick();
  eq('الغطاء يُعرض', ov.style.display, 'flex');
  const body = doc.getElementById('ntfBody');
  t('الصفوف مبنية', body.querySelectorAll('.ntf-row').length > 0);
  t('نص الإشعار يظهر', body.textContent.includes('عطل'));
  t('وصنف النوع على الصف', !!body.querySelector('.ntf-row.ntf-err'));
  t('والفتح يُصفّر الشارة', badge.hidden);

  console.log('\n▸ الترميز داخل المركز');
  w.toast('الشريك «<img src=x onerror=alert(1)>»', 'ok');
  w.renderNotificationCenter();
  t('لا وسم يُبنى من نص المستخدم', body.querySelectorAll('img').length === 0);
  t('والنص يظهر كنص', body.textContent.includes('<img src=x onerror=alert(1)>'));

  console.log('\n▸ النسخ والمرجع للدعم');
  // معيار القبول في ROADMAP §W5: «كل رسالة خطأ قابلة للاسترجاع **والنسخ** بعد
  // اختفائها». الاسترجاع وحده لا يكفي — «ظهرت لي رسالة حمراء» لا يشخّص شيئًا.
  w.clearNotifications();
  w.toast('تعذّر الحفظ: constraint violation', 'err');
  w.renderNotificationCenter();
  const row = body.querySelector('.ntf-row');
  const ref = row.querySelector('.ntf-ref').textContent;
  t('لكل إشعار مرجع ظاهر', /^[A-Z0-9]{5}-\d+$/.test(ref), ref);
  const entry = w.notifications()[0];
  t('والمرجع نفسه من الوحدة', w.refOf(entry) === ref);
  const txt = w.copyTextOf(entry);
  t('نصّ النسخ يحمل المرجع', txt.includes(ref));
  t('ويحمل النوع', txt.includes('خطأ'));
  t('ويحمل وقتًا قابلًا للتحليل', /\d{4}-\d{2}-\d{2}T/.test(txt));
  t('ويحمل الرسالة كاملة', txt.includes('constraint violation'));

  const copyBtn = row.querySelector('[data-ntf-copy]');
  t('زر نسخ على الصف', !!copyBtn);
  t('وله aria-label يذكر المرجع', copyBtn.getAttribute('aria-label').includes(ref));

  // المرجع يميّز الجلسة: تبويبان مفتوحان ليسا واحدًا.
  const A = mk(), B = mk();
  A.record('x'); B.record('x');
  t('رمز الجلسة يختلف بين نافذتين', A.refOf(A.notifications()[0]) !== B.refOf(B.notifications()[0]));
  t('والتسلسل يبدأ من ١ في كلٍّ', A.refOf(A.notifications()[0]).endsWith('-1'));

  // المسار الاحتياطي: لا clipboard متاحًا (بروتوكول غير آمن أو رفض المستخدم).
  let copied = null;
  Object.defineProperty(w.navigator, 'clipboard', {
    configurable: true, value: { writeText: async v => { copied = v; } }
  });
  await w.copyEntry(entry.id);
  t('النسخ يمرّ عبر clipboard حين يتاح', copied === txt);
  Object.defineProperty(w.navigator, 'clipboard', {
    configurable: true, value: { writeText: async () => { throw new Error('denied'); } }
  });
  doc.execCommand = () => true;
  t('ورفض clipboard يسقط إلى المسار الاحتياطي', (await w.copyEntry(entry.id)) === true);
  t('ولا تبقى textarea مؤقتة في المستند', doc.querySelectorAll('.ntf-copy-sink').length === 0);
  doc.execCommand = () => false;
  t('وفشل المسارين يُبلَّغ لا يُبتلع', (await w.copyEntry(entry.id)) === false);
  t('ومعرّف غير موجود يُرجع false', (await w.copyEntry(99999)) === false);

  console.log('\n▸ المسح والإغلاق');
  doc.getElementById('ntfClear').onclick();
  t('المسح يُفرغ العرض', body.textContent.includes('لا إشعارات'));
  t('وزر المسح يُعطَّل عند الفراغ', doc.getElementById('ntfClear').disabled);
  doc.getElementById('ntfClose').onclick();
  eq('الإغلاق يُخفي', ov.style.display, 'none');
  doc.getElementById('ntfBtn').onclick();
  doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  eq('Escape يُغلق', ov.style.display, 'none');

  console.log(`\nنجح ${ok} · فشل ${fail}`);
  process.exit(fail ? 1 : 0);
})();

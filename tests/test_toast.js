// ===== src/toast.js — الإشعارات العابرة =====
//
// نشأ هذا الملف مع إخراج `toast` من app/main.js إلى وحدة مستقلة (W2). وأثناء
// قراءة الدالة سطرًا سطرًا لنقلها ظهر ما لم يكن ظاهرًا وهي مدفونة في ملف من
// ٩٠٠ سطر:
//
//     t.innerHTML = '<span>'+icon+'</span><span>'+msg+'</span>';
//                                                    ↑ بلا ترميز
//
// و`msg` ليست ثابتة: ثمانون موضعًا من أصل استدعاءاتها تركّب فيها قيمة. منها
// `e.message` القادمة من الخادم، ومنها اسم شريك **يكتبه المستخدم**:
//
//     toast('أُنشئ الشريك «'+r.name+'» — أضف مشروعه الأول من ⋮','ok')
//
// القسم الأخير أدناه يثبت الثغرة كما هي في هذه الدفعة (نقل خالص، بلا تغيير
// سلوك — القاعدة الحاكمة الثانية)، ثم تُغلَق في الدفعة التالية ويُقلَب التأكيد.

const fs = require('fs');
const { JSDOM } = require('jsdom');

let ok = 0, fail = 0;
const t = (n, c, x) => { if (c) { ok++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? ' → ' + x : '')); } };

const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window, doc = w.document;
const run = c => { const s = doc.createElement('script'); s.textContent = c; doc.body.appendChild(s); };
run(`window.supabase={createClient:()=>({rpc:()=>Promise.resolve({data:[],error:null}),
  from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null})})}),
  auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>{}})}`);
run(fs.readFileSync('app.bundle.js', 'utf8'));

const wrap = doc.getElementById('toastWrap');
const clear = () => { wrap.innerHTML = ''; };
const last = () => wrap.lastElementChild;

console.log('\n▸ الجسر والهيكل');
t('toast على globalThis', typeof w.toast === 'function');
t('toastUndo على globalThis', typeof w.toastUndo === 'function');
t('#toastWrap موجود في index.html الحقيقي', !!wrap);
t('لم تعد مُعرَّفة في app/main.js',
  !/^function toast\(/m.test(fs.readFileSync('src/app/main.js', 'utf8')));

console.log('\n▸ العرض والأنواع');
clear(); w.toast('تم الحفظ', 'ok');
t('عنصر واحد يُضاف', wrap.children.length === 1);
t('صنف toast', last().className.includes('toast'));
t('صنف النوع ok', last().className.includes('ok'));
t('النص يظهر', last().textContent.includes('تم الحفظ'));
t('أيقونة ok هي ✓', last().textContent.includes('✓'));
clear(); w.toast('خطأ', 'err');
t('أيقونة err هي ✕', last().textContent.includes('✕'));
clear(); w.toast('انتبه', 'warn');
t('أيقونة warn هي ⚠', last().textContent.includes('⚠'));
clear(); w.toast('عادي');
t('بلا نوع: صنف toast وحده', last().className.trim() === 'toast');
t('أيقونة افتراضية •', last().textContent.includes('•'));

console.log('\n▸ التراكم والاختفاء');
clear(); w.toast('١'); w.toast('٢'); w.toast('٣');
t('الإشعارات تتراكم لا تتبادل', wrap.children.length === 3);
t('الأحدث آخرًا', last().textContent.includes('٣'));

console.log('\n▸ غياب الحاوية لا يُسقط شيئًا');
// مسار حقيقي: إشعار يُطلق قبل بناء الصفحة أو بعد هدمها. تُنزَع الحاوية من
// المستند نفسه بدل بناء نافذة ثانية — أدقّ، ويُعاد ربطها بعدها.
const parent = wrap.parentNode, next = wrap.nextSibling;
parent.removeChild(wrap);
let threw = false;
try { w.toast('بلا حاوية', 'err'); w.toastUndo('بلا حاوية', () => {}); } catch (e) { threw = true; }
t('لا انهيار بلا #toastWrap', !threw, threw && 'رمت استثناءً');
parent.insertBefore(wrap, next);
t('الحاوية أُعيدت', doc.getElementById('toastWrap') === wrap);

console.log('\n▸ toastUndo');
clear(); let undone = 0;
w.toastUndo('حُذف البند', () => { undone++; });
t('صنف undo', last().className.includes('undo'));
t('زر التراجع موجود', !!last().querySelector('.undo-btn'));
t('نص الزر «تراجع»', last().querySelector('.undo-btn').textContent === 'تراجع');
const before = wrap.children.length;
last().querySelector('.undo-btn').click();
t('النقر يزيل الإشعار فورًا', wrap.children.length === before - 1);
setTimeout(() => {
  t('ونداء التراجع نُفِّذ', undone === 1);

  console.log('\n▸ الثغرة مُغلَقة — والرسالة نصّ لا HTML');
  // الحالة الحقيقية: اسم شريك يكتبه المستخدم يصل إلى toast عبر
  //   toast('أُنشئ الشريك «'+r.name+'» — أضف مشروعه الأول من ⋮','ok')
  clear(); w.toast('أُنشئ الشريك «<img src=x onerror=alert(1)>»', 'ok');
  t('لا وسم يُبنى من اسم يكتبه المستخدم', last().querySelectorAll('img').length === 0);
  t('والنص يظهر كنص كما كتبه', last().textContent.includes('<img src=x onerror=alert(1)>'));

  // المسار الثاني والأكثر شيوعًا: رسالة خطأ من الخادم قد تُعيد ما أُرسل إليه.
  clear(); w.toast('تعذّر الحفظ: ' + '<script>alert(1)</scr' + 'ipt>', 'err');
  t('حمولة من رسالة الخادم لا تصير سكربتًا', last().querySelectorAll('script').length === 0);
  t('ولا وسم واحد داخل خانة الرسالة',
    last().lastElementChild.children.length === 0);

  clear(); w.toastUndo('حُذف «<b>x</b>»', () => {});
  t('toastUndo تُرمّز أيضًا', last().querySelectorAll('b').length === 0);
  t('وزر التراجع يبقى سليمًا بعد الترميز', !!last().querySelector('.undo-btn'));

  // الأيقونة ثابتة داخلية ولا تُرمَّز — يجب أن تبقى ظاهرة كما هي.
  clear(); w.toast('نص', 'ok');
  t('الترميز لم يمسّ الأيقونة', last().textContent.includes('✓'));

  console.log(`\nنجح ${ok} · فشل ${fail}`);
  process.exit(fail ? 1 : 0);
}, 10);

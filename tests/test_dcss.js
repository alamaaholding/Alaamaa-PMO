// ===== اختبار: الهندسةُ المحسوبة تصل إلى العنصر بلا سمةِ أسلوب (W6) =====
//
// الدفعة السابقة أنهت النمط السطريّ **الثابت** (٥٢ ← صفر). وبقي ٩٢ ديناميكيًّا
// لا يصير صنفًا: عرضُ شريطٍ بالبكسل، إزاحتُه على محور الزمن، لونٌ آتٍ من القاعدة.
// فتحوّل حاملُها: `data-css` في الترميز، و`el.style.setProperty` بعد التصيير.
//
// وهذا الملف يحرس ثلاثة أمور، كلٌّ منها موضعُ عطلٍ صامت لو اختلّ:
//
// ١) **القسمة**: `data-css` نصٌّ يُقسَم على الفاصلة المنقوطة. القسمةُ الساذجة
//    تكسر `url(a;b)` — والعطل عندها صامت: تصريحٌ ناقص، لا استثناء.
// ٢) **الشمول**: المُراقِب يلتقط كل إدراجٍ في الشجرة. نسيانُ عنصرٍ يعني شريطًا
//    بلا عرض — **بلا أن يفشل شيء**، وهو أسوأ أنواع الأعطال.
// ٣) **التوقيت**: من يقيس في النبضة نفسها لا ينتظر المهمة الدقيقة. لذلك
//    `drawGanttLinks` تُطبِّق صراحةً قبل `getBoundingClientRect`.

const fs = require('fs');
const { JSDOM } = require('jsdom');

let ok = 0, fail = 0;
const t = (n, c, x) => { if (c) { ok++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? ' → ' + x : '')); } };
const eq = (n, got, want) => t(n, got === want, `جاء ${got} والمنتظر ${want}`);

// الوحدة ESM والاختبارات CJS — فتُستجوَب عبر الحزمة المبنيّة، وهي **الناتج
// المنشور فعلًا**: أقربُ إلى المتصفح من استيراد المصدر.
const dom = new JSDOM('<body><div id="h"></div></body>', { runScripts: 'dangerously' });
const w = dom.window;
w.eval(`window.supabase={createClient:()=>({rpc:()=>Promise.resolve({data:[],error:null}),
  from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null})})}),
  auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>{}})}`);
const sc = w.document.createElement('script'); sc.textContent = fs.readFileSync('app.bundle.js', 'utf8');
w.document.body.appendChild(sc);

// ───────────────────────────────────────────────────────────
console.log('\n▸ القسمة: الفاصلة المنقوطة في العمق صفر وحدها');
// ───────────────────────────────────────────────────────────
t('الوحدة وصلت عبر الجسر', typeof w.parseDecls === 'function' && typeof w.applyDataCss === 'function');

const pd = s => w.parseDecls(s).map(([p, v]) => p + '=' + v).join(' | ');

eq('تصريحان عاديّان', pd('right:10px;width:4px'), 'right=10px | width=4px');
eq('خاصّية مخصَّصة تُحفظ باسمها', pd('--tc:#C8A06B'), '--tc=#C8A06B');
eq('النسبة والفراغ الزائد', pd('  width : 62% ; '), 'width=62%');
eq('نصّ فارغ لا يُنتج شيئًا', pd(''), '');
eq('تصريح بلا نقطتين يُطرَح', pd('width'), '');

// الفاصلة المنقوطة **داخل قوس** ليست فاصلًا بين تصريحين. والقسمةُ الساذجة
// `split(';')` تعطي هنا ثلاثةَ أجزاء فتُنتِج `background=url(a` — تصريحًا
// مشوَّهًا يبتلعه المتصفح صامتًا. فهذه العيّنة هي ما يميّز الصحيح من الساذج.
eq('فاصلة منقوطة داخل قوس ليست فاصلًا',
  pd('background:url(a;b);width:2px'), 'background=url(a;b) | width=2px');
eq('والفاصلة العادية داخل دالة تمرّ كما هي',
  pd('background:color-mix(in srgb,#fff 14%,#000);color:red'),
  'background=color-mix(in srgb,#fff 14%,#000) | color=red');
eq('والنقطتان داخل القيمة لا تُعيدان القسمة',
  pd('background:url(https://x/y.png)'), 'background=url(https://x/y.png)');

// ───────────────────────────────────────────────────────────
console.log('\n▸ التطبيق: العنصر نفسه وذريّته');
// ───────────────────────────────────────────────────────────
{
  const d = w.document.createElement('div');
  d.setAttribute('data-css', 'width:30px');
  d.innerHTML = '<i data-css="right:5px"></i><b>لا شيء</b><u data-css="--tc:red"></u>';
  eq('يُعيد عدد العناصر المطبَّقة', w.applyDataCss(d), 3);
  eq('الجذر نفسه طُبِّق', d.style.width, '30px');
  eq('والذريّة', d.querySelector('i').style.right, '5px');
  eq('والخاصّية المخصَّصة', d.querySelector('u').style.getPropertyValue('--tc'), 'red');
  t('ومن لا سمة له يبقى بلا أسلوب', !d.querySelector('b').getAttribute('style'));

  // متماثل: إعادةُ التطبيق لا تُغيّر شيئًا — وهو ما يجيز للمُراقِب أن يمرّ
  // بعد النداء الصريح في `drawGanttLinks` بلا أثر.
  w.applyDataCss(d);
  eq('التطبيق متماثل', d.style.width, '30px');

  // السمة تبقى: هي الأصل الذي يشرح مصدر الهندسة.
  t('وسمة data-css تبقى بعد التطبيق', d.getAttribute('data-css') === 'width:30px');
}
{
  // عقدةٌ ليست عنصرًا (نصّ) لا تُعطب النداء.
  eq('عقدة نصّية تُعيد صفرًا', w.applyDataCss(w.document.createTextNode('x')), 0);
  eq('وغياب العقدة كذلك', w.applyDataCss(null), 0);
}

// ───────────────────────────────────────────────────────────
console.log('\n▸ التوقيت والتركيب: حارسان على المصدر');
// ───────────────────────────────────────────────────────────
{
  // الوحدة ورقةٌ في شجرة الاستيراد عمدًا: ناقلُ هندسةٍ لا يعرف شيئًا عن
  // التطبيق. أيُّ استيرادٍ فيها يجرّ معه دورةً محتملة ويمنع استعمالها من
  // الوحدات الكسولة (timeline · pgantt · dol) التي تبثّ `data-css` كذلك.
  const mod = fs.readFileSync('src/dcss.js', 'utf8');
  t('src/dcss.js بلا استيراد — ورقة في الشجرة', !/^\s*import\s/m.test(mod));
  t('وتُصدّر الثلاثة التي يعتمد عليها غيرها',
    ['parseDecls', 'applyDataCss', 'watchDataCss'].every(n => mod.includes('export function ' + n)));

  const entry = fs.readFileSync('src/bundle-entry.js', 'utf8');
  const iWatch = entry.indexOf('dcss.watchDataCss()');
  const iBoot = entry.indexOf('session.boot()');
  t('المُراقِب يُركَّب في مدخل الحزمة', iWatch > -1);
  t('وقبل الإقلاع — لا بعده', iWatch > -1 && iBoot > -1 && iWatch < iBoot,
    `watch@${iWatch} boot@${iBoot}`);

  // jsdom بلا تخطيط: `getBoundingClientRect` تُعيد أصفارًا دائمًا، فلا يمكن
  // إثباتُ هذا الترتيب سلوكيًّا. فيُحرَس على المصدر — داخل جسم الدالة وحده.
  const views = fs.readFileSync('src/views.js', 'utf8');
  const fnStart = views.indexOf('function drawGanttLinks()');
  const fnEnd = views.indexOf('\nfunction ', fnStart + 1);
  const body = views.slice(fnStart, fnEnd === -1 ? views.length : fnEnd)
    .split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  const iApply = body.indexOf('applyDataCss(');
  const iMeasure = body.indexOf('getBoundingClientRect(');
  t('drawGanttLinks تُطبِّق الهندسة', iApply > -1);
  t('وقبل أن تقيس', iApply > -1 && iMeasure > -1 && iApply < iMeasure,
    `apply@${iApply} measure@${iMeasure}`);
}

// ───────────────────────────────────────────────────────────
console.log('\n▸ الشمول: المُراقِب يلتقط ما لم يُنادَ له');
// ───────────────────────────────────────────────────────────
(async () => {
  const host = w.document.getElementById('h');
  host.innerHTML = '<div class="bar" data-css="right:12px;width:40px"></div>';
  const bar = host.querySelector('.bar');
  // قبل المهمة الدقيقة لم يُطبَّق بعد — وهذا **سبب وجود** النداء الصريح في
  // `drawGanttLinks`. تثبيتُه هنا يمنع أن يُظنّ المُراقِب متزامنًا.
  t('لم يُطبَّق في النبضة نفسها', !bar.getAttribute('style'));
  await Promise.resolve(); await Promise.resolve();
  eq('وطُبِّق في المهمة الدقيقة — قبل أول رسم', bar.style.right, '12px');
  eq('بكل تصريحاته', bar.style.width, '40px');

  // إدراجٌ بـ appendChild لا بـ innerHTML
  const late = w.document.createElement('span');
  late.setAttribute('data-css', '--pc:#123456');
  host.appendChild(late);
  await Promise.resolve(); await Promise.resolve();
  eq('والإدراج بـ appendChild كذلك', late.style.getPropertyValue('--pc'), '#123456');

  // ═══ وعلى قالبٍ حقيقيّ من المنصّة، لا عيّنةٍ مصنوعة للاختبار ═══
  // `renderStatusBadge` تبعث سمتَي `data-css` — واحدةً على الشارة بخاصّيتين
  // مخصَّصتين، وأخرى على النقطة بلون. وهي أقصر قالبٍ يجمع الحالتين، فتُثبِت
  // أن السلسلة تعمل من القالب إلى `getComputedStyle` لا في المجرَّد وحده.
  host.innerHTML = w.renderStatusBadge({ color: 'rgb(9,8,7)', bg: 'rgb(1,1,1)', label: 'متعثّر' });
  await Promise.resolve(); await Promise.resolve();
  const badge = host.querySelector('.pstatus-badge'), dot = host.querySelector('.pstatus-dot');
  eq('قالبٌ حقيقيّ: الشارة أخذت لونها', badge.style.getPropertyValue('--sc'), 'rgb(9,8,7)');
  eq('وخلفيّتها', badge.style.getPropertyValue('--sbg'), 'rgb(1,1,1)');
  eq('والنقطة داخلها', dot.style.background.replace(/ /g, ''), 'rgb(9,8,7)');

  // سمةٌ تُضاف على عنصرٍ قائم
  const already = w.document.createElement('em'); host.appendChild(already);
  await Promise.resolve();
  already.setAttribute('data-css', 'height:9px');
  await Promise.resolve(); await Promise.resolve();
  eq('وسمةٌ تُضاف بعد الإدراج', already.style.height, '9px');

  console.log(`\nنجح ${ok} · فشل ${fail}`);
  process.exit(fail ? 1 : 0);
})();

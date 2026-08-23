// ===== format.js — الترميز والتنسيق والمعرّفات =====
//
// لماذا يستحق ملف من ستين سطرًا اختبارًا خاصًا: `esc` تُستدعى **٣٩١ مرة** في هذا
// المشروع، وهي خطّ الدفاع الوحيد بين اسم عميل يكتبه مستخدم وبين `innerHTML`.
// كسرها لا يُسقط شيئًا — يفتح ثغرة صامتة في ٣٩١ موضعًا دفعةً واحدة.
//
// وبقيتها (fmtY / todayISO) تحسب تواريخ **محلّية**. الانزلاق إلى UTC هنا يُزحلق
// اليوم كاملًا لمن هم شرق غرينتش قبل الظهر أو غربها بعده — بلا أي خطأ ظاهر.
//
// الوحدة نقية بالكامل: لا حالة عامة ولا DOM. فتُحزَم وتُشغَّل في سياق معزول.

const { execFileSync } = require('child_process');
const vm = require('vm');

const built = execFileSync('node_modules/.bin/esbuild',
  ['src/format.js', '--bundle', '--format=iife', '--global-name=__fmt'],
  { encoding: 'utf8' });

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(built, ctx);
const M = ctx.__fmt;

let ok = 0, fail = 0;
const t = (n, c, x) => { if (c) { ok++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? ' → ' + x : '')); } };
const eq = (n, got, want) => t(n, got === want, `توقّعنا ${JSON.stringify(want)} وجاء ${JSON.stringify(got)}`);

console.log('\n▸ سطح الوحدة — ما يُصدَّر وما لا يُصدَّر');
['esc', 'fmt', 'fmtY', 'todayISO', 'slugify', 'uniqueSlug']
  .forEach(n => t(`تُصدَّر ${n}`, typeof M[n] === 'function'));
// المكسب الملموس من التحويل: اسمان خرجا من النطاق العام لأن لا أحد خارج الملف يحتاجهما.
t('AR_TRANSLIT لا تُصدَّر (خاصّة بالوحدة)', M.AR_TRANSLIT === undefined);
t('transliterateArabic لا تُصدَّر (خاصّة بالوحدة)', M.transliterateArabic === undefined);

console.log('\n▸ esc — الترميز');
eq('يرمّز <', M.esc('<b>'), '&lt;b&gt;');
eq('يرمّز &', M.esc('a & b'), 'a &amp; b');
eq('يرمّز "', M.esc('say "hi"'), 'say &quot;hi&quot;');
// الترتيب مهم: & يجب أن تُرمَّز أولًا وإلا صار &lt; هو &amp;lt;
eq('& قبل الباقي — لا ترميز مزدوج', M.esc('&lt;'), '&amp;lt;');
eq('null → نص فارغ', M.esc(null), '');
eq('undefined → نص فارغ', M.esc(undefined), '');
eq('صفر يبقى صفرًا لا فراغًا', M.esc(0), '0');
eq('false يبقى نصًا', M.esc(false), 'false');
eq('العربية تمرّ كما هي', M.esc('مشروع ألف'), 'مشروع ألف');
// حمولة XSS نموذجية: لا يبقى فيها وسم قابل للتنفيذ
t('وسم <script> يُبطَل', !/<script/i.test(M.esc('<script>alert(1)</script>')));
t('كسر السمة بعلامة اقتباس يُبطَل', !M.esc('" onerror="alert(1)').includes('"'));

console.log('\n▸ fmt / fmtY — التواريخ محلّية لا UTC');
eq('fmt يوم/شهر بصفر بادئ', M.fmt(new Date(2026, 7, 3)), '03/08');
eq('fmt لشهر من رقمين', M.fmt(new Date(2026, 11, 25)), '25/12');
eq('fmtY صيغة ISO كاملة', M.fmtY(new Date(2026, 0, 9)), '2026-01-09');
eq('fmtY يقبل نصًا كما يقبل Date', M.fmtY('2026-08-03T00:00:00'), '2026-08-03');
// الانزلاق الفعلي الذي تمنعه هذه الدالة: toISOString يعيد اليوم السابق قبل الظهر
// في أي إزاحة موجبة. هنا نثبّت أن الحساب من مكوّنات التاريخ المحلّي لا من UTC.
const local = new Date(2026, 7, 3, 1, 30);
eq('منتصف الليل+ساعة يبقى في يومه المحلّي', M.fmtY(local), '2026-08-03');
eq('آخر لحظة في اليوم تبقى في يومها', M.fmtY(new Date(2026, 7, 3, 23, 59)), '2026-08-03');
eq('todayISO = fmtY(اليوم)', M.todayISO(), M.fmtY(new Date()));
t('todayISO بصيغة YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(M.todayISO()));

console.log('\n▸ slugify — تقريب صوتي من العربية');
eq('اسم عربي بسيط (الهمزة تسقط، لا مقابل لها)', M.slugify('علاماء'), 'alama');
eq('المسافة تصير شرطة', M.slugify('شركة الرياض'), 'shrka-alryad');
eq('اللاتينية تمرّ بحروف صغيرة', M.slugify('Acme Corp'), 'acme-corp');
eq('الأرقام تبقى', M.slugify('مشروع 2026'), 'mshrwa-2026');
eq('الشرطات المكرّرة تُدمَج', M.slugify('a   b'), 'a-b');
eq('الشرطات الطرفية تُقصّ', M.slugify('  -abc-  '), 'abc');
eq('الفراغ التام يرجع القيمة الاحتياطية', M.slugify(''), 'client');
eq('null يرجع القيمة الاحتياطية', M.slugify(null), 'client');
eq('رموز فقط ترجع القيمة الاحتياطية', M.slugify('!!!'), 'client');
t('الناتج دائمًا [a-z0-9-]', /^[a-z0-9-]+$/.test(M.slugify('عميل Test #1 ٪')));

console.log('\n▸ uniqueSlug — التفرّد مقابل القائمة القائمة');
eq('لا تعارض → الأساس كما هو', M.uniqueSlug('Acme', [{ slug: 'other' }]), 'acme');
eq('قائمة فارغة', M.uniqueSlug('Acme', []), 'acme');
eq('قائمة غير مُمرَّرة', M.uniqueSlug('Acme'), 'acme');
eq('تعارض واحد → لاحقة 2', M.uniqueSlug('Acme', [{ slug: 'acme' }]), 'acme-2');
eq('تعارض متسلسل → أول رقم حرّ',
  M.uniqueSlug('Acme', [{ slug: 'acme' }, { slug: 'acme-2' }, { slug: 'acme-3' }]), 'acme-4');
// فجوة في التسلسل: 2 محجوز و3 حرّ — يجب أن يأخذ 3 لا 4
eq('يملأ الفجوة لا يقفز فوقها',
  M.uniqueSlug('Acme', [{ slug: 'acme' }, { slug: 'acme-2' }, { slug: 'acme-4' }]), 'acme-3');
eq('العناصر بلا slug تُتجاهَل بلا انهيار',
  M.uniqueSlug('Acme', [{ slug: null }, {}, { slug: 'acme' }]), 'acme-2');

console.log(`\nنجح ${ok} · فشل ${fail}`);
process.exit(fail ? 1 : 0);

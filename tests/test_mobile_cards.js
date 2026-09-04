// ===== عرض البطاقات على الجوال — قدرة قائمة بلا حارس =====
//
// AUDIT §ب-٤ ادّعى أن «جدول الـ13 عمودًا لا يملك عرض بطاقات؛ يُعالَج بالتمرير
// الأفقي». **الادّعاء خاطئ من أساسه:** `vCards()` موجودة وكاملة ومربوطة، وهي
// في المستودع **منذ أول دفعة فيه** — أي أنها سبقت ذلك التشخيص كله.
//
// وهذا رابع ادّعاء في التحليل تتبيّن فيه القدرة موجودة (تثبيت الأعمدة · جاهزية
// الوضع الداكن · عدد الملفات بلا اختبار · وهذا). والنمط واحد: بحثٌ عن اسم
// متوقَّع لم يُوجَد، فاستُنتج غياب القدرة.
//
// والخطر العملي من ذلك ليس الخطأ في الورقة، بل أن القدرة **لم يكن يحرسها تأكيد
// واحد** — فكانت قابلة للحذف سهوًا بناءً على التشخيص الخاطئ نفسه. هذا الملف
// يمنع ذلك.

const fs = require('fs');

let ok = 0, fail = 0;
const t = (n, c, x) => { if (c) { ok++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? ' → ' + x : '')); } };

const views = fs.readFileSync('src/views.js', 'utf8');
const main = fs.readFileSync('src/app/main.js', 'utf8');
const css = fs.readFileSync('src/styles.css', 'utf8');

console.log('\n▸ العرض موجود ومربوط');
t('vCards() معرَّفة', /function vCards\(/.test(views));
t('و vTable تختارها عند الجوال', /if\(MOBILE\)return .*vCards\(/.test(views));
t('والعتبة 700px', /matchMedia\('\(max-width:700px\)'\)/.test(views));
t('والحاوية تحمل نفس المعرّف #tbl', /<div id="tbl" class="cardwrap">/.test(views));

console.log('\n▸ يتبع تبدّل المقاس — لا يعلق على حالة الإقلاع');
// من يفتح على سطح المكتب ثم يضيّق النافذة (أو يدير جواله) يجب أن يرى البطاقات
// بلا إعادة تحميل. بلا هذا المستمع يبقى الجدول العريض عالقًا.
t('main.js يستمع لتبدّل المقاس', /matchMedia\('\(max-width:700px\)'\)/.test(main));
// الحالة تُقرأ من المتجر بعد تحوّل main.js إلى وحدة — المعنى واحد والإملاء تغيّر.
t('ويُعيد التصيير في تبويب الجدول', /getState\('VIEW'\)==='table'\)render\(\)/.test(main));
t('ويدعم المتصفحات القديمة (addListener)', /addListener/.test(main));

console.log('\n▸ ورقة الأنماط تسنده');
['cardwrap', 'tcard'].forEach(c => t(`.${c} مُعرَّف`, new RegExp('\\.' + c + '\\{').test(css)));
['crit', 'child', 'pkg'].forEach(m => t(`.tcard.${m} مُعرَّف`, new RegExp('\\.tcard\\.' + m + '\\{').test(css)));

console.log('\n▸ البطاقة تحمل ما لا يُعوَّض عنه');
// الموجز مقبول، وفقدان مسار إلى التفصيل ليس كذلك.
const cards = views.slice(views.indexOf('function vCards('), views.indexOf('function bindTable('));
t('الهوية (المعرّف والاسم)', /class="idcell"/.test(cards) && /class="tc-name"/.test(cards));
t('التواريخ', /fmt\(r\.ES\)/.test(cards) && /fmt\(r\.EF\)/.test(cards));
t('الحالة قابلة للتغيير', /data-f="status"/.test(cards));
t('التقدّم', /class="pbar mini"/.test(cards));
t('المتطلبات', /data-reqs=/.test(cards));
t('التبعيات', /data-deps=/.test(cards));
// وهذا أهمها: الباب إلى التفصيل الكامل، وهو ما يجعل إسقاط عمودين قرارًا لا عطلًا.
t('وزرّ لوحة البند — الباب إلى ما لا تعرضه البطاقة', /data-tkopen=/.test(cards));
t('وشارات الحالة الحرجة والتأخير', /tc-b crit/.test(cards) && /tc-b cl/.test(cards));
t('وحالة فارغة مفهومة', /لا بنود مطابقة/.test(cards));

console.log('\n▸ ونفس الفلترة لا فلترة ثانية');
// أخطر ما قد يُضاف لاحقًا: منطق تصفية مستقلّ للبطاقات ينحرف عن الجدول بصمت.
t('البطاقات تُبنى من visibleTasks() نفسها', /visibleTasks\(\)/.test(cards));
t('وشريط التصفية نفسه يُعرض معها', /projFilterBar\(\)\+vCards/.test(views));

console.log(`\nنجح ${ok} · فشل ${fail}`);
process.exit(fail ? 1 : 0);

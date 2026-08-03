# اختبارات منصة علامة

## التشغيل

```bash
npm test          # أو:  node tests/run.js
```

المشغّل ينفّذ أربع مراحل بالترتيب، ويتوقف عند أول إخفاق:

1. **البناء** — `build.py` يولّد `app.bundle.js` والملفات الجذرية من `src/`.
2. **فحص صياغي** — `node --check` على كل ملفات JS المصدرية والمُولَّدة.
3. **حارس التطابق** — يتأكد أن كل ملف مُولَّد يطابق مصدره.
4. **الاختبارات** — كل ملفات `tests/test_*.js`.

## لماذا حارس التطابق موجود

وقع خطأ حقيقي سابقًا: نُشر `src/styles.css` (المصدر) ونُسي `styles.css` (الجذري) — وهو **الملف الذي تخدمه الصفحة فعليًا**. فبقيت أنماط صفحة كاملة غائبة عن الموقع الحي رغم أن الكود المصدري سليم تمامًا، ولم يُكتشف إلا من لقطة شاشة.

الحارس يمنع تكرار ذلك **بنيويًا**، لا اعتمادًا على التذكّر.

## التكامل المستمر

`.github/workflows/tests.yml` يشغّل كل ما سبق عند كل دفعة إلى `main` وكل طلب دمج. أي إخفاق يوقف التدفّق.

يضيف التدفّق فحصًا سادسًا: أن الملفات المُولَّدة **المدفوعة** محدَّثة فعلًا — أي أن `build.py` لا يُنتج أي فرق عمّا في المستودع.

## التغطية الحالية

| الملف | الحالات | ماذا يغطي |
|---|---|---|
| `test_flexible_contracts` | 25 | نوعا العقد (قياسي/مخصَّص)، النطاق، بوابة الاعتماد الداخلي |
| `test_contract_export_attach` | 22 | التصدير المستقل، المرفقات، التكرار، حقول التعبئة |
| `test_contracts_restructure` | 18 | اللوحة الموحّدة، QR الفوري، المعاينة الحيّة |
| `test_expiry_email` | 17 | المدة والانتهاء والتجديد، الإرسال بالبريد وسجله |
| `test_contract_linking` | 16 | ربط/فك ربط عقد بمشروع، منع الربط المزدوج |
| `test_contract_templates` | 16 | نمط الأصل/النسخة، عزل نسخ الشركاء |
| `test_clause_editing` | 14 | النموذج الثاني، حذف/إضافة البنود بلا إزاحة ترقيم |
| `test_clause_direct_edit` | 14 | التحرير المباشر لنص البنود |
| `test_sign_and_print` | 14 | توقيع علامة، تخطيط الطباعة |

**المجموع: 156 حالة.**

## إضافة اختبار جديد

أنشئ `tests/test_<الموضوع>.js`. المشغّل يلتقطه تلقائيًا. النمط المتّبع:

```js
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8')
  .replace(/<script[^>]*src=[^>]*><\/script>/g, '');
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://pmo.alaamaa.com/' });
const w = dom.window;
const run = c => { const s = w.document.createElement('script'); s.textContent = c; w.document.body.appendChild(s); };

// محاكاة Supabase — تُحقن قبل الحزمة
run(`window.supabase = { createClient: () => ({ /* ... */ }) };`);
run(fs.readFileSync('app.bundle.js', 'utf8'));

run(`
  window.__R = [];
  const t = (n, c, x) => window.__R.push([n, !!c, x || '']);
  t('وصف ما يجب أن يتحقق', actualCondition === expected);
`);

let ok = 0, fail = 0;
w.__R.forEach(([n, c, x]) => {
  if (c) { ok++; console.log('  ✓ ' + n); }
  else { fail++; console.log('  ✗ ' + n + (x ? ' → ' + x : '')); }
});
console.log(`\nنجح ${ok} · فشل ${fail}`);   // ← المشغّل يقرأ هذا السطر
process.exit(fail ? 1 : 0);
```

**مهم:** سطر النتيجة بصيغة `نجح N · فشل N` — المشغّل يعتمد عليه في التجميع.

**ملاحظة على المسارات:** الاختبارات تقرأ ملفات المشروع بمسارات نسبية من جذر المستودع (`app.bundle.js`، `src/api.js`). المشغّل يثبّت مجلد العمل على الجذر، فلا تستخدم `__dirname` للوصول إليها.

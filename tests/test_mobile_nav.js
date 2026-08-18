// ===== اختبار: الجوال لا يفقد أداة تنقّل بلا بديل (W4، الجزء الثاني) =====
//
// سبب النشأة: كان `@media(max-width:900px){.qjump-wrap{display:none!important}}` يُخفي
// **أهم أداة تنقّل في المنصّة** على الجوال بلا أي بديل — فمَن يفتحها من هاتفه لا يملك
// طريقًا للقفز بين الشركاء والمشاريع إطلاقًا (AUDIT §ب-٤).
//
// المبدأ الحاكم في الحل: إعادة استخدام اللوحة ومنطقها نفسه (qjRender/qjGo) لا بناء
// واجهة بحث ثانية موازية — فالثانية تتفرّع عن الأولى بعد شهرين وتتناقض معها.

const fs = require('fs');
const { JSDOM } = require('jsdom');

let ok = 0, fail = 0;
const t = (n, c, x) => { if (c) { ok++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? ' → ' + x : '')); } };

const css  = fs.readFileSync('src/styles.css', 'utf8');
const html = fs.readFileSync('src/index.html', 'utf8');
const main = fs.readFileSync('src/app/main.js', 'utf8');

console.log('\n▸ البديل موجود ومربوط');
t('زر بحث في الرأس', html.includes('id="qjumpBtn"'));
t('الزر يحمل وصفًا لقارئ الشاشة', /id="qjumpBtn"[^>]*aria-label="بحث عن شريك أو مشروع"/.test(html));
t('الزر يعلن حالة الطيّ', /id="qjumpBtn"[^>]*aria-expanded="false"/.test(html));
t('زر إغلاق داخل اللوحة', html.includes('id="qjumpClose"') && html.includes('aria-label="إغلاق البحث"'));
t('الزر يظهر على الجوال فقط', css.includes('.qjump-btn,.qjump-x{display:none}') && /@media\(max-width:900px\)\{[\s\S]*?\.qjump-btn\{display:inline-flex/.test(css));

console.log('\n▸ اللوحة كاملة الشاشة بمعايير لمس سليمة');
t('اللوحة تفتح بصنف .open لا بنمط سطري', /\.qjump-wrap\.open\{[\s\S]*?position:fixed/.test(css));
t('حجم خط الحقل 16px — يمنع تكبير iOS التلقائي عند التركيز',
  /\.qjump-wrap\.open \.qjump-in\{[\s\S]*?font-size:16px/.test(css));
t('صفوف النتائج بهدف لمس ≥52px', /\.qjump-wrap\.open \.qjump-item\{[\s\S]*?min-height:52px/.test(css));
t('القائمة تتدفّق داخل اللوحة لا كقائمة منسدلة معلّقة',
  /\.qjump-wrap\.open \.qjump-list\{[\s\S]*?position:static/.test(css));

console.log('\n▸ المنطق مُعاد استخدامه لا مكرَّر');
t('لا دالة بحث ثانية — qjRender وحدها', (main.match(/function qjRender/g) || []).length === 1);
t('لا دالة انتقال ثانية — qjGo وحدها', (main.match(/function qjGo/g) || []).length === 1);
t('الزر يستدعي الفهرس نفسه (refreshQJIndex)', /qbtn\.onclick[\s\S]*?refreshQJIndex\(\)/.test(main));
t('qjGo تغلق اللوحة عبر qjClose', /async function qjGo\(item\)\{\s*qjClose\(\);/.test(main));

console.log('\n▸ السلوك — لا الترميز وحده');
{
  const dom = new JSDOM(`<button id="qjumpBtn" aria-expanded="false"></button>
    <div id="qjumpWrap" class="qjump-wrap open">
      <button id="qjumpClose"></button>
      <input id="qjumpInput" value="بحث">
      <div id="qjumpList"></div>
    </div>`);
  const w = dom.window, D = w.document;
  global.document = D;   // qjClose تستخدم $ المعرَّفة على document
  const $ = sel => D.querySelector(sel);
  const qjClose = new Function('$', main.match(/function qjClose\(\)\{[\s\S]*?\n\}/)[0] + '; return qjClose;')($);
  qjClose();
  t('qjClose تُغلق اللوحة', !$('#qjumpWrap').classList.contains('open'));
  t('qjClose تُفرغ الحقل', $('#qjumpInput').value === '');
  t('qjClose تُعيد aria-expanded إلى false', $('#qjumpBtn').getAttribute('aria-expanded') === 'false');
  t('qjClose تُخفي قائمة النتائج', $('#qjumpList').hidden === true);
  delete global.document;
}

console.log('\n▸ ما كان تشخيصًا خاطئًا — تثبيت الأعمدة موجود أصلًا');
// AUDIT §ب-٤ ادّعى غياب تثبيت عمود المعرّف. القياس أثبت وجوده بلا شرط مقاس.
// يُحرَس هنا كي لا يُحذف سهوًا ظنًّا أنه غير موجود.
t('عمود المعرّف مثبَّت', /#tbl th:nth-child\(1\),#tbl td:nth-child\(1\)\{position:sticky/.test(css));
t('عمود الاسم مثبَّت بعده', /#tbl th:nth-child\(2\),#tbl td:nth-child\(2\)\{position:sticky/.test(css));
t('رأس الجدول مثبَّت عموديًا', /#tbl th\{[^}]*position:sticky/.test(css));

console.log('\nنجح ' + ok + ' · فشل ' + fail);
process.exit(fail ? 1 : 0);

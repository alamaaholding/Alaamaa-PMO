// ===== src/theme.js + الوضع الداكن (الموجة W4) =====
//
// AUDIT §ب-٣ — وقد كان تشخيصي الأول فيه **خاطئًا**: كتبتُ أن «البنية جاهزة
// تمامًا» فتبيّن ٩١ لونًا صريحًا خارج :root، وهي التي كانت تبقى فاتحة مهما
// قُلبت الرموز. أُصلح ذلك أولًا (٩١ ← ١٢)، ثم أمكن هذا.
//
// وما يحرسه هذا الملف ليس «هل يوجد وضع داكن» بل الحالات التي تنكسر بصمت:
//
//  ١) من يفضّل الداكن في نظامه ثم يختار **الفاتح** في المنصّة. بلا الحارس
//     :not([data-theme="light"]) على كتلة prefers-color-scheme يعجز تمامًا —
//     يضغط «فاتح» فلا يحدث شيء، ولا خطأ يُفسّر له السبب.
//  ٢) رمز لونيّ يُضاف إلى :root ويُنسى في الكتلة الداكنة، فيبقى فاتحًا وحده
//     ويكسر التباين حوله.
//  ٣) ومضة بيضاء عند التحميل لو طُبِّق الوسم بعد بناء الصفحة.

const { execFileSync } = require('child_process');
const fs = require('fs');
const { JSDOM } = require('jsdom');

let ok = 0, fail = 0;
const t = (n, c, x) => { if (c) { ok++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? ' → ' + x : '')); } };
const eq = (n, got, want) => t(n, got === want, `توقّعنا ${JSON.stringify(want)} وجاء ${JSON.stringify(got)}`);

const css = fs.readFileSync('src/styles.css', 'utf8');
const root = css.match(/:root\{[\s\S]*?\n\}/)[0];

console.log('\n▸ الحالة الثالثة — أخطر ما في الوضع الداكن');
{
  // الإغلاق `\n  }\n}` لا `\n}\n}` — الكتلة الداخلية مُزاحة.
  const media = css.match(/@media\(prefers-color-scheme:dark\)\{[\s\S]*?\n {2}\}\n\}/);
  t('كتلة prefers-color-scheme موجودة', !!media);
  t('ومحروسة بـ:not([data-theme="light"])',
    /@media\(prefers-color-scheme:dark\)\{\s*:root:not\(\[data-theme="light"\]\)/.test(css));
  t('والاختيار الصريح له كتلته المستقلة', /:root\[data-theme="dark"\]\{/.test(css));
  // color-scheme يخبر المتصفح فيصبّغ عناصر النموذج وأشرطة التمرير أيضًا.
  t('color-scheme:dark مُعلَن', /color-scheme:dark/.test(css));
}

console.log('\n▸ لا رمز لونيّ منسيّ');
{
  const dark = css.match(/:root\[data-theme="dark"\]\{[\s\S]*?\n\}/)[0];
  const namesIn = b => new Set([...b.matchAll(/(--[a-z0-9-]+):/g)].map(m => m[1]));
  const R = namesIn(root), D = namesIn(dark);
  const valueOf = n => (root.match(new RegExp(n + ':\\s*([^;]+);')) || [])[1] || '';
  const colorish = [...R].filter(n => /#|rgba?\(/.test(valueOf(n)));
  // --on-solid استثناء مقصود: نصّ على أرضية ملوّنة صريحة (زر ذهبي، شارة حرجة).
  // قلبُه يُخفي النصّ عن أرضيته في الوضعين معًا.
  const missing = colorish.filter(n => !D.has(n) && n !== '--on-solid');
  t(`كل رمز لونيّ (${colorish.length}) مقلوب`, missing.length === 0, missing.join(' '));
  t('--on-solid مستثنى عمدًا ولم يُقلَب', !D.has('--on-solid'));
  // الظلال: rgba(26,26,26) على أرضية داكنة لا تُرى، فيختفي الارتفاع كله.
  t('الظلال مُعمَّقة لا منسوخة', /--e3:[^;]*rgba\(0,0,0,\.5/.test(dark));
  // الكتلتان يجب أن تحملا نفس القيم — وإلا اختلف المظهر بين الاختيار والنظام.
  const media = css.match(/@media\(prefers-color-scheme:dark\)\{[\s\S]*?\n {2}\}\n\}/)[0];
  const pairs = b => [...b.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map(m => m[1] + '=' + m[2].trim()).sort().join('|');
  eq('كتلتا الداكن متطابقتان قيمةً', pairs(dark), pairs(media));
}

console.log('\n▸ الدور المزدوج: --ink نصّ و--solid أرضية');
// أول ما ظهر عند فحص اللقطة الداكنة: ترويسة كل نافذة صارت شريطًا فاتحًا باهتًا.
// السبب أن --ink كان يُستعمل في دورين متناقضين — لون نصّ **وأرضية داكنة** —
// فقلبُه للنصّ يكسر الأرضية. نفس صنف العطل الذي رصده التشخيص في #fff
// (‎--paper مقابل --on-solid)، ولم يظهر إلا بالنظر.
{
  const body = css.replace(/:root[^{]*\{[\s\S]*?\n\}/g, '');
  t('لا --ink يُستعمل أرضيةً بعد اليوم', !/background:var\(--ink\)/.test(body));
  t('و--solid هو الأرضية الداكنة', (body.match(/background:var\(--solid\)/g) || []).length >= 13);
  t('--solid مُعرَّف في الفاتح', /--solid:#1A1A1A/i.test(root));
  const dark = css.match(/:root\[data-theme="dark"\]\{[\s\S]*?\n\}/)[0];
  t('ويبقى داكنًا في الوضع الداكن', /--solid:#0b0a09/i.test(dark));
  // الاختبار الحقيقي: النصّ على الأرضية الداكنة يبقى فاتحًا في الوضعين.
  t('--on-solid لا ينقلب', !/--on-solid:/.test(dark));
}

console.log('\n▸ الوحدة');
const built = execFileSync('node_modules/.bin/esbuild',
  ['src/theme.js', '--bundle', '--format=iife', '--global-name=__t'], { encoding: 'utf8' });
const mk = (stored, sysDark) => {
  const dom = new JSDOM('<html><body><button id="themeBtn"></button></body></html>', { runScripts: 'dangerously' });
  const w = dom.window;
  const store = { v: stored };
  Object.defineProperty(w, 'localStorage', { configurable: true, value: {
    getItem: () => (store.v === undefined ? null : store.v),
    setItem: (k, v) => { store.v = v; }
  } });
  w.matchMedia = () => ({ matches: !!sysDark });
  w.eval(built);
  return { w, doc: w.document, T: w.__t, store };
};

{
  const { T, doc } = mk(undefined, false);
  eq('بلا تفضيل محفوظ → auto', T.getTheme(), 'auto');
  t('و auto لا يوسم <html>', !doc.documentElement.hasAttribute('data-theme'));
  eq('و auto يتبع النظام (فاتح)', T.effectiveTheme(), 'light');
}
{
  const { T } = mk(undefined, true);
  eq('auto يتبع النظام (داكن)', T.effectiveTheme(), 'dark');
}
{
  const { T, doc, store } = mk('dark', false);
  eq('المحفوظ يُقرأ', T.getTheme(), 'dark');
  eq('ويُوسَم على <html>', doc.documentElement.getAttribute('data-theme'), 'dark');
  T.setTheme('light');
  eq('التبديل يوسم', doc.documentElement.getAttribute('data-theme'), 'light');
  eq('ويُحفظ', store.v, 'light');
  T.setTheme('auto');
  t('و auto **يزيل** الوسم بدل كتابة قيمة', !doc.documentElement.hasAttribute('data-theme'));
  eq('ويُحفظ كذلك', store.v, 'auto');
}
{
  // الحالة (١): يفضّل الداكن في نظامه ويختار الفاتح هنا.
  const { T, doc } = mk('light', true);
  eq('اختيار «فاتح» يُوسَم رغم أن النظام داكن', doc.documentElement.getAttribute('data-theme'), 'light');
  eq('و effectiveTheme يقول فاتح', T.effectiveTheme(), 'light');
}
{
  const { T } = mk(undefined, false);
  eq('الدورة: auto → light', T.cycleTheme(), 'light');
  eq('ثم dark', T.cycleTheme(), 'dark');
  eq('ثم تعود auto', T.cycleTheme(), 'auto');
}
{
  const { T } = mk('nonsense', false);
  eq('قيمة محفوظة غير معروفة → auto', T.getTheme(), 'auto');
}
{
  // التخزين محظور (وضع خاص): لا انهيار، والوضع يعمل بلا حفظ.
  const dom = new JSDOM('<html><body><button id="themeBtn"></button></body></html>', { runScripts: 'dangerously' });
  const w = dom.window;
  Object.defineProperty(w, 'localStorage', { configurable: true, value: {
    getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } } });
  w.matchMedia = () => ({ matches: false });
  let threw = false;
  try { w.eval(built); w.__t.setTheme('dark'); } catch (e) { threw = true; }
  t('حظر التخزين لا يُسقط شيئًا', !threw);
  eq('والوسم يُطبَّق رغم تعذّر الحفظ', w.document.documentElement.getAttribute('data-theme'), 'dark');
}

console.log('\n▸ الزر: اسمه يذكر الحالة والتالي');
{
  const { T, doc } = mk('light', false);
  T.refreshThemeButton();
  const b = doc.getElementById('themeBtn');
  t('الأيقونة تتغيّر مع الحالة', b.textContent === '☀');
  t('والاسم يذكر الحالة', b.getAttribute('aria-label').includes('فاتح'));
  t('ويذكر التالي — فلا يحتاج قارئ الشاشة أن يجرّب',
    b.getAttribute('aria-label').includes('داكن'));
  // الزر دورة من ثلاث حالات لا مفتاح، فـaria-pressed يصفه خطأً.
  t('ولا aria-pressed (ليس مفتاحًا ثنائيًا)', !b.hasAttribute('aria-pressed'));
  T.setTheme('dark'); t('أيقونة الداكن', b.textContent === '☾');
  T.setTheme('auto'); t('أيقونة التلقائي', b.textContent === '◐');
}

console.log('\n▸ على الحزمة: يُطبَّق قبل بناء الصفحة');
{
  const entry = fs.readFileSync('src/bundle-entry.js', 'utf8');
  t('theme أول استيراد في الجسر',
    entry.indexOf("from './theme.js'") < entry.indexOf("from './engine.js'"));
  t('والسبب موثَّق', /ومضة بيضاء/.test(entry));

  const dom = new JSDOM(fs.readFileSync('index.html', 'utf8'), { runScripts: 'dangerously' });
  const w = dom.window;
  w.eval(`try{Object.defineProperty(window,'localStorage',{value:{getItem:()=>'dark',setItem(){}}})}catch(e){}`);
  w.eval(`window.supabase={createClient:()=>({rpc:()=>Promise.resolve({data:[],error:null}),
    from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null})})}),
    auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
    channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>{}})}`);
  const sc = w.document.createElement('script'); sc.textContent = fs.readFileSync('app.bundle.js', 'utf8');
  w.document.body.appendChild(sc);
  eq('الوسم مطبَّق بمجرّد تحميل الحزمة', w.document.documentElement.getAttribute('data-theme'), 'dark');
  t('زر المظهر في الهيكل الحقيقي', !!w.document.getElementById('themeBtn'));
  t('ودوال المظهر وصلت عبر الجسر',
    typeof w.cycleTheme === 'function' && typeof w.effectiveTheme === 'function');
}

console.log(`\nنجح ${ok} · فشل ${fail}`);
process.exit(fail ? 1 : 0);

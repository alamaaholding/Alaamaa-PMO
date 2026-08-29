// ═══════════════════════════════════════════════════════════════════════
//  src/chrome.js · SCREEN في المتجر · app/exportcontract.js — الموجة W2
// ═══════════════════════════════════════════════════════════════════════
//
// الدفعة كلها جوابٌ على قياس، لا على ترتيب اعتباطي. رُسم الرسم البياني للتبعيات
// غير المُحوَّلة قبل اختيار الملف التالي، فظهر أن أربعة عشر ملفًا من سبعة عشر
// تعتمد على `app/main.js` — لا على منطقه، بل على **ثلاثة أسماء صغيرة فيه**:
//
//     SCREEN · hideChrome · showChrome
//
// وهذا نفس النمط الذي تكرّر في كل موجة W2: العقدة ليست في الملف الكبير بل في
// مساعدٍ صغير مدفون فيه (`esc` · `todayISO` · `toast`). فما يفكّها نقل السطور
// لا نقل الملف.
//
// وما يحرسه هذا الملف ثلاثة قيود ينهار الفكّ بسقوط أيٍّ منها:
//
//  ١) SCREEN **حالة** لا رابطة ملف — في المتجر، وواصفًا على globalThis، وتقرأ
//     وتُكتب من الكود القديم بلا تعديل حرف.
//  ٢) hideChrome/showChrome تفعلان ما كانتا تفعلانه **بالضبط** — بما في ذلك أن
//     showChrome لا تلمس #barClient (وهذا فرقٌ متعمَّد بينهما لا سهو).
//  ٣) exportcontract.js صارت وحدة، وخرجت من الدمج النصي، ووصلت عبر الجسر.

const fs = require('fs');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { JSDOM } = require('jsdom');

let ok = 0, fail = 0;
const t = (n, c, x) => { if (c) { ok++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? ' → ' + x : '')); } };
const eq = (n, got, want) => t(n, got === want, `توقّعنا ${JSON.stringify(want)} وجاء ${JSON.stringify(got)}`);

const chromeSrc = fs.readFileSync('src/chrome.js', 'utf8');
const mainSrc = fs.readFileSync('src/app/main.js', 'utf8');
const stateSrc = fs.readFileSync('src/app/state.js', 'utf8');
const exportSrc = fs.readFileSync('src/app/exportcontract.js', 'utf8');
const entry = fs.readFileSync('src/bundle-entry.js', 'utf8');
const buildPy = fs.readFileSync('build.py', 'utf8');
const bundle = fs.readFileSync('app.bundle.js', 'utf8');

const SB_STUB = () => ({ createClient: () => ({
  rpc: () => Promise.resolve({ data: [], error: null }),
  from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
  auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel: () => {} }) });

// العناصر الخمسة التي يتكوّن منها «الإطار»
const CHROME_IDS = ['barClient', 'kpisRow', 'tabs', 'lifeBadge', 'exportReport'];
const domHtml = '<body>' + CHROME_IDS.map(id => `<div id="${id}"></div>`).join('') + '</body>';

console.log('\n▸ chrome.js وحدة ورقة — لا تعتمد إلا على $');
{
  const imports = [...chromeSrc.matchAll(/from '([^']+)'/g)].map(m => m[1]);
  t('استيراد واحد فقط', imports.length === 1, imports.join(' '));
  eq('وهو config.js', imports[0], './config.js');
  t('تُصدَّر hideChrome', /^export function hideChrome\(/m.test(chromeSrc));
  t('تُصدَّر showChrome', /^export function showChrome\(/m.test(chromeSrc));
}

console.log('\n▸ وسلوكهما هو نفسه حرفيًا');
{
  const built = execFileSync('node_modules/.bin/esbuild',
    ['src/chrome.js', '--bundle', '--format=iife', '--global-name=__ch'], { encoding: 'utf8' });
  const dom = new JSDOM(domHtml);
  dom.window.supabase = SB_STUB();
  const ctx = { console, document: dom.window.document, window: dom.window,
    localStorage: { getItem: () => null, setItem() {} }, matchMedia: () => ({ matches: false, addEventListener() {} }) };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(built, ctx);
  const { hideChrome, showChrome } = ctx.__ch;
  const disp = id => dom.window.document.getElementById(id).style.display;

  hideChrome();
  CHROME_IDS.forEach(id => eq(`hideChrome يُخفي #${id}`, disp(id), 'none'));

  showChrome();
  // القيد الدقيق: showChrome **لا** تُعيد #barClient — مُناديها الوحيد
  // (openProject) يُظهره بنفسه لأنه مرتبط ببيانات العميل لا بالإطار.
  eq('showChrome يُبقي #barClient مخفيًّا — بخلاف الأربعة', disp('barClient'), 'none');
  CHROME_IDS.filter(id => id !== 'barClient')
    .forEach(id => eq(`showChrome يُعيد #${id}`, disp(id), ''));
  t('والفرق موثَّق لا مسكوت عنه', /barClient/.test(chromeSrc.slice(chromeSrc.indexOf('showChrome') - 500, chromeSrc.indexOf('export function showChrome'))));

  // #exportReport قد لا يوجد أصلًا لبعض الأدوار — والحارس `if(e)` هو ما يمنع
  // انهيار فتح أي شاشة عندهم. تُجرَّب الحالة فعلًا لا يُقرأ الشرط.
  const bare = new JSDOM('<body><div id="barClient"></div><div id="kpisRow"></div><div id="tabs"></div><div id="lifeBadge"></div></body>');
  bare.window.supabase = SB_STUB();
  const c2 = { console, document: bare.window.document, window: bare.window,
    localStorage: { getItem: () => null, setItem() {} }, matchMedia: () => ({ matches: false, addEventListener() {} }) };
  c2.globalThis = c2; vm.createContext(c2); vm.runInContext(built, c2);
  let threw = null;
  try { c2.__ch.hideChrome(); c2.__ch.showChrome(); } catch (e) { threw = e.message; }
  t('ولا تنهاران حين لا يوجد #exportReport', threw === null, threw);
}

console.log('\n▸ SCREEN صارت حالة لا رابطة ملف');
{
  t('لا `let SCREEN` باقية في app/main.js', !/^let SCREEN\b/m.test(mainSrc));
  t('وهي في متجر الحالة', /^ {2}SCREEN: 'portfolio',$/m.test(stateSrc));
  t('ولا تعريف لـhideChrome/showChrome باقيًا في main.js',
    !/^function (hide|show)Chrome\(/m.test(mainSrc));
}

console.log('\n▸ وتصل للكود القديم كما كانت — بلا تعديل حرف');
{
  const dom = new JSDOM(domHtml, { runScripts: 'dangerously' });
  const w = dom.window;
  w.eval(`window.supabase={createClient:()=>({rpc:()=>Promise.resolve({data:[],error:null}),
    from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null})})}),
    auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
    channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>{}})}`);
  const sc = w.document.createElement('script');
  sc.textContent = bundle;
  w.document.body.appendChild(sc);   // أخطاء ربط DOM متوقَّعة: هيكل ناقص

  const d = Object.getOwnPropertyDescriptor(w, 'SCREEN');
  t('SCREEN واصف لا قيمة منسوخة', !!d && typeof d.get === 'function' && typeof d.set === 'function');
  eq('قيمتها الابتدائية كما كانت', w.eval('SCREEN'), 'portfolio');
  w.eval("SCREEN='project';");
  eq('الكتابة القديمة بلا تصريح تصل', w.SCREEN, 'project');
  // وهذا ما لم يكن ممكنًا قبل النقل: الوحدات المُحوَّلة ترى القيمة نفسها.
  eq('والوحدة ترى ما كتبه الكود القديم', w.eval("globalThis.SCREEN"), 'project');

  t('hideChrome تصل عبر الجسر', typeof w.hideChrome === 'function');
  t('showChrome تصل عبر الجسر', typeof w.showChrome === 'function');
  t('buildContractDoc تصل عبر الجسر', typeof w.buildContractDoc === 'function');
  t('openContractExport تصل عبر الجسر', typeof w.openContractExport === 'function');
  // runPrintSafely كانت تُربط بـ`window.runPrintSafely=` صراحةً؛ الجسر يكفي الآن.
  t('runPrintSafely تصل عبر الجسر لا بإسناد يدوي', typeof w.runPrintSafely === 'function');
  t('ولا إسناد يدوي باقيًا في المصدر', !/window\.(runPrintSafely|openContractExport)=/.test(exportSrc));
}

console.log('\n▸ exportcontract.js صارت وحدة');
{
  t('خرجت من الدمج النصي', !/CORE=\[[\s\S]*?'src\/app\/exportcontract\.js'/.test(buildPy));
  t('ودخلت الجسر', /import \* as exportContract from '\.\/app\/exportcontract\.js';/.test(entry)
    && /Object\.assign\(globalThis,[^)]*exportContract/.test(entry));
  // القياس الذي بُني عليه الاختيار: صفر تبعية غير مُحوَّلة. أي أن كل ما تستورده
  // وحدةٌ سبقتها — ولا اسم واحد يُقرأ من النطاق المشترك.
  const froms = [...exportSrc.matchAll(/from '([^']+)'/g)].map(m => m[1]);
  const known = ['../api.js', '../toast.js', './dialogs.js', './contracttemplate.js',
    '../config.js', '../format.js', './state.js'];
  t('كل استيراداتها وحدات محوَّلة', froms.every(f => known.includes(f)), froms.join(' '));

  // الحالة تُقرأ حيّةً لا مرة واحدة: بين القراءات انتظاران، والتقاطها في const
  // كان سيغيّر السلوك بصمت لو تبدّل المشروع أثناءهما.
  t('لا التقاط للحالة في const قبل الانتظار',
    !/const PROJECT\s*=\s*getState\('PROJECT'\)/.test(exportSrc));
  t('بل قراءة عند كل موضع', (exportSrc.match(/getState\('PROJECT'\)/g) || []).length >= 4);

  // BUILD_V: القطعة لا تشارك النطاق المعجمي للحزمة، فتُقرأ خاصيةً صراحةً.
  t('BUILD_V تُقرأ من globalThis لا مجرَّدةً',
    /globalThis\.BUILD_V/.test(exportSrc) && !/(?<![.\w])BUILD_V/.test(exportSrc.replace(/globalThis\.BUILD_V/g, '')));
}

console.log('\nنجح ' + ok + ' · فشل ' + fail);
process.exit(fail ? 1 : 0);

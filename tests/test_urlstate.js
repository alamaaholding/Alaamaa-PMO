// ===== src/urlstate.js — الرابط يحمل ما يُرى (الموجة W5) =====
//
// AUDIT §ج-٤: الرابط يحمل **أين** أنت (شريك · مشروع · تبويب · بند) ولا يحمل
// **ماذا ترى**. فمن يصفّي المحفظة على «متوقفة + طلبات معلّقة» ثم يرسل الرابط
// لزميله، يفتح الزميل شاشة مختلفة تمامًا — ولا شيء ينبّه أيًّا منهما.
//
// وثلاث قواعد تحرسها التأكيدات أدناه، كلٌّ منها يُنتج عطلًا صامتًا لو انقلبت:
//
//  ١) الافتراضي لا يُكتب — وإلا صار كل رابط في المنصّة مذيَّلًا بضجيج،
//     فيتجنّب الناس نسخه، فتضيع الميزة كلها.
//  ٢) الرابط يفوز على localStorage — وإلا عُرض الرابط المشترك بتفضيلات
//     المُستقبِل، وهو **نفس** العطل الذي تعالجه هذه الدفعة.
//  ٣) ما لا يُفهَم يُتجاهَل بصمت — الرابط مدخلٌ من الخارج، ومعاملته كأنه
//     دائمًا سليم مصدرُ أعطال.

const { execFileSync } = require('child_process');
const fs = require('fs');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const built = execFileSync('node_modules/.bin/esbuild',
  ['src/urlstate.js', '--bundle', '--format=iife', '--global-name=__u'], { encoding: 'utf8' });
const ctx = { console }; vm.createContext(ctx); vm.runInContext(built, ctx);
const U = ctx.__u;

let ok = 0, fail = 0;
const t = (n, c, x) => { if (c) { ok++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? ' → ' + x : '')); } };
const eq = (n, got, want) => t(n, got === want, `توقّعنا ${JSON.stringify(want)} وجاء ${JSON.stringify(got)}`);
const deep = (n, got, want) => t(n, JSON.stringify(got) === JSON.stringify(want),
  `توقّعنا ${JSON.stringify(want)} وجاء ${JSON.stringify(got)}`);

console.log('\n▸ القاعدة ١: الافتراضي لا يُكتب');
eq('عرض نظيف → نص فارغ', U.encodePortfolio({ filter: 'all', sort: 'alerts', alerts: new Set(), search: '' }), '');
eq('بلا وسائط إطلاقًا', U.encodePortfolio(), '');
eq('جدول نظيف', U.encodeTable({ phases: new Set(), statuses: new Set(), smart: new Set(), q: '' }), '');
eq('بحث بفراغات فقط لا يُكتب', U.encodePortfolio({ search: '   ' }), '');
eq('والرابط يبقى بلا علامة استفهام', U.joinHash('#/', ''), '#/');
eq('ومع استعلام تُضاف مرة واحدة', U.joinHash('#/', 'f=active'), '#/?f=active');

console.log('\n▸ الترميز');
eq('حالة المحفظة', U.encodePortfolio({ filter: 'active' }), 'f=active');
eq('الترتيب', U.encodePortfolio({ sort: 'name' }), 's=name');
eq('التنبيهات مرتَّبة كي يكون الرابط مستقرًّا',
  U.encodePortfolio({ alerts: new Set(['reqs', 'blocked']) }), 'al=blocked%2Creqs');
eq('نفس المجموعة بترتيب مختلف تعطي نفس الرابط',
  U.encodePortfolio({ alerts: new Set(['blocked', 'reqs']) }), U.encodePortfolio({ alerts: new Set(['reqs', 'blocked']) }));
eq('الكل معًا', U.encodePortfolio({ filter: 'draft', sort: 'name', alerts: ['blocked'], search: 'ألف' }),
  'f=draft&s=name&al=blocked&q=%D8%A3%D9%84%D9%81');
eq('جدول: المراحل والحالات والذكية',
  U.encodeTable({ phases: new Set(['A', '0']), statuses: new Set(['blocked']), smart: new Set(['late']), q: 'هوية' }),
  'ph=0%2CA&st=blocked&sm=late&q=%D9%87%D9%88%D9%8A%D8%A9');

console.log('\n▸ ذهابًا وإيابًا');
{
  const cases = [
    { filter: 'active' },
    { sort: 'progress' },
    { alerts: ['blocked', 'comments'] },
    { search: 'مجموعة الرياض' },
    { filter: 'draft', sort: 'name', alerts: ['reqs'], search: 'a&b=c' },
    { search: 'نصّ فيه ? و # و %' }
  ];
  cases.forEach((c, i) => {
    const back = U.decodePortfolio(U.encodePortfolio(c));
    deep(`المحفظة ${i + 1}`, back, c);
  });
  const tbl = { phases: ['0', 'A'], statuses: ['done'], smart: ['client'], q: 'بند ١٢' };
  deep('الجدول', U.decodeTable(U.encodeTable(tbl)), tbl);
}

console.log('\n▸ القاعدة ٣: ما لا يُفهَم يُتجاهَل بصمت');
[
  ['نص فارغ', ''],
  ['null', null],
  ['undefined', undefined],
  ['فواصل فقط', '&&&'],
  ['مفتاح بلا قيمة', 'f='],
  ['قيمة بلا مفتاح', '=active'],
  ['بلا علامة يساوي', 'active'],
  ['مفتاح غير معروف', 'zz=1'],
  ['ترميز تالف', 'q=%E0%A4%A'],
  ['بادئة ? زائدة', '?'],
].forEach(([n, v]) => {
  let threw = false, r = null;
  try { r = U.decodePortfolio(v); } catch (e) { threw = true; }
  t(`${n} لا يُسقط شيئًا`, !threw);
  t(`  ولا يُنتج مدخلًا وهميًّا`, !threw && Object.keys(r).length === 0, JSON.stringify(r));
});
eq('لكن المفهوم وسط غير المفهوم يمرّ', U.decodePortfolio('zz=1&f=active&=x&s=').filter, 'active');

console.log('\n▸ فصل المسار عن الاستعلام');
deep('بلا استعلام', U.splitHash('#/c/a/b/table'), { path: '#/c/a/b/table', query: '' });
deep('مع استعلام', U.splitHash('#/c/a/b/table?ph=A'), { path: '#/c/a/b/table', query: 'ph=A' });
deep('hash فارغ', U.splitHash(''), { path: '', query: '' });
deep('استعلام فارغ بعد ?', U.splitHash('#/?'), { path: '#/', query: '' });
// المسار قد يحمل معرّفًا فيه محارف مرمَّزة — لا يجوز أن يفسد الفصل
deep('بند مرمَّز في المسار', U.splitHash('#/c/a/b/table/t/%D8%A3'),
  { path: '#/c/a/b/table/t/%D8%A3', query: '' });

console.log('\n▸ قفل الكتابة — الحارس الذي انتقل مع الدالتين');
{
  // كل كتابة للرابط تُطلق hashchange، ومُعالِجه يُعيد التصيير. فبلا القفل تُنتج
  // كتابةٌ برمجية تصييرًا لم يطلبه أحد. وكان `_hashLock` رابطةً في app/main.js
  // تشترك فيها الكاتبتان ويقرؤها المُعالِج — فانتقل معهما، ويُقرأ الآن بدالة.
  const hist = [];
  const c = {
    console, setTimeout, clearTimeout,
    localStorage: { getItem: () => null, setItem() {} },
    location: { hash: '' },
    history: { replaceState: (a, b, h) => { hist.push(h); c.location.hash = h; } }
  };
  c.globalThis = c;
  vm.createContext(c); vm.runInContext(built, c);
  const M = c.__u;

  t('isHashLocked مُصدَّرة', typeof M.isHashLocked === 'function');
  t('ومرفوعة في السكون', M.isHashLocked() === false);

  // بالقيم الافتراضية لا يُكتب استعلام (القاعدة ١) فيكون الرابط `#/` مجرَّدًا،
  // وهو يخالف '' الابتدائي فتقع كتابة واحدة.
  M.writePortfolioHash();
  t('الكتابة تصل إلى history', hist.length === 1 && hist[0] === '#/', hist.join(' '));
  t('والقفل مُنزَل فورًا بعدها', M.isHashLocked() === true);

  // الكتابة نفسها مرّتين لا تكتب مرّتين — وإلا تراكمت مُدخَلات لا يراها المستخدم.
  M.writePortfolioHash();
  t('وكتابة نفس الرابط لا تتكرّر', hist.length === 1, hist.length + ' كتابة');
}

console.log('\n▸ الكاتبة الثالثة — كانت تكتب خارج القفل');
{
  // عطلٌ حقيقي لا تنظيم: `writeClientHash` عاشت في app/clienthome.js بنسخةٍ
  // يدوية من replaceState لا تمسّ القفل. فكل نقلةٍ إلى صفحة شريك كانت تُطلق
  // hashchange يراه المُعالِج تنقّلًا من المستخدم فيُعيد التصيير بلا سبب.
  const hist = [];
  const c = {
    console, setTimeout, clearTimeout,
    localStorage: { getItem: () => null, setItem() {} },
    location: { hash: '' },
    history: { replaceState: (a, b, h) => { hist.push(h); c.location.hash = h; } }
  };
  c.globalThis = c;
  // حزمةٌ ثانية تُصدّر `setState` معها: `writeClientHash` تقرأ CLIENTS من المتجر،
  // والمتجر ليس من صادرات urlstate.js — فيُوصَل هنا بمُدخَلٍ صريح لا بمنفذ خلفي.
  const withStore = execFileSync('node_modules/.bin/esbuild',
    ['--bundle', '--format=iife', '--global-name=__u', '--loader=js'],
    { encoding: 'utf8',
      input: "export * from './src/urlstate.js';\nexport { setState } from './src/app/state.js';\n" });
  vm.createContext(c); vm.runInContext(withStore, c);
  const M = c.__u;
  M.setState('CLIENTS', [{ id: 'c-1', slug: 'alfa' }, { id: 'c-2' }]);

  t('writeClientHash مُصدَّرة من طبقة الرابط', typeof M.writeClientHash === 'function');
  M.writeClientHash('c-1');
  eq('تُفضّل المعرّف النظيف', hist[hist.length - 1], '#/c/alfa');
  t('وتُنزِل القفل — وهذا هو الإصلاح', M.isHashLocked() === true);

  M.writeClientHash('c-2');
  eq('وتقع على المعرّف الخام حين لا سبيكة', hist[hist.length - 1], '#/c/c-2');

  M.writeClientHash('c-2');
  t('ولا تكتب نفس الرابط مرّتين', hist.length === 2, hist.join(' '));

  // شريك مجهول: لا يجوز أن ترمي — الرابط يُكتب بالمعرّف كما جاء.
  M.writeClientHash('لا-أحد');
  eq('ومعرّف مجهول يُكتب كما هو لا يرمي', hist[hist.length - 1], '#/c/لا-أحد');

  // وأن النسخة اليدوية لم تبقَ: قارئ واحد للرابط لا اثنان.
  const ch = fs.readFileSync('src/app/clienthome.js', 'utf8');
  t('ولا نسخة يدوية بقيت في clienthome.js',
    !/history\.replaceState/.test(ch) && /import \{ writeClientHash \} from '\.\.\/urlstate\.js'/.test(ch));
}

console.log('\n▸ الحالتان اللتان جعلتا النقل ممكنًا');
{
  const st = fs.readFileSync('src/app/state.js', 'utf8');
  const views = fs.readFileSync('src/views.js', 'utf8');
  // يُفحَص الكود لا التعليقات: ملاحظات النقل في main.js تذكر الاسمين القديمين
  // بنصّهما لتشرح إلى أين ذهبا — والفحص النصّي الساذج ينقلب على نفسه.
  const main = fs.readFileSync('src/app/main.js', 'utf8')
    .split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  t('TFILTER في المتجر لا رابطةً في views.js',
    /^ {2}TFILTER: \{/m.test(st) && !/^let TFILTER/m.test(views));
  t('FOCUS_REF في المتجر لا `_focusRef` في main.js',
    /^ {2}FOCUS_REF: null,/m.test(st) && !/_focusRef/.test(main));
  // ولا رابطة قفل باقية في main.js — يُقرأ بالدالة.
  t('main.js يقرأ القفل بالدالة لا بالرابطة',
    /isHashLocked\(\)/.test(main) && !/_hashLock/.test(main));
}

console.log('\n▸ الوصل في التطبيق');
{
  const main = fs.readFileSync('src/app/main.js', 'utf8');
  const views = fs.readFileSync('src/views.js', 'utf8');
  const pf = fs.readFileSync('src/app/portfolio.js', 'utf8');
  // انتقلت الدوال الأربع من app/main.js إلى هذه الوحدة في W2: كانت المرمِّزات هنا
  // ومُستعمِلوها هناك، أي طبقةٌ واحدة مقسومة بين ملفّين. القدرة هي هي، والتأكيد
  // يتبع الكود — بل صار أدقّ، إذ يفحص الطبقة في موضعها الواحد.
  const us = fs.readFileSync('src/urlstate.js', 'utf8');

  t('رابط المحفظة يحمل تصفيتها', /joinHash\('#\/',encodePortfolio/.test(us));
  t('ورابط المشروع يحمل تصفية الجدول', /getState\('VIEW'\)==='table'\?encodeTable\(getState\('TFILTER'\)\)/.test(us));
  t('وتصفية الجدول لا تُكتب في تبويب آخر', /getState\('VIEW'\)==='table'\?/.test(us));
  t('parseHash يفصل الاستعلام أولًا', /const \{path\}=splitHash/.test(us));
  // وما جعل النقل ممكنًا: لم يبقَ لهذه الدوال مُدخَلٌ خارج المتجر والمرمِّزات.
  t('ولا مُدخَل لها خارج المتجر والمرمِّزات',
    [...us.matchAll(/from '([^']+)'/g)].map(m => m[1]).join() === './app/state.js');

  // القاعدة ٢: الرابط يفوز، ويُطبَّق قبل أي تصيير.
  t('applyHashFilters موجودة', /^export function applyHashFilters\(\)/m.test(us));
  const iApply = main.indexOf('applyHashFilters();');
  const iRender = main.indexOf("SCREEN='project';CID=CLIENTS[0].id");
  t('وتُستدعى قبل أول تصيير', iApply > 0 && iApply < iRender);

  // كل مغيّر للتصفية يكتب الرابط — وإلا صار الرابط يكذب على المستخدم.
  const pfWrites = (pf.match(/writePortfolioHash\(\)/g) || []).length;
  t('كل مغيّرات تصفية المحفظة تكتب الرابط', pfWrites >= 6, pfWrites + ' موضعًا');
  const tfWrites = (views.match(/writeHash\(\); ?render\(\)|writeHash\(\);render\(\)/g) || []).length;
  t('ومغيّرات تصفية الجدول كذلك', tfWrites >= 5, tfWrites + ' موضعًا');
  t('ولا مغيّر تصفية جدول بلا كتابة رابط',
    !/TFILTER\.(phases|statuses|smart)\.(add|delete)\([^)]*\); render\(\)/.test(views));
}

console.log('\n▸ ذهابًا وإيابًا على الحزمة الحقيقية');
// الادّعاء الذي يهمّ فعلًا: رابط يُفتح فيُنتج نفس العرض، ثم يُعاد كتابته
// فيُنتج **نفس الرابط حرفًا بحرف**. أي انحراف هنا يعني رابطًا يكذب على من نسخه.
{
  const html = fs.readFileSync('index.html', 'utf8');
  const bundle = fs.readFileSync('app.bundle.js', 'utf8');
  const boot = hash => {
    const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://pmo.example/' + hash });
    const w = dom.window;
    w.eval(`window.supabase={createClient:()=>({rpc:()=>Promise.resolve({data:[],error:null}),
      from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null}),eq:()=>({maybeSingle:async()=>({data:null,error:null})})})}),
      auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
      channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>{}})}`);
    const sc = w.document.createElement('script'); sc.textContent = bundle;
    w.document.body.appendChild(sc);
    w.eval('applyHashFilters()');
    return w;
  };

  const PORT = '#/?f=active&s=name&al=blocked%2Creqs&q=%D8%A3%D9%84%D9%81';
  const w1 = boot(PORT);
  eq('المحفظة: الحالة طُبِّقت', w1.PFILTER, 'active');
  eq('والترتيب', w1.PSORT, 'name');
  deep('والتنبيهات', [...w1.PALERTS].sort(), ['blocked', 'reqs']);
  eq('والبحث بالعربية', w1.PSEARCH, 'ألف');
  eq('وإعادة الكتابة تُنتج نفس الرابط حرفًا بحرف',
    w1.eval("joinHash('#/',encodePortfolio({filter:PFILTER,sort:PSORT,alerts:PALERTS,search:PSEARCH}))"), PORT);

  const TBL = '#/c/acme/proj/table?ph=0%2CA&st=blocked&sm=late&q=%D9%87%D9%88%D9%8A%D8%A9';
  const w2 = boot(TBL);
  deep('الجدول: كل التصفية طُبِّقت',
    JSON.parse(w2.eval("JSON.stringify({ph:[...TFILTER.phases].sort(),st:[...TFILTER.statuses],sm:[...TFILTER.smart],q:TFILTER.q})")),
    { ph: ['0', 'A'], st: ['blocked'], sm: ['late'], q: 'هوية' });
  // المسار ما زال يُقرأ صحيحًا رغم وجود الاستعلام — هذا ما يمنعه splitHash.
  deep('والمسار ما زال يُقرأ صحيحًا', JSON.parse(w2.eval('JSON.stringify(parseHash())')),
    { clientRef: 'acme', projectRef: 'proj', view: 'table', ref: null });
  eq('وإعادة الترميز مطابقة', w2.eval('encodeTable(TFILTER)'), 'ph=0%2CA&st=blocked&sm=late&q=%D9%87%D9%88%D9%8A%D8%A9');

  // القاعدة ١ على أرض الواقع: لا ذيل على رابط بلا تصفية.
  const w3 = boot('#/');
  eq('عرض نظيف يعطي رابطًا نظيفًا',
    w3.eval("joinHash('#/',encodePortfolio({filter:PFILTER,sort:PSORT,alerts:PALERTS,search:PSEARCH}))"), '#/');

  // القاعدة ٣ على أرض الواقع: رابط مبتور لا يُسقط الإقلاع.
  let broke = false;
  try { boot('#/?f=&al=&q=%E0%A4%A&zz'); } catch (e) { broke = true; }
  t('رابط مبتور لا يُسقط الإقلاع', !broke);
}

console.log('\n▸ مسار الاحتياط — حيث كان القفل يهمّ فعلًا');
// كتلةٌ غير متزامنة وحدها في هذا الملف: التصيير ينتظر الجلب. والتقرير النهائي
// داخلها كي لا يُطبَع قبل أن تُحسَب تأكيداتها.
(async () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const bundle = fs.readFileSync('app.bundle.js', 'utf8');
  // `history.replaceState` **لا يُطلق** hashchange، فالمسار المعتاد كان سليمًا
  // بلا قفل. أما مسار الاحتياط — حين يرمي replaceState فيُكتب `location.hash`
  // مباشرةً — فيُطلقه، ومُعالِج hashchange في main.js يرى `#/c/<slug>` فيُعيد
  // فتح صفحة الشريك: تصييرٌ مزدوج وجلبُ بياناتٍ مكرَّر. القفل هو ما يمنعه،
  // وهذا التأكيد يقيس **النتيجة** (عدد النداءات) لا وجود القفل.
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://pmo.example/' });
  const w = dom.window;
  w.eval(`window.__rpc=[];window.supabase={createClient:()=>({
    rpc:(n)=>{window.__rpc.push(n);return Promise.resolve({data:[],error:null});},
    from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null}),eq:()=>({maybeSingle:async()=>({data:null,error:null})})})}),
    auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
    channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>{}})};
    history.replaceState=()=>{throw new Error('محجوب');};`);
  const sc = w.document.createElement('script'); sc.textContent = bundle;
  w.document.body.appendChild(sc);

  w.eval("ROLE='pmo';CLIENTS=[{id:'c-1',slug:'alfa',name:'ألفا'}];window.__rpc.length=0;");
  await w.eval("showScreen('clienthome','c-1')");
  await new Promise(r => setTimeout(r, 400));
  const calls = w.eval("window.__rpc.filter(n=>n==='pmo_portfolio').length");
  eq('نقلةٌ واحدة تُنتج جلبًا واحدًا لا اثنين', calls, 1);
  eq('والرابط كُتب بالمعرّف النظيف', w.location.hash, '#/c/alfa');

  console.log(`\nنجح ${ok} · فشل ${fail}`);
  process.exit(fail ? 1 : 0);
})();

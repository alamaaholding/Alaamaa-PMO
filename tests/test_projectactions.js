// ═══════════════════════════════════════════════════════════════════════
//  app/projectactions.js — مُتحكِّم شاشة المشروع (الموجة W2)
// ═══════════════════════════════════════════════════════════════════════
//
// AUDIT §أ-١: `app/main.js` ملفٌ يجمع ما لا يجتمع — مصادقة، وتوجيه، وفتح
// شاشات، **وأفعال جدول المشروع**. والأخيرة كانت تُشكّل عشرًا من ثلاث عشرة حافةً
// بين `views.js` و`main.js`، أي أن جدول المشروع كان يعتمد على ملف المصادقة.
//
// وهذه الدفعة **نقلٌ لا تحويل**: الملف يبقى في الدمج النصي بنفس النطاق المشترك.
// وهذا ما يجعل برهان التكافؤ ممكنًا بصرامة: مجموعة التصريحات في الحزمة المبنيّة
// يجب أن تبقى **هي هي حرفيًّا** — لا اسم يُضاف ولا اسم يسقط.

const fs = require('fs');
const { parse } = require('espree');
const { JSDOM } = require('jsdom');

let ok = 0, fail = 0;
const t = (n, c, x) => { if (c) { ok++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? ' → ' + x : '')); } };
const eq = (n, got, want) => t(n, got === want, `توقّعنا ${JSON.stringify(want)} وجاء ${JSON.stringify(got)}`);

const pa = fs.readFileSync('src/app/projectactions.js', 'utf8');
const main = fs.readFileSync('src/app/main.js', 'utf8');
const views = fs.readFileSync('src/views.js', 'utf8');
const buildPy = fs.readFileSync('build.py', 'utf8');
const bundle = fs.readFileSync('app.bundle.js', 'utf8');

const MOVED = ['setView', 'focusTask', 'gotoTask', 'openReqs', 'renderReqs', 'openDeps',
  'renderDeps', 'editStartDate', 'printProject', 'handleAddTask', 'handleDeleteTask',
  'vCR', 'bindCR', 'openAccess', 'renderAccessList'];
const STATE = ['CR_KIND', 'DEP_TASK', 'REQ_TASK'];

console.log('\n▸ العنقود انتقل كاملًا — ولم يبقَ منه شيء');
{
  const notMoved = MOVED.filter(n => !new RegExp(`^(async )?function ${n}\\(`, 'm').test(pa));
  t('الخمس عشرة دالة كلها هنا', notMoved.length === 0, notMoved.join(' '));
  const leftBehind = MOVED.filter(n => new RegExp(`^(async )?function ${n}\\(`, 'm').test(main));
  t('ولا واحدة بقيت في main.js', leftBehind.length === 0, leftBehind.join(' '));
  const noState = STATE.filter(n => !new RegExp(`^(let|const) ${n}\\b`, 'm').test(pa));
  t('وحالة الحوارات الثلاث معها', noState.length === 0, noState.join(' '));
  // CR_KIND كائن متعدّد الأسطر — النقل السطري ينقل أوّله وحده ويترك الباقي.
  t('و CR_KIND انتقل كاملًا لا سطره الأول', /^const CR_KIND=\{[\s\S]*?\n\};?$/m.test(pa) || pa.split('const CR_KIND=')[1].includes('};'));
}

console.log('\n▸ الحدّ — والاتجاه الذي يهمّ');
{
  const code = s => s.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  // ادّعيتُ أولًا أن الحدّ «مغلق في الاتجاهين»، فأسقط هذا التأكيد نفسه الادّعاء:
  // بقي في main.js ستة أسماء. وكشف الفحصُ أن الحدّ كان مرسومًا خطأً — أُخذت
  // أنصاف الحوارات الثلاثة (openAccess · openReqs · openDeps ونظيراتها) وتُركت
  // أنصافها الأخرى (ربط #accAdd و#reqAdd و#depSave). انتقلت الأنصاف الباقية.
  //
  // والمتبقّي بعدها ليس عيبًا بل **الاتجاه الصحيح**: main.js هو القشرة التي
  // تُنادي المُتحكِّم (focusTask من مُعالِج الرابط). والقيد الذي يحكم ترتيب
  // التحويل هو العكس وحده:
  const KEEP = ['focusTask'];   // main.js يناديها من applyHash — نداء قشرةٍ لمُتحكِّم
  const stillNeeded = [...MOVED, ...STATE]
    .filter(n => !KEEP.includes(n))
    .filter(n => new RegExp(`(?<![\\w.$])${n}(?![\\w$])`).test(code(main)));
  t('main.js لا يحتاج من العنقود إلا ما يُناديه قشرةً', stillNeeded.length === 0, stillNeeded.join(' '));
  // وهذا هو القيد الحقيقي: المُتحكِّم **لا يحتاج main.js إطلاقًا**، فيصحّ تحويله
  // مع views.js وحدهما دون انتظار ملف المصادقة.
  const mainOwn = [...code(main).matchAll(/^(?:async )?function ([\w$]+)\(/gm)].map(m => m[1])
    .concat([...code(main).matchAll(/^(?:let|const) ([\w$]+)/gm)].map(m => m[1]));
  const leaking = mainOwn.filter(n => new RegExp(`(?<![\\w.$])${n}(?![\\w$])`).test(code(pa)));
  t('والمُتحكِّم لا يحتاج من main.js شيئًا', leaking.length === 0, leaking.join(' '));
  // و views.js يحتاجها كلها تقريبًا — وهذا هو سبب النقل.
  const wanted = MOVED.filter(n => new RegExp(`(?<![\\w.$])${n}(?![\\w$])`).test(code(views)));
  t('و views.js هو المستفيد الأول', wanted.length >= 9, wanted.length + ' اسمًا');
  // والحوارات الثلاثة انتقلت **بنصفيها**: الفتح والتصيير والربط معًا.
  ['accAdd', 'reqAdd', 'depSave'].forEach(id =>
    t(`ربط #${id} مع نصفه الآخر`, pa.includes(`$('#${id}')`) && !main.includes(`$('#${id}')`)));
  t('ويُبنى قبل main.js في الدمج', /'src\/app\/projectactions\.js','src\/app\/main\.js'/.test(buildPy));
}

console.log('\n▸ برهان التكافؤ: النقل لا يغيّر حرفًا في سطح الحزمة');
{
  // القيد الأصرم في دفعة نقل: مجموعة التصريحات العليا في الحزمة المبنيّة لا
  // تتغيّر إطلاقًا. أي اسم يُضاف أو يسقط يعني أن النقل لم يكن نقلًا.
  const ast = parse(bundle, { ecmaVersion: 'latest' });
  const names = new Set();
  for (const s of ast.body) {
    if (s.type === 'FunctionDeclaration' && s.id) names.add(s.id.name);
    if (s.type === 'VariableDeclaration') for (const d of s.declarations) if (d.id.type === 'Identifier') names.add(d.id.name);
  }
  eq('١٢٧ تصريحًا عُلويًّا في الحزمة', names.size, 127);
  const missing = [...MOVED, ...STATE].filter(n => !names.has(n));
  t('وكل ما انتقل لا يزال معلَنًا', missing.length === 0, missing.join(' '));
}

console.log('\n▸ وتعمل كما كانت');
{
  const shell = fs.readFileSync('index.html', 'utf8')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/g, '').replace(/<link[^>]*>/g, '');
  const dom = new JSDOM(shell, { runScripts: 'dangerously' });
  const w = dom.window;
  w.eval(`window.supabase={createClient:()=>({rpc:()=>Promise.resolve({data:[],error:null}),
    from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null})})}),
    auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
    channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>{}})}`);
  const sc = w.document.createElement('script');
  sc.textContent = bundle;
  w.document.body.appendChild(sc);

  const unreachable = MOVED.filter(n => typeof w[n] !== 'function');
  t('الخمس عشرة كلها قابلة للنداء من النطاق المشترك', unreachable.length === 0, unreachable.join(' '));

  // وسلوكٌ حقيقي لا وجود فقط: setView تحرس الصلاحية قبل أي تبديل.
  w.eval("ROLE='client'; VIEW='dashboard';");
  w.eval("try{setView('audit');}catch(e){}");
  eq('setView لا تسمح بتبويب خارج صلاحية الدور', w.eval('VIEW'), 'dashboard');
  w.eval("ROLE='pmo';");
  w.eval("try{setView('table');}catch(e){}");
  eq('وتسمح بتبويب داخلها', w.eval('VIEW'), 'table');
}

console.log('\nنجح ' + ok + ' · فشل ' + fail);
process.exit(fail ? 1 : 0);

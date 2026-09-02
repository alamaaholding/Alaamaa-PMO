// ═══════════════════════════════════════════════════════════════════════
//  app/projectactions.js — مُتحكِّم شاشة المشروع (الموجة W2)
// ═══════════════════════════════════════════════════════════════════════
//
// AUDIT §أ-١: `app/main.js` ملفٌ يجمع ما لا يجتمع — مصادقة، وتوجيه، وفتح
// شاشات، **وأفعال جدول المشروع**. والأخيرة كانت تُشكّل عشرًا من ثلاث عشرة حافةً
// بين `views.js` و`main.js`، أي أن جدول المشروع كان يعتمد على ملف المصادقة.
//
// كُتب هذا الملف لدفعة **نقلٍ لا تحويل**، فكانت أصرم تأكيداته أن مجموعة
// التصريحات في الحزمة لا تتغيّر حرفيًّا. ثم تحوّل الملف إلى وحدة ESM، فانقلب
// المعنى: **الأسماء تغادر النطاق العام عمدًا** — وهذا هو المكسب لا الخسارة.
//
// فتُعاد صياغة التأكيدات على ما صار صحيحًا: العنقود كامل في موضعه، وسطحه
// المكشوف هو الصادرات والمعالِجات المُسجَّلة **وحدها**، وما عداه خاصٌّ بالوحدة.

const fs = require('fs');
const { JSDOM } = require('jsdom');

let ok = 0, fail = 0;
const t = (n, c, x) => { if (c) { ok++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? ' → ' + x : '')); } };
const eq = (n, got, want) => t(n, got === want, `توقّعنا ${JSON.stringify(want)} وجاء ${JSON.stringify(got)}`);

const pa = fs.readFileSync('src/app/projectactions.js', 'utf8');
const main = fs.readFileSync('src/app/main.js', 'utf8');
const views = fs.readFileSync('src/views.js', 'utf8');
const buildPy = fs.readFileSync('build.py', 'utf8');
const bundle = fs.readFileSync('app.bundle.js', 'utf8');

// كانت `vCR` و`bindCR` و`CR_KIND` هنا، ثم صُحّح الحدّ: `vCR` تُعيد HTML تبويب
// طلبات التعديل، و`views.js` فيه تسع نظائر لها بالاسم نفسه (vTable · vGantt …).
// فهي عاشرتهنّ لا مُعالِج. والاصطلاح القائم هو ما حسم، لا تقديري.
const MOVED = ['setView', 'focusTask', 'gotoTask', 'openReqs', 'renderReqs', 'openDeps',
  'renderDeps', 'editStartDate', 'printProject', 'handleAddTask', 'handleDeleteTask',
  'openAccess', 'renderAccessList'];
const STATE = ['DEP_TASK', 'REQ_TASK'];

console.log('\n▸ العنقود انتقل كاملًا — ولم يبقَ منه شيء');
{
  const notMoved = MOVED.filter(n => !new RegExp(`^(export )?(async )?function ${n}\\(`, 'm').test(pa));
  t('الثلاث عشرة دالة كلها هنا', notMoved.length === 0, notMoved.join(' '));
  const leftBehind = MOVED.filter(n => new RegExp(`^(async )?function ${n}\\(`, 'm').test(main));
  t('ولا واحدة بقيت في main.js', leftBehind.length === 0, leftBehind.join(' '));
  const noState = STATE.filter(n => !new RegExp(`^(let|const) ${n}\\b`, 'm').test(pa));
  t('وحالة الحوارَين معها', noState.length === 0, noState.join(' '));
  // وتبويب طلبات التعديل انتقل بكامله إلى views.js: الدالتان وثوابتهما الثلاثة.
  const v = fs.readFileSync('src/views.js', 'utf8');
  t('تبويب طلبات التعديل كلّه في views.js',
    /^function vCR\(/m.test(v) && /^function bindCR\(/m.test(v)
    && /^const CR_KIND=/m.test(v) && /^const crAutoNote=/m.test(v) && /^const crManualNote=/m.test(v));
  t('ولا بقيّة منه في المُتحكِّم',
    !/vCR|bindCR|CR_KIND|crAutoNote/.test(pa.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n')));
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
  // كان هنا: «views.js هو المستفيد الأول» — يذكر تسعةً منها على الأقل. وقد
  // انقلب القيد بسجلّ المعالِجات: صار views ينادي بالمفاتيح لا بالأسماء، فلا
  // يذكر **واحدًا** منها. وهذا هو ما كسر الدورة، فيُثبَّت بصيغته الجديدة.
  //
  // وتُسقَط السلاسل النصّية قبل الفحص: `runAction('openDeps')` ليست ذكرًا للاسم،
  // وعدُّها كذلك يجعل الحارس يرى الدورة قائمةً بعد كسرها بالضبط.
  const vcode = code(views).replace(/'(?:[^'\\]|\\.)*'/g, "''");
  const named = MOVED.filter(n => new RegExp(`(?<![\\w.$])${n}(?![\\w$])`).test(vcode));
  t('و views.js لا يذكر اسم أيٍّ منها — ينادي بالمفاتيح', named.length === 0, named.join(' '));
  t('بل يناديها عبر السجلّ', (views.match(/runAction\('/g) || []).length >= 15);

  t('خرج من الدمج النصي', !/CORE=\[[\s\S]*?'src\/app\/projectactions\.js'/.test(buildPy));
  t('ودخل الجسر', /import \* as projectActions from '\.\/app\/projectactions\.js';/.test(
    fs.readFileSync('src/bundle-entry.js', 'utf8')));
}

console.log('\n▸ السطح المكشوف — الصادرات والمعالِجات وحدها');
{
  // هذا ما حلّ محلّ «١٢٧ تصريحًا»: بعد التحويل لم يعد السؤال «هل بقيت الأسماء
  // في النطاق العام» بل عكسه — **أيّها غادره**. والمكشوف يجب أن يقتصر على ما
  // يحتاجه غيره فعلًا: أربع صادرات وتسعة معالِجات مُسجَّلة.
  const exported = [...pa.matchAll(/^export (?:async )?function ([\w$]+)\(/gm)].map(m => m[1]);
  const actions = [...pa.matchAll(/registerAction\('([^']+)'/g)].map(m => m[1]);
  eq('أربع صادرات', exported.length, 4);
  eq('وتسعة معالِجات مُسجَّلة', actions.length, 9);
  // والباقي خاصٌّ بالوحدة — وهذا هو المكسب: ما لا يحتاجه أحد لا يراه أحد.
  const priv = MOVED.filter(n => !exported.includes(n));
  t('وما عداها خاصٌّ بالوحدة', priv.length === MOVED.length - 4, priv.join(' '));
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

  const exported = ['focusTask', 'gotoTask', 'openAccess', 'openReqs'];
  const unreachable = exported.filter(n => typeof w[n] !== 'function');
  t('الصادرات الأربع تصل عبر الجسر', unreachable.length === 0, unreachable.join(' '));
  // وما لم يُصدَّر **لا يصل** — وهذا مقصود لا نقص.
  const leaked = MOVED.filter(n => !exported.includes(n) && typeof w[n] === 'function');
  t('وما لم يُصدَّر لا يتسرّب إلى النطاق العام', leaked.length === 0, leaked.join(' '));

  // وسلوكٌ حقيقي لا وجود فقط: setView تحرس الصلاحية قبل أي تبديل.
  w.eval("ROLE='client'; VIEW='dashboard';");
  w.eval("try{runAction('setView','audit');}catch(e){}");
  // ولم تعد تُنادى بالاسم: صارت مُعالِجًا مُسجَّلًا يناديه العرض بمفتاحه.
  eq('setView لا تسمح بتبويب خارج صلاحية الدور', w.eval('VIEW'), 'dashboard');
  w.eval("ROLE='pmo';");
  w.eval("try{runAction('setView','table');}catch(e){}");
  eq('وتسمح بتبويب داخلها', w.eval('VIEW'), 'table');
}

console.log('\nنجح ' + ok + ' · فشل ' + fail);
process.exit(fail ? 1 : 0);

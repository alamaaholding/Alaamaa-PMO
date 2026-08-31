// ═══════════════════════════════════════════════════════════════════════
//  src/actions.js — سجلّ المعالِجات: كسر آخر دورة كبيرة في W2
// ═══════════════════════════════════════════════════════════════════════
//
// بقيت بعد سجلّ الشاشات دورةٌ من ثلاثة ملفات (١٠٦ KB) تجب أن تُحوَّل معًا:
//
//     views ──▶ projectactions ──▶ views   (والأخيرة عبر `render`)
//     views ──▶ taskpanel      ──▶ views
//
// ومصدرها اتجاهٌ واحد: **views.js ينادي مُعالِجات غيره**. أمّا `render` من views
// فاعتماد طبقةٍ على طبقة العرض — مشروع ولا يُكسَر. فحين يكفّ views عن نداء غيره
// بالاسم صار ورقةً: يعتمد عليه الجميع ولا يعتمد على أحد.
//
// وهذا الملف يحرس ثلاثة قيود، أوّلها هو الغاية كلها.

const fs = require('fs');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { JSDOM } = require('jsdom');

let ok = 0, fail = 0;
const t = (n, c, x) => { if (c) { ok++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? ' → ' + x : '')); } };
const eq = (n, got, want) => t(n, got === want, `توقّعنا ${JSON.stringify(want)} وجاء ${JSON.stringify(got)}`);
const throws = (n, fn, re) => { let m = null; try { fn(); } catch (e) { m = e.message; } t(n, m !== null && (!re || re.test(m)), m === null ? 'لم يُرمَ شيء' : m); };

const bundle = fs.readFileSync('app.bundle.js', 'utf8');
const views = fs.readFileSync('src/views.js', 'utf8');

// المفتاح → (الدالة، ملفها)
const ACTIONS = {
  setView: ['setView', 'src/app/projectactions.js'],
  gotoTask: ['gotoTask', 'src/app/projectactions.js'],
  editStartDate: ['editStartDate', 'src/app/projectactions.js'],
  openDeps: ['openDeps', 'src/app/projectactions.js'],
  openReqs: ['openReqs', 'src/app/projectactions.js'],
  addTask: ['handleAddTask', 'src/app/projectactions.js'],
  deleteTask: ['handleDeleteTask', 'src/app/projectactions.js'],
  printProject: ['printProject', 'src/app/projectactions.js'],
  openAccess: ['openAccess', 'src/app/projectactions.js'],
  openTaskPanel: ['openTaskPanel', 'src/taskpanel.js'],
  openTracksManager: ['openTracksManager', 'src/app/lifecycle.js']
};

// المعرّفات الحقيقية وحدها: تُسقَط التعليقات **والسلاسل النصّية**.
//
// وهذا ليس تفصيلًا: قياسي الأول عدّ `runAction('setView')` حافةً إلى مالك
// `setView` — أي أنه رأى الدورة قائمةً بعد كسرها بالضبط، وأعطاني رقمًا أبلغتُه
// وهو خطأ. فالمقياس نفسه يحتاج حراسةً كالكود.
const codeOf = s => s.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
  .replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""');

console.log('\n▸ الغاية: views.js صار ورقةً');
{
  const code = codeOf(views);
  const leaks = [];
  for (const [fn, file] of Object.values(ACTIONS)) {
    if (file === 'src/views.js') continue;
    if (new RegExp(`(?<![\\w.$])${fn}(?![\\w$])`).test(code)) leaks.push(`${fn} (${file})`);
  }
  t('لا يذكر views.js اسم مُعالِجٍ يملكه غيره', leaks.length === 0, leaks.join(' '));
  // وينادي بالمفتاح فعلًا — وإلا كان «لا تسريب» صحيحًا لأن النداء حُذف لا لأنه تحوّل.
  const calls = (views.match(/runAction\('/g) || []).length;
  t('بل يناديها بالمفاتيح', calls >= 15, calls + ' نداءً');
  t('و hasAction تحلّ محلّ حراسة typeof الموروثة', /hasAction\('openTracksManager'\)/.test(views));
}

console.log('\n▸ دلالات السجلّ — والأخطاء تُرمى ولا تُبتلع');
{
  const built = execFileSync('node_modules/.bin/esbuild',
    ['src/actions.js', '--bundle', '--format=iife', '--global-name=__a'], { encoding: 'utf8' });
  const ctx = { console }; ctx.globalThis = ctx;
  vm.createContext(ctx); vm.runInContext(built, ctx);
  const A = ctx.__a;

  t('يبدأ فارغًا', A.registeredActions().length === 0);
  A.registerAction('a', (x, y) => 'a:' + x + ':' + y);
  t('hasAction يرى المُسجَّل', A.hasAction('a') && !A.hasAction('b'));
  eq('runAction يمرّر الوسائط ويُعيد القيمة', A.runAction('a', 1, 2), 'a:1:2');
  eq('registerAction يُعيد الدالة كما هي', typeof A.registerAction('r', () => 1), 'function');
  throws('مفتاح غير مُسجَّل يرمي', () => A.runAction('لا-شيء'), /غير مُسجَّل/);
  throws('تسجيل مكرَّر يرمي', () => A.registerAction('a', () => 2), /مرتين/);
  throws('تسجيل بغير دالة يرمي', () => A.registerAction('z', 'ليست دالة'), /بغير دالة/);
  throws('مفتاح فارغ يرمي', () => A.registerAction('', () => 1), /غير صالح/);
}

console.log('\n▸ الأحد عشر مُسجَّلة في الحزمة المبنيّة');
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

  const reg = w.registeredActions();
  t('الحزمة حُمّلت بلا تسجيل مكرَّر', Array.isArray(reg));
  Object.keys(ACTIONS).forEach(k => t(`«${k}» مُسجَّل`, reg.includes(k)));
  eq('ولا مفتاح زائد', reg.length, Object.keys(ACTIONS).length);
  // كل مفتاح يُنادى في views يجب أن يكون مُسجَّلًا — وإلا زرٌّ يرمي عند أول نقرة.
  const used = [...new Set([...views.matchAll(/runAction\('([^']+)'/g)].map(m => m[1]))];
  const missing = used.filter(k => !reg.includes(k));
  t('وكل مفتاح يناديه العرض مُسجَّل', missing.length === 0, missing.join(' '));
}

console.log('\n▸ برهان التكافؤ: الإحالة المجرَّدة كانت تمرّر كائن الحدث');
{
  // `onclick=handleAddTask` تُنادى بـ(MouseEvent)؛ و`()=>runAction('addTask')`
  // بلا شيء. التكافؤ مشروط بأن تلك الدوال لا تقرأ وسيطًا — فيُفحَص الشرط.
  const bare = [['editStartDate', 'src/app/projectactions.js'],
                ['handleAddTask', 'src/app/projectactions.js'],
                ['openTracksManager', 'src/app/lifecycle.js']];
  for (const [fn, file] of bare) {
    const sig = (fs.readFileSync(file, 'utf8').match(new RegExp('(?:async )?function ' + fn + '\\(([^)]*)\\)')) || [])[1];
    t(`${fn} لا تُصرّح بوسائط`, sig === '', `التوقيع (${sig})`);
  }
}

console.log('\n▸ vCR عادت إلى أخواتها');
{
  // وُضعت في projectactions في دفعة النقل، والاصطلاح القائم يقول غير ذلك:
  // views.js فيه تسعة نظائر لها بالاسم نفسه.
  const vsibs = (views.match(/^function v[A-Z]\w*\(/gm) || []).length;
  t('عشر دوال v* في views.js', vsibs === 10, vsibs + ' دالة');
  t('و vCR منها', /^function vCR\(/m.test(views));
  t('ولم تبقَ في projectactions',
    !/function vCR\(/.test(fs.readFileSync('src/app/projectactions.js', 'utf8')));
}

console.log('\nنجح ' + ok + ' · فشل ' + fail);
process.exit(fail ? 1 : 0);

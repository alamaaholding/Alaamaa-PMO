// ===== src/skeleton.js + .skeleton — حالة تحميل تُرى فعلًا (الموجة W5) =====
//
// ROADMAP §W5-٣: «هيكل عظمي واحد لكل نوع منطقة في كل المسارات لا في أربعة».
// والقياس عند التنفيذ أظهر ما هو أسوأ من التشتّت:
//
//     خمسون موضعًا تبني هياكل بأربعة عشر ارتفاعًا مختلفًا،
//     **والصنف `.skeleton` نفسه لم يكن مُعرَّفًا في styles.css إطلاقًا.**
//
// أي أن كل حالة تحميل في المنصّة كانت عنصرًا فارغًا بلا خلفية ولا حركة: يشغل
// ارتفاعه من الصفحة ولا يُرى. فما بدا «حالة تحميل مطبَّقة في كل مكان» كان
// فراغًا أبيض في كل مكان — والمستخدم ينتظر أمام شاشة لا تقول شيئًا.
//
// ولم يكن ليظهر في أي اختبار بنيوي: الـDOM صحيح، والصنف موجود، والارتفاع
// مضبوط. فالتأكيد الأول أدناه يفحص **وجود القاعدة في CSS** لا وجود العنصر —
// وهو الفرق بين «مبنيّ» و«مرئيّ».

const { execFileSync } = require('child_process');
const fs = require('fs');
const vm = require('vm');
const { JSDOM } = require('jsdom');

let ok = 0, fail = 0;
const t = (n, c, x) => { if (c) { ok++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? ' → ' + x : '')); } };
const eq = (n, got, want) => t(n, got === want, `توقّعنا ${JSON.stringify(want)} وجاء ${JSON.stringify(got)}`);

const css = fs.readFileSync('src/styles.css', 'utf8');

console.log('\n▸ العطل الأصلي: الصنف صار مُعرَّفًا');
t('.skeleton له قاعدة في styles.css', /^\.skeleton\{/m.test(css));
t('وله خلفية مرئية', /^\.skeleton\{[^}]*background:/m.test(css));
t('وحركة وميض', /skshimmer/.test(css) && /@keyframes skshimmer/.test(css));
t('واللون من الرموز لا صريحًا', /^\.skeleton\{[^}]*var\(--soft\)/m.test(css));
// إمكانية الوصول: من يطلب تقليل الحركة لا يُفرَض عليه وميض متكرّر.
t('يحترم prefers-reduced-motion', /prefers-reduced-motion[^}]*\}[\s\S]{0,120}skeleton::after\{[^}]*animation:none/.test(css)
  || /@media\(prefers-reduced-motion:reduce\)\{\.skeleton::after\{animation:none/.test(css));

console.log('\n▸ المقاييس السبعة صارت أصنافًا');
['sk-bar', 'sk-line', 'sk-field', 'sk-row', 'sk-card', 'sk-block', 'sk-chart']
  .forEach(c => t(`.${c} مُعرَّف`, new RegExp('^\\.' + c + '\\{height:\\d+px\\}', 'm').test(css)));

console.log('\n▸ الوحدة');
const built = execFileSync('node_modules/.bin/esbuild',
  ['src/skeleton.js', '--bundle', '--format=iife', '--global-name=__s'], { encoding: 'utf8' });
const ctx = { console }; vm.createContext(ctx); vm.runInContext(built, ctx);
const S = ctx.__s;

t('تُصدَّر skeleton', typeof S.skeleton === 'function');
t('وقائمة الأنواع مجمَّدة', Object.isFrozen(S.SKELETON_KINDS));
const count = h => (h.match(/class="skeleton/g) || []).length;
S.SKELETON_KINDS.forEach(k => {
  const h = S.skeleton(k);
  t(`${k} يُنتج هيكلًا`, count(h) > 0);
  t(`  وكل عنصر فيه يحمل صنف skeleton`, count(h) === (h.match(/<div class="/g) || []).length - (h.match(/class="sk-stack"/g) || []).length);
});
eq('العدد المطلوب يُحترَم', count(S.skeleton('list', 7)), 7);
eq('وله افتراضي معقول', count(S.skeleton('list')), 4);
// نوع مجهول يرجع إلى list بدل أن يُنتج فراغًا — وهو العطل نفسه الذي عولج.
t('نوع مجهول لا يُنتج فراغًا', count(S.skeleton('nope')) > 0);
t('ولا ينهار على undefined', count(S.skeleton()) > 0);

// كل صنف مقاس يستعمله المولّد يجب أن يكون مُعرَّفًا في CSS — وإلا عاد العطل
// نفسه من باب آخر: عنصر بصنف بلا قاعدة.
console.log('\n▸ لا صنف يستعمله المولّد بلا قاعدة في CSS');
{
  const used = new Set();
  S.SKELETON_KINDS.forEach(k => {
    for (const m of S.skeleton(k, 3).matchAll(/class="([^"]+)"/g))
      m[1].split(/\s+/).forEach(c => c && c !== 'skeleton' && used.add(c));
  });
  const missing = [...used].filter(c => !new RegExp('^\\.' + c + '[{,]', 'm').test(css));
  t(`الأصناف المستعملة (${used.size}) كلها مُعرَّفة`, missing.length === 0, missing.join(' '));
}

console.log('\n▸ التوحيد: لا هيكل مبنيّ يدويًا بعد اليوم');
{
  const srcs = [...fs.readdirSync('src').filter(f => f.endsWith('.js') && f !== 'qrgen.js').map(f => 'src/' + f),
                ...fs.readdirSync('src/app').filter(f => f.endsWith('.js')).map(f => 'src/app/' + f)]
    .filter(f => !f.endsWith('skeleton.js'));
  let handmade = 0, calls = 0;
  for (const f of srcs) {
    const s = fs.readFileSync(f, 'utf8');
    handmade += (s.match(/class="skeleton" style="/g) || []).length;
    calls += (s.match(/skeleton\('[a-z]+'/g) || []).length;
  }
  eq('صفر هيكل بنمط سطري يدوي', handmade, 0);
  t('والنداءات حلّت محلّها', calls >= 20, calls + ' نداءً');
}

console.log('\n▸ على الحزمة الحقيقية');
{
  const dom = new JSDOM('<body><div id="h"></div></body>', { runScripts: 'dangerously' });
  const w = dom.window;
  w.eval(`window.supabase={createClient:()=>({rpc:()=>Promise.resolve({data:[],error:null}),
    from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null})})}),
    auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
    channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>{}})}`);
  const sc = w.document.createElement('script'); sc.textContent = fs.readFileSync('app.bundle.js', 'utf8');
  w.document.body.appendChild(sc);
  t('skeleton وصلت عبر الجسر', typeof w.skeleton === 'function');
  const host = w.document.getElementById('h');
  host.innerHTML = w.skeleton('table', 5);
  t('تُصيَّر عناصر فعلية', host.querySelectorAll('.skeleton').length === 6);
  t('وكلها بأصناف مقاس', [...host.querySelectorAll('.skeleton')].every(e => e.className.trim() !== 'skeleton'));
  t('ولا نمط سطري واحد', [...host.querySelectorAll('.skeleton')].every(e => !e.getAttribute('style')));
}

console.log(`\nنجح ${ok} · فشل ${fail}`);
process.exit(fail ? 1 : 0);

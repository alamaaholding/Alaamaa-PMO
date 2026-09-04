// ===== src/app/session.js — المصادقة وبوابة الدخول =====
//
// هذه الكتلة كانت في api.js، ولم تكن يومًا من عمله: تقرأ الـhash، وتُظهر وتُخفي
// #loader و#login و#app و#denied، وتربط أزرار الدخول والخروج، وتقرّر متى يبدأ
// التطبيق. لا شيء من ذلك وصولٌ إلى بيانات.
//
// وهي بوابة الوصول الوحيدة إلى المنصّة، وكانت بلا اختبار واحد. أخطر ما فيها
// **مسار التوقيع العام**: يتجاوز تسجيل الدخول عمدًا وكليًا، وحارسه الوحيد هو
// الرمز العشوائي في الرابط. تجاوزٌ متعمَّد كهذا يجب أن يكون محروسًا بتأكيد
// يمنع اتّساعه صدفةً — نمط `#/sign/<رمز>` لا يقبل شرطة مائلة ولا نقطتين ولا
// محرفًا خارج [a-zA-Z0-9]، ولو اتّسع لصار بابًا خلفيًا.

const fs = require('fs');
const { JSDOM } = require('jsdom');

let ok = 0, fail = 0;
const t = (n, c, x) => { if (c) { ok++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? ' → ' + x : '')); } };

const src = fs.readFileSync('src/app/session.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const bundle = fs.readFileSync('app.bundle.js', 'utf8');

console.log('\n▸ الفصل: api.js لم تعد تحمل بوابة الدخول');
{
  const api = fs.readFileSync('src/api.js', 'utf8');
  ['async function boot(', 'function showLogin(', 'function showDenied(', 'async function loadIdentity(']
    .forEach(f => t(`${f.replace(/^(async )?function /, '').replace('(', '')} خرجت من api.js`, !api.includes(f)));
  t('وانتقلت إلى session.js', ['boot(', 'showLogin(', 'showDenied(', 'loadIdentity('].every(f => src.includes(f)));
  t('api.js لم تعد تذكر startApp', !/\bstartApp\b/.test(api));
  t('ولا renderPublicSign', !/\brenderPublicSign\b/.test(api));
  t('ولا renderPortfolio', !/\brenderPortfolio\b/.test(api));
  // الوحدات الكسولة تُستدعى بـwindow. عمدًا — ربط متأخّر لا اعتماد.
  t('نداء الوحدات الكسولة يبقى متأخّرًا عبر window.',
    ['dolOpen', 'importerOpen', 'pganttOpen', 'timelineRender', 'timelinePortfolio', 'trelloMenu']
      .every(n => new RegExp(`window\\.${n}\\b`).test(api)));
}

console.log('\n▸ نمط رابط التوقيع العام — التجاوز المتعمَّد لا يتّسع');
{
  const m = src.match(/\/\^#\\\/sign\\\/\(\[([^\]]+)\]\+\)\$\//);
  t('النمط مثبَّت ومقروء', !!m, 'تعذّر إيجاد تعبير المطابقة');
  const re = /^#\/sign\/([a-zA-Z0-9]+)$/;
  t('النمط في المصدر هو نفسه المفحوص هنا', src.includes(String(re).slice(1, -1)));
  [['#/sign/abc123', true], ['#/sign/A1', true],
   ['#/sign/', false], ['#/sign', false], ['#/signx/abc', false],
   ['#/sign/a/b', false], ['#/sign/../admin', false], ['#/sign/a-b', false],
   ['#/sign/a b', false], ['#/sign/a.b', false], ['#/sign/a%2F', false],
   ['#/SIGN/abc', false], ['x#/sign/abc', false], ['', false]
  ].forEach(([h, want]) => t(`${JSON.stringify(h)} ${want ? 'يطابق' : 'لا يطابق'}`, re.test(h) === want));
}

/**
 * يبني نافذة كاملة بالحزمة الحقيقية، مع تحكّم في الجلسة والهوية والـhash.
 *
 * ملاحظة لزمة: الحزمة **تُقلع نفسها** — آخر سطر في src/bundle-entry.js هو
 * `boot();` (كان في app/main.js قبل تحوّلها إلى وحدة). فالإقلاع التلقائي يحدث
 * أولًا، ثم تُصفَّر السجلّات، ثم يُستدعى boot صراحةً. بلا هذا يُحتسب كل شيء
 * مرّتين — وهو ما وقع فعلًا في أول تشغيل لهذا الملف.
 *
 * وملاحظة ثانية أهمّ: كان هذا الملف يُثبّت بدائل على النطاق العام
 * (`startApp=…` و`renderPublicSign=…`). وقد أُغلق ذلك المَنفَذ بتحوّل الملفّين
 * إلى وحدات: `boot` تنادي البِنْية المستورَدة لا اسمًا عامًّا. فانتقل الرصد إلى
 * الطبقة الباقية — `sb` نفسها — والدوال الحقيقية تُنفَّذ الآن بدل أن تُتخطّى،
 * فصار ما يُقاس **الأثر** لا النداء.
 */
async function boot(opts) {
  const { session = null, teamRow = null, clientIds = null, hash = '' } = opts;
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://pmo.example/' + hash });
  const w = dom.window;
  const calls = { publicSign: [], signOut: 0, oauth: [] };
  w.__calls = calls;
  w.eval(`window.supabase={createClient:()=>({
    rpc:(n,a)=>{ if(n==='pmo_contract_public_view'&&a&&a.p_token)window.__calls.publicSign.push(a.p_token);
      return Promise.resolve({data: n==='pmo_my_client_ids' ? ${JSON.stringify(clientIds)} : false, error:null}); },
    from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:${JSON.stringify(teamRow)},error:null})}),
      order:()=>Promise.resolve({data:[],error:null})})}),
    auth:{getSession:async()=>({data:{session:${JSON.stringify(session)}}}),
      getUser:async()=>({data:{user:${session ? '{id:"u1",email:"a@b.c"}' : 'null'}}}),
      signInWithOAuth:async(o)=>{window.__calls.oauth.push(o);return{error:null};},
      signOut:async()=>{window.__calls.signOut++;},
      onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
    channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>{}})}`);
  const s = w.document.createElement('script');
  s.textContent = bundle;
  w.document.body.appendChild(s);
  // انتظار الإقلاع التلقائي حتى يستقرّ، ثم تصفير ما رصده وإعادة الشاشات لحالتها.
  for (let i = 0; i < 8; i++) await new Promise(r => setTimeout(r, 0));
  // «بدأ التطبيق» يُقاس بأثره لا بعدّاد على بديل: startApp تكشف #app وتُخفي
  // #login، وهو أوّل ما تفعله بعد loadClients — فوجود #app ظاهرةً هو الدعوى.
  const started = d => !d.getElementById('app').classList.contains('hidden');
  const autoStart = started(w.document) ? 1 : 0, autoSign = calls.publicSign.length;
  calls.publicSign.length = 0;
  ['app', 'login', 'denied', 'publicSign'].forEach(id => w.document.getElementById(id).classList.add('hidden'));
  w.document.getElementById('loader').classList.remove('hidden');
  return { w, doc: w.document, calls,
    started: () => started(w.document), autoStart, autoSign, run: () => w.boot() };
}
const vis = (doc, id) => !doc.getElementById(id).classList.contains('hidden');

(async () => {
  console.log('\n▸ الحزمة تُقلع نفسها عند التحميل');
  // آخر سطر في app/main.js هو boot(). سلوك مقصود، لكنه غير مرئي في أي مكان آخر
  // — ويُضاعف كل رصد في أي اختبار لا يحسب حسابه.
  {
    const { autoStart } = await boot({ session: { user: { id: 'u1' } },
      teamRow: { role: 'admin', is_active: true, full_name: 'أ' } });
    t('الإقلاع التلقائي يحدث مرة واحدة بلا نداء صريح', autoStart === 1);
    // موضع النداء انتقل مع اكتمال W2: نقطة الدخول تُهيّئ كل وحدة ثم تنطلق،
    // بدل أن يعتمد الانطلاق على كون main.js آخر ملف في دمجٍ نصّي.
    t('و bundle-entry.js تناديه في مستواها الأعلى — بالوحدة لا بالنطاق',
      /^session\.boot\(\);$/m.test(fs.readFileSync('src/bundle-entry.js', 'utf8')));
    t('و main.js لم تعد تناديه', !/^boot\(\);$/m.test(fs.readFileSync('src/app/main.js', 'utf8')));
  }

  console.log('\n▸ بلا جلسة → شاشة الدخول');
  {
    const { doc, started, run } = await boot({ session: null });
    await run();
    t('#login ظاهرة', vis(doc, 'login'));
    t('#app مخفية', !vis(doc, 'app'));
    t('#loader مخفي', !vis(doc, 'loader'));
    t('#denied مخفية', !vis(doc, 'denied'));
    t('التطبيق لم يبدأ', !started());
  }

  console.log('\n▸ جلسة + عضو فريق مُفعَّل → يبدأ التطبيق');
  {
    const { started, run, w } = await boot({ session: { user: { id: 'u1' } },
      teamRow: { role: 'admin', is_active: true, full_name: 'أ' } });
    await run();
    t('التطبيق بدأ فعلًا — #app كُشفت', started());
    t('الدور pmo لمدير النظام', w.ROLE === 'pmo');
    t('واسم المستخدم مُحمَّل', w.USER && w.USER._name === 'أ');
  }
  {
    const { w, run } = await boot({ session: { user: { id: 'u1' } },
      teamRow: { role: 'manager', is_active: true, full_name: 'ب' } });
    await run();
    t('manager يصير delivery', w.ROLE === 'delivery');
  }

  console.log('\n▸ جلسة بلا تصريح → شاشة الرفض لا شاشة التطبيق');
  {
    const { doc, started, run } = await boot({ session: { user: { id: 'u1' } },
      teamRow: { role: 'admin', is_active: false }, clientIds: [] });
    await run();
    t('#denied ظاهرة', vis(doc, 'denied'));
    t('#login ظاهرة معها', vis(doc, 'login'));
    t('#app تبقى مخفية', !vis(doc, 'app'));
    t('التطبيق لم يبدأ', !started());
  }
  {
    // شريك مصرَّح له بالإيميل: ليس عضو فريق، لكن له مشاريع.
    const { started, run, w } = await boot({ session: { user: { id: 'u1' } },
      teamRow: null, clientIds: ['c1'] });
    await run();
    t('الشريك المصرَّح له يدخل', started());
    t('بدور client', w.ROLE === 'client');
  }

  console.log('\n▸ مسار التوقيع العام يتجاوز الدخول كليًا');
  {
    const { calls, doc, started, run } = await boot({ session: null, hash: '#/sign/tok123' });
    await run();
    t('مسار التوقيع طلب العقد بالرمز نفسه', calls.publicSign[0] === 'tok123', calls.publicSign.join(','));
    t('و#publicSign كُشفت', vis(doc, 'publicSign'));
    t('بلا جلسة وبلا شاشة دخول', !vis(doc, 'login'));
    t('والتطبيق لم يبدأ', !started());
    t('و#loader أُخفي', !vis(doc, 'loader'));
  }
  {
    // رابط توقيع مشوَّه: يسقط إلى المسار العادي، لا يمرّ.
    const { calls, doc, run } = await boot({ session: null, hash: '#/sign/a/b' });
    await run();
    t('رمز مشوَّه لا يفتح مسار التوقيع', calls.publicSign.length === 0);
    t('ويسقط إلى شاشة الدخول', vis(doc, 'login'));
  }

  console.log('\n▸ أزرار البوابة مربوطة');
  {
    const { doc, calls } = await boot({ session: null });
    doc.getElementById('googleBtn').onclick({ preventDefault(){} });
    await new Promise(r => setTimeout(r, 0));
    t('زر Google يبدأ OAuth', calls.oauth.length === 1);
    t('بمزوّد google', calls.oauth[0].provider === 'google');
    t('وبعودة إلى نفس الصفحة', /^https:\/\/pmo\.example\//.test(calls.oauth[0].options.redirectTo));
    t('#loginErr مخفي عند البدء', doc.getElementById('loginErr').style.display === 'none');
    t('زرّا الخروج مربوطان',
      typeof doc.getElementById('signout').onclick === 'function' &&
      typeof doc.getElementById('signoutDenied').onclick === 'function');
    t('وهما النداء نفسه',
      doc.getElementById('signout').onclick === doc.getElementById('signoutDenied').onclick);
  }

  console.log(`\nنجح ${ok} · فشل ${fail}`);
  process.exit(fail ? 1 : 0);
})();

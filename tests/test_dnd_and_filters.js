// اختبار: نقل البنود بالسحب والإفلات، حلّ الحزم مع بقاء بنودها، وفلترة محفظة العقود.
const fs=require('fs');
let ok=0,fail=0;
const t=(n,c,x)=>{if(c){ok++;console.log('  ✓ '+n);}else{fail++;console.log('  ✗ '+n+(x?' → '+x:''));}};
const v=fs.readFileSync('src/views.js','utf8');
const api=fs.readFileSync('src/api.js','utf8');
const hub=fs.readFileSync('src/app/contractshub.js','utf8');
const css=fs.readFileSync('src/styles.css','utf8');

// ===== السحب والإفلات =====
t('البنود قابلة للسحب عند صلاحية التعديل فقط',
  v.includes("editStruct&&t.type!=='cont'?`draggable=\"true\"")); 
t('حزم العمل أهداف إفلات',v.includes('data-droppkg='));
t('رؤوس المراحل أهداف إفلات أيضًا (إخراج البند من حزمته)',v.includes("document.querySelectorAll('tr.grp')"));
t('الإفلات على مرحلة يستخرج مفتاحها لا يخمّنه',v.includes("el.querySelector('[data-grpedit]')"));
t('منع إفلات البند على نفسه',v.includes('if(pkgId&&pkgId===id)return'));
t('مؤشّر بصري أثناء السحب والإفلات',css.includes('.drag-src')&&css.includes('tr.drop-on'));
t('دالة النقل معرَّفة',/async function moveTask/.test(api));

// ===== حوكمة =====
t('الخادم يرفض النقل على خطة مثبَّتة بلا طلب معتمَد',api.includes("data.error==='baselined_locked'"));
t('رسالة الرفض توضّح الطريق الصحيح',api.includes('يحتاج طلب تغيير معتمَدًا أولًا'));

// ===== حلّ الحزمة =====
t('زر حلّ الحزمة موجود',v.includes('data-dissolve=')&&v.includes('حلّ الحزمة مع بقاء بنودها'));
t('الحوار يؤكد صراحة أن البنود لن تُحذف',v.includes('لن يُحذف أي بند'));
t('يمكن ضمّ البنود لحزمة أخرى أو تركها مستقلة',
  v.includes('تبقى مستقلة في نفس المرحلة')&&v.includes('ضمّها إلى: '));
t('دالة الحلّ معرَّفة',/async function dissolvePackage/.test(api));

// ===== فلترة العقود — على الدالة الخالصة لا على نصّها =====
//
// كانت هنا تأكيداتٌ نصّية تبحث عن `CH_FILTER.link==='linked'` في المصدر. وهي
// تُثبت أن الفرع مكتوب لا أنه يُصفّي صحيحًا — وقلبُ الشرط يُبقي النصّ مطابقًا.
// وقد خرج القرار إلى `filterContracts(list,f)` (W3) فصار يُستجوَب بالحالات.
//
// وأخطر ما في هذه المصفوفة أن مرشِّحاتها **تتقاطع**: خطأٌ في واحدٍ منها يُخفي
// عقودًا بلا رسالة ولا أثر — المستخدم يرى قائمةً أقصر ويظنّها كل ما لديه.
{
  const { JSDOM } = require('jsdom');
  const html = fs.readFileSync('index.html', 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '');
  const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://pmo.example/' }).window;
  w.eval(`window.supabase={createClient:()=>({rpc:()=>Promise.resolve({data:[],error:null}),
    from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null}),
      eq:()=>({maybeSingle:async()=>({data:null,error:null})})})}),
    auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),
      onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
    channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>{}})}`);
  { const sc = w.document.createElement('script');
    sc.textContent = fs.readFileSync('app.bundle.js', 'utf8'); w.document.body.appendChild(sc); }
  const F = w.filterContracts;

  const C = (id, o = {}) => Object.assign({ id, status: 'signed', client_id: 'c1', contract_type: 'standard',
    project_id: null, source_contract_id: null, amends_contract_id: null, contract_name: 'عقد ' + id,
    contract_number: 'N-' + id, client_name: 'شريك', project_name: null, contract_value: 0,
    created_at: '2026-01-01', end_date: null }, o);
  const BASE = { status: 'all', client: '', type: '', link: '', q: '', sort: '' };
  const f = (list, over) => F(list, Object.assign({}, BASE, over)).map(x => x.id);

  const L = [
    C('a'), C('b', { status: 'void' }), C('c', { client_id: 'c2' }),
    C('d', { contract_type: 'custom' }), C('e', { project_id: 'p1' }),
    C('f', { client_id: null }),                       // أصل (قالب)
    C('g', { amends_contract_id: 'a' }),
    C('h', { client_id: null, source_contract_id: 'f' })  // نسخة من أصل
  ];

  t('بلا مرشِّح: الكل', f(L, {}).length === L.length, f(L, {}).join(','));
  t('الحالة', f(L, { status: 'void' }).join() === 'b');
  t('الشريك', f(L, { client: 'c2' }).join() === 'c');
  t('النوع', f(L, { type: 'custom' }).join() === 'd');
  t('المرتبط بمشروع', f(L, { link: 'linked' }).join() === 'e');
  t('وغير المرتبط هو المتمّم', f(L, { link: 'unlinked' }).length === L.length - 1);
  // «أصل» = بلا شريك وبلا مصدر. والنسخة من أصلٍ ليست أصلًا وإن كانت بلا شريك.
  t('الأصول (القوالب) وحدها', f(L, { link: 'template' }).join() === 'f', f(L, { link: 'template' }).join());
  t('الملاحق وحدها', f(L, { link: 'amendment' }).join() === 'g');

  // البحث: أربعة حقول، وغير الحسّاس للحالة، ومطابقةٌ جزئية.
  t('البحث بالاسم', f(L, { q: 'عقد a' }).join() === 'a');
  t('وبالرقم', f(L, { q: 'n-c' }).join() === 'c');
  t('وبغير حساسيةٍ للحالة', f(L, { q: 'N-C' }).join() === 'c');
  t('وبحقلٍ فارغٍ لا يُسقط شيئًا', f(L, { q: '   ' }).length === L.length);
  t('وباسم الشريك يُطابق كل من يحمله', f(L, { q: 'شريك' }).length === L.length,
    f(L, { q: 'شريك' }).length + ' من ' + L.length);
  t('والمشروع من ضمن حقول البحث',
    f([C('x', { project_name: 'هوية' }), C('y')], { q: 'هوية' }).join() === 'x');

  // التقاطع: المرشِّحات تُطبَّق معًا لا بديلًا.
  t('مرشِّحان معًا يتقاطعان',
    f([C('p', { status: 'void', client_id: 'c2' }), C('q', { status: 'void' }), C('r', { client_id: 'c2' })],
      { status: 'void', client: 'c2' }).join() === 'p');

  // الترتيب.
  const V = [C('lo', { contract_value: 10 }), C('hi', { contract_value: 99 })];
  t('الفرز بالقيمة تنازليًا', f(V, { sort: 'value' }).join() === 'hi,lo');
  const E = [C('late', { end_date: '2026-12-01' }), C('soon', { end_date: '2026-02-01' }), C('none')];
  // بلا تاريخ انتهاء ⇒ في الآخر: «قرب الانتهاء» لا معنى له بلا تاريخ.
  t('الفرز بقرب الانتهاء، وبلا تاريخٍ في الآخر', f(E, { sort: 'ending' }).join() === 'soon,late,none');
  t('والافتراضي الأحدث إنشاءً',
    f([C('old', { created_at: '2026-01-01' }), C('new', { created_at: '2026-06-01' })], {}).join() === 'new,old');

  // ولا يمسّ القائمة الأصلية — نسخةٌ لا فرزٌ في مكانه. والتجهيزة **مقلوبة عمدًا**:
  // لو كانت مرتَّبةً أصلًا لَما استطاع فرزٌ في المكان أن يُغيّرها، فيمرّ التأكيد
  // وهو عاجزٌ عن السقوط. (وقد وقع ذلك فعلًا في أوّل صياغةٍ له.)
  const orig = [C('z2', { contract_name: 'ياء' }), C('z1', { contract_name: 'ألف' })];
  const before = orig.map(x => x.id).join();
  F(orig, Object.assign({}, BASE, { sort: 'name' }));
  t('لا يفرز القائمة الأصلية في مكانها', orig.map(x => x.id).join() === before,
    before + ' صارت ' + orig.map(x => x.id).join());
}
t('مؤشرات سريعة تُحسب من المعروض فعليًا',hub.includes('const totalValue=filtered.reduce'));
t('زر مسح الفلاتر يظهر عند وجود فلتر نشط',hub.includes('id="chubReset"'));

console.log('\nنجح '+ok+' · فشل '+fail);
process.exit(fail?1:0);

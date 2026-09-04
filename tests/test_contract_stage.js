// ===== قرارا لوحة العقد — خالصان، ومُختبَران أخيرًا (الموجة W3) =====
//
// `contractStage` و`defaultContractTab` كانا ٦٥ سطرًا **داخل**
// `openContractDetailPanel` (٧٧٤ سطرًا). وهما أهمّ ما فيها: يحدّدان ما يراه
// المستخدم وما يستطيع فعله بعقدٍ في كل حالة — من يعتمد، ومن يوقّع، وما التالي.
//
// ولم يكن عليهما تأكيدٌ سلوكيّ واحد. ما كان موجودًا تأكيداتٌ **نصّية** في
// test_contract_ux.js: تبحث عن `'عقد ملغى'` في المصدر فتثبت أن النصّ مكتوب،
// ولا تثبت أنه يظهر في الحالة الصحيحة. والفرق بينهما هو الفرق بين توثيقٍ
// وحارس: خطأٌ في ترتيب `else if` يمرّ من الأول ولا يمرّ من هذا الملف.
//
// وهذا هو مكسب التفكيك الحقيقي: لا سطرَ أقلّ في دالةٍ طويلة، بل **قرارٌ صار
// قابلًا للفحص** بلا DOM ولا شبكة ولا حالة عامّة.

const fs = require('fs');
const { JSDOM } = require('jsdom');

let ok = 0, fail = 0;
const t = (n, c, x) => { if (c) { ok++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? ' → ' + x : '')); } };
const eq = (n, got, want) => t(n, got === want, `توقّعنا ${JSON.stringify(want)} وجاء ${JSON.stringify(got)}`);

// الحزمة الحقيقية في نافذة jsdom — نفس الطريق الذي تسلكه بقيّة الاختبارات.
const html = fs.readFileSync('index.html', 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '');
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://pmo.example/' });
const w = dom.window;
w.eval(`window.supabase={createClient:()=>({rpc:()=>Promise.resolve({data:[],error:null}),
  from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null}),
    eq:()=>({maybeSingle:async()=>({data:null,error:null})})})}),
  auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),
    onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>{}})}`);
{ const s = w.document.createElement('script'); s.textContent = fs.readFileSync('app.bundle.js', 'utf8');
  w.document.body.appendChild(s); }

const { contractStage, defaultContractTab } = w;

// عقدٌ في أبسط حالاته الصالحة: معتمَد، مُسنَد لشريك، بلا توقيع.
const base = (over = {}) => Object.assign({
  id: 'k1', status: 'active', client_id: 'c1', source_contract_id: null,
  internal_approved: true, archived_at: null, project_id: null,
  send_count: 0, amendment_count: 0, amends_contract_id: null,
  approval_override_reason: null, signatures: []
}, over);

// الحقائق المشتقّة كما تشتقّها اللوحة نفسها — تُبنى هنا مرّة كي لا تتكرّر.
const facts = (c, canApprove = true) => {
  const al = c.signatures.find(s => s.party === 'alamaa');
  const cl = c.signatures.find(s => s.party === 'client');
  const anySigned = !!(al || cl);
  return { al, cl, anySigned, editable: !anySigned && c.status !== 'void', canApprove };
};
const stage = (c, canApprove = true) => contractStage(c, facts(c, canApprove));

console.log('\n▸ الدالتان مُصدَّرتان ووصلتا');
t('contractStage دالة', typeof contractStage === 'function');
t('defaultContractTab دالة', typeof defaultContractTab === 'function');

console.log('\n▸ مصفوفة المراحل — كل حالة وإجراؤها الأساسي');
// الترتيب نفسه مقصود: الإلغاء يسبق الأرشفة يسبق الاعتماد. وأي قلبٍ فيه يُنتج
// لوحةً تعرض «بانتظار الاعتماد» لعقدٍ ملغى — وهو ما تمنعه الحالات المركَّبة أدناه.
const M = [
  ['ملغى', base({ status: 'void' }), 'void', 'عقد ملغى', null],
  ['مؤرشف', base({ archived_at: '2026-01-01' }), 'muted', 'عقد مؤرشف', 'chdUnarchive'],
  ['بانتظار الاعتماد', base({ internal_approved: false }), 'wait', 'بانتظار الاعتماد الداخلي', 'chdApprove'],
  ['أصل (قالب)', base({ client_id: null }), 'info', 'عقد أصل (قالب) معتمَد', 'chdAssign'],
  ['بانتظار علامة', base(), 'go', 'بانتظار توقيع علامة', 'chdSignNow'],
  ['بانتظار الشريك', base({ signatures: [{ party: 'alamaa', name: 'أ' }] }), 'go', 'بانتظار توقيع الشريك', null],
  ['موقَّع بالكامل', base({ signatures: [{ party: 'alamaa', name: 'أ' }, { party: 'client', name: 'ب' }] }),
    'done', 'موقَّع بالكامل', 'chdCert']
];
for (const [name, c, tone, title, primary] of M) {
  const S = stage(c);
  eq(`${name} · النبرة`, S.tone, tone);
  eq(`${name} · العنوان`, S.title, title);
  eq(`${name} · الإجراء الأساسي`, S.primary && S.primary.id, primary);
  t(`${name} · يشرح الخطوة التالية`, typeof S.hint === 'string' && S.hint.length > 10, S.hint);
}

console.log('\n▸ الأسبقية بين الحالات — وهي ما لا يقيسه فحص النصّ إطلاقًا');
eq('الملغى يسبق المؤرشف', stage(base({ status: 'void', archived_at: '2026-01-01' })).title, 'عقد ملغى');
eq('الملغى يسبق «بانتظار الاعتماد»', stage(base({ status: 'void', internal_approved: false })).title, 'عقد ملغى');
eq('المؤرشف يسبق «بانتظار الاعتماد»',
  stage(base({ archived_at: '2026-01-01', internal_approved: false })).title, 'عقد مؤرشف');
eq('«بانتظار الاعتماد» يسبق كونه قالبًا',
  stage(base({ client_id: null, internal_approved: false })).title, 'بانتظار الاعتماد الداخلي');
// وعقدٌ موقَّع لا يعود إلى «بانتظار الاعتماد» مهما كانت الراية — التوقيع يحسم.
eq('التوقيع يحسم: لا عودة إلى الاعتماد',
  stage(base({ internal_approved: false, signatures: [{ party: 'alamaa', name: 'أ' }] })).title,
  'بانتظار توقيع الشريك');

console.log('\n▸ الصلاحية: من لا يملك الاعتماد يُخبَر لا يُعطَّل بصمت');
{
  const c = base({ internal_approved: false });
  const yes = stage(c, true), no = stage(c, false);
  eq('المالك/المدير يرى زر الاعتماد', yes.primary && yes.primary.id, 'chdApprove');
  eq('وغيره لا يراه', no.primary, null);
  t('لكنه يُخبَر بالسبب — لا زرّ صامت ولا فراغ',
    no.notes.some(n => /صلاحية/.test(n.text)), JSON.stringify(no.notes));
}

console.log('\n▸ الإجراء الأساسي لا يتكرّر في القائمة الثانوية');
for (const [name, c] of M.map(r => [r[0], r[1]])) {
  const S = stage(c);
  const dup = S.primary && S.secondary.filter(a => a.id === S.primary.id).length;
  t(`${name} · بلا تكرار`, !dup, S.primary && S.primary.id);
}

console.log('\n▸ الثانويّات تتبع الحالة لا قائمة ثابتة');
{
  const ids = c => stage(c).secondary.map(a => a.id);
  t('التصدير والتكرار متاحان دائمًا',
    M.every(([, c]) => ids(c).includes('chdExport') && ids(c).includes('chdDuplicate')));
  t('الأرشفة تُعرض للقابل للأرشفة وحده', ids(base()).includes('chdArchive'));
  t('ولا تُعرض للموقَّع', !ids(base({ signatures: [{ party: 'alamaa', name: 'أ' }] })).includes('chdArchive'));
  t('ولا تُعرض للملغى', !ids(base({ status: 'void' })).includes('chdArchive'));
  t('«فك الارتباط» يظهر بوجود مشروع', ids(base({ project_id: 'p1' })).includes('chdUnlink'));
  t('ويغيب بغيابه', !ids(base()).includes('chdUnlink'));
  t('«إلغاء العقد» للقابل للتحرير وحده', ids(base()).includes('chdVoid'));
  t('ولا يُعرض لعقدٍ ملغى أصلًا', !ids(base({ status: 'void' })).includes('chdVoid'));
  t('«الملحق» و«الشهادة» للموقَّع',
    ids(base({ signatures: [{ party: 'alamaa', name: 'أ' }] })).includes('chdAmend'));
}

console.log('\n▸ الملاحظات: تجميد بيانات الطرفين، والاعتماد الذاتي');
{
  t('غير الموقَّع: البيانات حيّة', stage(base()).notes.some(n => /حيّة/.test(n.text)));
  t('الموقَّع: البيانات مجمَّدة',
    stage(base({ signatures: [{ party: 'alamaa', name: 'أ' }] })).notes.some(n => /مجمَّدة/.test(n.text)));
  // الاعتماد الذاتي أثرٌ حوكميّ: يجب أن يبقى مرئيًا بنبرة تحذير لا أن يُبتلع.
  const ov = stage(base({ approval_override_reason: 'مالك المنصّة' }))
    .notes.find(n => /اعتماد ذاتي/.test(n.text));
  t('الاعتماد الذاتي موثَّق ومرئيّ', !!ov);
  eq('وبنبرة تحذير', ov && ov.tone, 'warn');
  t('ونصّ السبب مُهرَّب لا مُدرَج خامًا',
    !stage(base({ approval_override_reason: '<img onerror=x>' }))
      .notes.some(n => n.text.includes('<img')));
}

console.log('\n▸ التبويب الافتراضي يتبع المرحلة');
{
  const tab = c => defaultContractTab(c, facts(c));
  eq('غير معتمَد → الشروط (يُراجَع قبل أن يُرسَل)', tab(base({ internal_approved: false })), 'terms');
  eq('معتمَد وبانتظار الشريك → الإرسال', tab(base()), 'send');
  eq('موقَّع بالكامل → نظرة عامة',
    tab(base({ signatures: [{ party: 'alamaa', name: 'أ' }, { party: 'client', name: 'ب' }] })), 'overview');
  eq('ملغى → نظرة عامة لا الإرسال', tab(base({ status: 'void' })), 'overview');
}

console.log(`\nنجح ${ok} · فشل ${fail}`);
process.exit(fail ? 1 : 0);

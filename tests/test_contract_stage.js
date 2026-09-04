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

const { contractStage, defaultContractTab, contractPanelHTML,
        contractFunnelSteps, contractLinkValidity,
        contractFunnelHTML, signatureCertificateHTML } = w;

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

console.log('\n▸ صلاحية رابط التوقيع — قاعدةٌ يراها الشريك ولم تكن محروسة');
{
  const DAY = 86400000;
  const sent = '2026-03-01T00:00:00Z';
  const at = d => +new Date(sent) + d * DAY;

  // الافتراضي ثلاثون يومًا حين لا ينصّ العقد.
  eq('المدة الافتراضية ٣٠ يومًا', contractLinkValidity(base(), sent, at(0)).days, 30);
  eq('والعقد ينصّ عليها فتُتَّبع', contractLinkValidity(base({ link_valid_days: 7 }), sent, at(0)).days, 7);
  eq('و`0` ليست صفرًا بل غيابُ نصّ — فتعود للافتراضي',
    contractLinkValidity(base({ link_valid_days: 0 }), sent, at(0)).days, 30);

  eq('يوم الإرسال: ٣٠ يومًا متبقّية', contractLinkValidity(base(), sent, at(0)).daysLeft, 30);
  eq('بعد ٢٩ يومًا: يومٌ واحد', contractLinkValidity(base(), sent, at(29)).daysLeft, 1);
  // الحدّ بالضبط: لحظةُ الانتهاء نفسها منتهية لا صالحة — وهذا ما يراه الشريك.
  eq('عند الانتهاء تمامًا: صفر', contractLinkValidity(base(), sent, at(30)).daysLeft, 0);
  t('وتُعدّ منتهية', contractLinkValidity(base(), sent, at(30)).expired);
  t('وقبلها بلحظة لا تكون منتهية', !contractLinkValidity(base(), sent, at(30) - 1).expired);
  eq('وبعدها بيوم: سالب', contractLinkValidity(base(), sent, at(31)).daysLeft, -1);

  // القاعدة التي تشرحها الواجهة: أي تذكير يجدّد المدة — لأن الحساب من آخر إرسال.
  const late = contractLinkValidity(base(), '2026-03-20T00:00:00Z', at(30));
  // إرسالٌ في ٢٠ مارس ينتهي في ١٩ أبريل؛ والآن ٣١ مارس ⇒ ١٩ يومًا.
  eq('التذكير يجدّد: إرسالٌ أحدث يعيد العدّاد', late.daysLeft, 19);
}

console.log('\n▸ مسار الرسالة — أين وصلت، وما التالي');
{
  const F = o => contractFunnelSteps(o);
  eq('خمس خطوات دائمًا', F({}).steps.length, 5);
  eq('بلا إرسال: لا خطوة محقَّقة', F({}).lastDone, -1);
  eq('أُرسلت فقط', F({ sent_at: 'x' }).lastDone, 0);
  eq('وصلت', F({ sent_at: 'x', delivered_at: 'y' }).lastDone, 1);
  eq('وُقِّع — آخر الخطوات',
    F({ sent_at: 'a', delivered_at: 'b', opened_at: 'c', clicked_at: 'd', signed_at: 'e' }).lastDone, 4);
  // القاعدة الدقيقة: الفهرس هو **آخر** خطوة لها طابع زمني، فثغرةٌ في الوسط
  // (بريدٌ وصل بلا إشعار فتح) لا تُسقط ما بعدها ولا توقف المسار عندها.
  eq('ثغرة في الوسط لا توقف المسار',
    F({ sent_at: 'a', delivered_at: 'b', clicked_at: 'd' }).lastDone, 3);
  eq('ولا حتى توقيعٌ بلا ما قبله', F({ signed_at: 'e' }).lastDone, 4);
  t('وترتيب الخطوات هو ترتيب الحياة الواقعي',
    F({}).steps.map(s => s.k).join('|') === 'أُرسلت|وصلت|فُتحت|نُقر الرابط|وُقِّع');
}

console.log('\n▸ ترميز اللوحة — بانٍ خالص، يُقارَن نصًّا');
{
  const html = (c, over = {}) => contractPanelHTML(c, Object.assign({
    STAGE: contractStage(c, facts(c)), cl: facts(c).cl,
    anySigned: facts(c).anySigned, editable: facts(c).editable,
    isCustom: c.contract_type === 'custom',
    link: 'https://pmo.example/#/sign/tok', tab: 'overview'
  }, over));

  const h = html(base());
  t('التبويبات الخمسة موجودة',
    ['overview', 'terms', 'attach', 'send', 'log'].every(k => h.includes(`data-pane="${k}"`)));
  // التبويب المفتوح هو المُمرَّر لا حالةُ الوحدة — وهذا ما يجعل الدالة خالصة.
  t('المفتوح هو المُمرَّر وحده',
    /data-pane="overview" >/.test(h) || h.includes('data-pane="overview" \n'), 'overview');
  t('وبقيّتها مخفيّة', (h.match(/data-pane="[a-z]+" hidden/g) || []).length === 4);
  const h2 = html(base(), { tab: 'send' });
  t('وتمرير تبويبٍ آخر ينقل الفتح إليه',
    (h2.match(/data-pane="[a-z]+" hidden/g) || []).length === 4 && !/data-pane="send" hidden/.test(h2));

  t('الإجراء الأساسي يظهر بمعرّفه', html(base()).includes('id="chdSignNow"'));
  t('والثانويّات في قائمة ⋯', h.includes('id="chdMoreMenu"') && h.includes('id="chdExport"'));

  // نفس المُدخَل يُنتج نفس المُخرَج.
  eq('نداءان متطابقان', html(base()), html(base()));

  // ...لكن هذا **لا يُثبت الخلوص**: نداءان يقرآن حالةَ الوحدة نفسها يتطابقان
  // أيضًا. جرّبتُ كسرَها بإعادة قراءة `CHD_TAB` داخل الباني فمرّ التأكيد أعلاه.
  // وحالةُ الوحدة ليست مُصدَّرة فلا سبيل لتبديلها من هنا — فيُفحَص المصدر: أن
  // جسم الباني لا يذكر رابطةً من رواب��� الوحدة أصلًا. تأكيدٌ نصّي عن قصد، لأن
  // الدعوى نفسها بنيوية: «لا مُدخَل لهذه الدالة خارج وسائطها».
  {
    const src = fs.readFileSync('src/app/contractshub.js', 'utf8');
    const at = src.indexOf('export function contractPanelHTML');
    const body = src.slice(at, src.indexOf('\n}', at));
    const leaks = ['CHD_TAB', 'CHD_ORG', 'CHD_TEMPLATE', 'CHD_OVERRIDES', 'CH_CONTRACTS']
      .filter(n => new RegExp(`(?<![\\w$])${n}(?![\\w$])`).test(body));
    t('ولا مُدخَل لها خارج وسائطها', leaks.length === 0, leaks.join(' '));
  }

  // التهريب: اسم العقد يأتي من المستخدم، ولا يجوز أن يخرج خامًا في الترميز.
  const evil = html(base({ contract_name: '<img src=x onerror=alert(1)>' }));
  t('اسم العقد مُهرَّب', !evil.includes('<img src=x'), evil.slice(0, 200));
  t('ورقمه كذلك', !html(base({ contract_number: '<b>x</b>' })).includes('<b>x</b>'));
}

console.log('\n▸ ترميز مسار الرسالة');
{
  const fmt = d => d ? 'ت:' + d : null;
  const H = o => { const { steps, lastDone } = contractFunnelSteps(o); return contractFunnelHTML(o, steps, lastDone, fmt); };

  const none = H({});
  eq('بلا إرسال: لا خطوة تمّت', (none.match(/chd-step done/g) || []).length, 0);
  // وأوّلها هي «التالية» لا معلَّقة: قبل الإرسال، الإرسالُ نفسه هو ما يُنتظَر —
  // وهذا ما يجعل الشريط يدلّ على فعلٍ بدل أن يصف عدمًا.
  eq('وأوّلها هي التالية', (none.match(/chd-step next/g) || []).length, 1);
  eq('والأربع الباقية معلَّقة', (none.match(/chd-step pending/g) || []).length, 4);

  const sent = H({ sent_at: 'a', has_send: true });
  eq('بعد الإرسال: واحدة تمّت', (sent.match(/chd-step done/g) || []).length, 1);
  eq('وواحدة تالية لا أكثر', (sent.match(/chd-step next/g) || []).length, 1);
  t('والتالية معنونة «بانتظاره»', sent.includes('بانتظاره'));

  const all = H({ sent_at: 'a', delivered_at: 'b', opened_at: 'c', clicked_at: 'd', signed_at: 'e' });
  eq('مكتمل: خمس تمّت', (all.match(/chd-step done/g) || []).length, 5);
  eq('ولا تالية بعد الاكتمال', (all.match(/chd-step next/g) || []).length, 0);

  // الارتداد: أخطر ما في المسار — رسالةٌ لم تصل والمستخدم يظنّها في الطريق.
  const b = H({ sent_at: 'a', bounced_at: 'z', bounce_reason: 'صندوق ممتلئ' });
  t('الارتداد يظهر بتحذير', b.includes('ارتدّت الرسالة') && b.includes('ctr-integrity warn'));
  t('وسببه يُعرَض', b.includes('صندوق ممتلئ'));
  t('وسببٌ خبيث يُهرَّب', !H({ sent_at: 'a', bounced_at: 'z', bounce_reason: '<b>x</b>' }).includes('<b>x</b>'));
  t('وبريد المستلم مُهرَّب كذلك', !H({ to_email: '<i>e</i>' }).includes('<i>e</i>'));

  // تنبيه التتبّع: يظهر بعد إرسالٍ فعليّ فقط — وإلا كان ضجيجًا دائمًا.
  t('تنبيه التتبّع يظهر بعد إرسالٍ بلا تتبّع', H({ sent_at: 'a' }).includes('Webhook'));
  t('ولا يظهر قبل أي إرسال', !H({}).includes('Webhook'));
  t('ولا يظهر والتتبّع مفعَّل', !H({ sent_at: 'a', tracking_active: true }).includes('Webhook'));
}

console.log('\n▸ شهادة التوقيع — أثقل مخرَجات المنصّة أثرًا');
{
  // تُقدَّم عند النزاع. فغيابُ حقلٍ منها أو تسرّبُ نصٍّ غير مُهرَّب ليس عيبًا بصريًا.
  const cert = (over = {}) => Object.assign({
    generated_at: '2026-03-01T10:00:00Z',
    contract: { name: 'عقد هوية', number: 'ALM-1' },
    parties: { org: { legal_name: 'علامة', cr_number: '1010', vat_number: '3000', rep_name: 'أ' },
               partner: { name: 'شريك', cr: '2020', vat: '4000', rep: 'ب' } },
    document: { sealed_at: '2026-02-01T00:00:00Z', sealed_hash: 'HASH1', algo: 'sha256' },
    governance: {}, attachments: [], signatures: [], audit: []
  }, over);

  const h = signatureCertificateHTML(cert());
  t('العقد واسمه ورقمه', h.includes('عقد هوية') && h.includes('ALM-1'));
  t('الطرفان وبياناتهما',
    ['علامة', '1010', '3000', 'شريك', '2020', '4000'].every(v => h.includes(v)));
  t('وأقسامها الخمسة موجودة',
    ['أولًا', 'خامسًا'].every(v => h.includes(v)) && (h.match(/cx-annex-hd/g) || []).length >= 4);
  t('ووقت التوليد مذكور', h.includes('وثيقة أدلة مُولَّدة'));

  // الحقول الغائبة تُعرَض «—» لا `undefined` ولا فراغًا صامتًا.
  const bare = signatureCertificateHTML(cert({ parties: { org: {}, partner: {} } }));
  t('حقلٌ غائب يُعرَض شرطةً لا undefined', !bare.includes('undefined'), 'undefined في الوثيقة');
  t('والطرف الأول له اسمٌ افتراضي', bare.includes('علامة'));

  // التهريب: كل نصّ في الوثيقة يأتي من القاعدة، وبعضه من إدخال المستخدم.
  const evil = signatureCertificateHTML(cert({
    contract: { name: '<script>x</script>', number: '<b>n</b>' },
    parties: { org: { legal_name: '<i>o</i>' }, partner: { name: '<u>p</u>' } }
  }));
  ['<script>', '<b>n</b>', '<i>o</i>', '<u>p</u>'].forEach(bad =>
    t('مُهرَّب: ' + bad, !evil.includes(bad)));

  // سجل الإجراءات والتواقيع: قائمتان فارغتان لا تُسقطان الوثيقة.
  t('سجلٌّ فارغ لا يكسر الوثيقة', signatureCertificateHTML(cert({ audit: [] })).includes('سجل الإجراءات'));
  const withAudit = signatureCertificateHTML(cert({ audit: [{ action: 'x', by: 'ج', at: '2026-03-01T00:00:00Z' }] }));
  t('وسطرُ سجلٍّ يظهر بمنفِّذه', withAudit.includes('ج'));
  t('و`audit` غائبةً تمامًا لا ترمي',
    typeof signatureCertificateHTML(cert({ audit: undefined })) === 'string');
}

console.log(`\nنجح ${ok} · فشل ${fail}`);
process.exit(fail ? 1 : 0);

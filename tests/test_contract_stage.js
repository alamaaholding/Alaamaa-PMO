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
const bundle = fs.readFileSync('app.bundle.js', 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://pmo.example/' });
const w = dom.window;
w.eval(`window.supabase={createClient:()=>({rpc:()=>Promise.resolve({data:[],error:null}),
  from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null}),
    eq:()=>({maybeSingle:async()=>({data:null,error:null})})})}),
  auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),
    onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>{}})}`);
{ const s = w.document.createElement('script'); s.textContent = bundle;
  w.document.body.appendChild(s); }

const { contractStage, defaultContractTab, contractPanelHTML,
        contractFunnelSteps, contractLinkValidity,
        contractFunnelHTML, signatureCertificateHTML,
        contractAttachmentsHTML, auditChangeSummary, contractAuditHTML,
        isSendableEmail } = w;

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

console.log('\n▸ المرفقات — ثلاث قواعد يراها المستخدم');
{
  const A = (atts, editable = true, over = {}) => contractAttachmentsHTML(base(over), atts, editable);

  // القاعدة الأولى: الخطة المعتمدة ملحقٌ تلقائيّ لا يُحذف ولا يُرفَع.
  const withPlan = A([], true, { baseline_id: 'b1', baseline_label: 'خط الأساس ١' });
  t('الخطة المعتمدة تظهر كملحق تلقائي', withPlan.includes('ملحق (١)') && withPlan.includes('تلقائي'));
  t('وعنوانها يُعرَض', withPlan.includes('خط الأساس ١'));
  t('ولا زرّ حذفٍ لها', !/data-delatt[^>]*>حذف<\/button>[\s\S]{0,40}ملحق \(١\)/.test(withPlan));
  t('وبلا خط أساس لا تظهر', !A([]).includes('ملحق (١)'));

  // القاعدة الثانية: حدّ الرفع ٢٥ م.ب، معلنًا قبل المحاولة لا بعد الرفض.
  t('حدّ الرفع معلَن مسبقًا', A([]).includes('25 م.ب'));

  // القاعدة الثالثة: عقدٌ وُقّع تُقفَل مرفقاته — فلا يُعرَض نموذج الرفع أصلًا.
  const locked = A([{ id: 'a1', kind: 'file', label: 'كشف', storage_path: 'p/1' }], false);
  t('الموقَّع: لا نموذج رفع', !locked.includes('chdAttUpload') && !locked.includes('chdAttAdd'));
  t('ولا زرّ حذف', !locked.includes('data-delatt'));
  t('ويُشرَح السبب لا يُترَك فراغًا', locked.includes('لا يمكن تعديل مرفقات عقد وقّع عليه طرف'));
  t('لكنّ المرفق القائم يبقى مفتوحًا للاطّلاع', locked.includes('data-openfile'));

  // فرق الملف المرفوع عن الرابط الخارجي — وهو فرقٌ في المتانة لا في الشكل.
  const file = A([{ id: 'a1', kind: 'file', label: 'كشف', storage_path: 'p/1', file_size: 2048 }]);
  const link = A([{ id: 'a2', kind: 'link', label: 'مرجع', url: 'https://x.test/d' }]);
  t('الملف المرفوع يُفتح عبر التخزين', file.includes('data-openfile'));
  t('وحجمه يُعرَض', file.includes('2 ك.ب'));
  t('والرابط الخارجي يُفتح مباشرةً بـnoopener',
    link.includes('rel="noopener"') && link.includes('https://x.test/d'));
  t('والتحذير من انكسار الرابط قائم', A([]).includes('قد ينكسر أو يتغيّر بعد التوقيع'));

  t('حالة فارغة مفهومة', A([]).includes('لا مرفقات إضافية بعد'));
  // ولا «فارغة» حين توجد الخطة وحدها — فهي مرفقٌ فعليّ.
  t('ولا تُعرَض والخطة قائمة',
    !A([], true, { baseline_id: 'b1' }).includes('لا مرفقات إضافية بعد'));

  t('اسم المرفق مُهرَّب', !A([{ id: 'a', kind: 'link', label: '<b>x</b>' }]).includes('<b>x</b>'));
  t('ومسار الملف مُهرَّب', !A([{ id: 'a', kind: 'file', label: 'م', storage_path: '"><i>' }]).includes('"><i>'));
}

console.log('\n▸ سجل التدقيق — تلخيص التغيير');
{
  eq('لا قيمة → فراغ', auditChangeSummary(null), '');
  eq('حقلٌ بسيط', auditChangeSummary({ 'القيمة': 100 }), 'القيمة: 100');
  eq('تغييرٌ من/إلى', auditChangeSummary({ 'القيمة': { 'من': 100, 'إلى': 200 } }), 'القيمة: 100 ← 200');
  // إفراغ حقلٍ حدثٌ حوكميّ: يجب أن يُقرأ «كان ثم لم يعد»، لا أن يختفي.
  eq('الإفراغ يُقرأ لا يختفي', auditChangeSummary({ 'ملاحظة': { 'من': 'س', 'إلى': null } }), 'ملاحظة: س ← —');
  eq('والملء من عدم', auditChangeSummary({ 'ملاحظة': { 'من': null, 'إلى': 'س' } }), 'ملاحظة: — ← س');
  // رقم العقد يظهر في رأس الصف، فتكراره في التفصيل ضجيج.
  eq('رقم العقد مُستثنى', auditChangeSummary({ number: 'ALM-1', 'القيمة': 5 }), 'القيمة: 5');
  eq('ولو كان وحده', auditChangeSummary({ number: 'ALM-1' }), '');
  eq('حقلان يُفصلان بنقطة', auditChangeSummary({ 'أ': 1, 'ب': 2 }), 'أ: 1 · ب: 2');

  const rows = [{ action: 'x', new_value: { 'القيمة': { 'من': 1, 'إلى': 2 } },
                  user_id: 'u1', created_at: '2026-03-01T00:00:00Z' }];
  const h = contractAuditHTML(rows, () => 'أحمد');
  t('الصف يحمل المنفِّذ', h.includes('أحمد'));
  t('والتفصيل', h.includes('1 ← 2'));
  // الصف يلفّ اسم الإجراء بـ<b> من قالبه، فاختيار نصٍّ خبيثٍ يشبهه يُنتج
  // إخفاقًا زائفًا. نصٌّ مميَّز، والدعوى أن يخرج **مُهرَّبًا** لا أن يختفي.
  const evilWho = contractAuditHTML(rows, () => '<img src=q onerror=z>');
  t('واسم المنفِّذ مُهرَّب', !evilWho.includes('<img src=q'), evilWho);
  t('ويظهر مُهرَّبًا لا يُحذف', evilWho.includes('&lt;img src=q'));
  eq('سجلٌّ فارغ يعطي نصًّا فارغًا', contractAuditHTML([], () => '—'), '');
}

console.log('\n▸ بريد الإرسال — منع الخطأ المطبعيّ لا تطبيق RFC');
{
  ['a@b.co', 'اسم@نطاق.السعودية', 'x.y+z@sub.domain.tld'].forEach(v =>
    t('يُقبل: ' + v, isSendableEmail(v)));
  ['', '   ', 'ليس بريدًا', 'a@b', 'a b@c.d', '@b.co', 'a@.co'].forEach(v =>
    t('يُرفض: ' + JSON.stringify(v), !isSendableEmail(v)));
  t('و undefined لا يرمي', !isSendableEmail(undefined));
}

console.log('\n▸ اللوحة تُفتح فعلًا وتُربَط — بصمةٌ سلوكية للتفكيك كله');
// كتلةٌ غير متزامنة وحدها في الملف: فتحُ اللوحة ينتظر الجلب. والتقرير داخلها.
(async () => {
  // W3 نقلت من هذه اللوحة سبعة أجزاء. وكل التأكيدات أعلاه تفحص **القطع**؛
  // وهذا يفحص أنها ما زالت تتركّب: تُفتح اللوحة بمسارها الحقيقي، ويُحصى ما
  // رُبط فعلًا. أي معالِج يسقط في تفكيكٍ لاحق يظهر هنا بالاسم.
  //
  // ودرسٌ من بنائه: أوّل صيغةٍ لهذه البصمة أعطت «صفر مربوط» **في النسختين**،
  // فبدت المقارنة ناجحة وهي جوفاء. والسببان: `#chubPanel` يُنشئه
  // renderContractsHubBody لا index.html، و`CH_CONTRACTS` رابطةٌ داخل الوحدة
  // لا تُصدَّر فلا يصلها إسنادٌ من الخارج — تُملأ عبر `reloadContracts()`.
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://pmo.example/' });
  const W = dom.window;
  W.eval(`window.__c=${JSON.stringify({
    id: 'k1', token: 'tok', status: 'active', client_id: 'c1', source_contract_id: null,
    internal_approved: true, archived_at: null, project_id: 'p1', send_count: 0,
    amendment_count: 0, contract_name: 'عقد', contract_number: 'ALM-1',
    signatures: [], sealed_body: 'نص', org: {}, template_key: 'alamaa_v1', clause_overrides: {}
  })};
  window.supabase={createClient:()=>({
    rpc:(n)=>Promise.resolve({data:n==='pmo_all_contracts_view'?[window.__c]:[],error:null}),
    from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null}),
      eq:()=>({maybeSingle:async()=>({data:null,error:null})})})}),
    auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),
      onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
    channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>{}})}`);
  { const sc = W.document.createElement('script'); sc.textContent = bundle; W.document.body.appendChild(sc); }

  W.eval("ROLE='pmo';IS_OWNER=true;CLIENTS=[{id:'c1',name:'ش'}]");
  W.eval("document.getElementById('host').innerHTML='<div id=\"chubPanel\"></div><div id=\"contractPrint\"></div>'");
  await W.reloadContracts();
  await W.openContractDetailPanel('k1');
  await new Promise(r => setTimeout(r, 500));

  const panel = W.document.getElementById('chubPanel');
  t('اللوحة صُيِّرت لا فارغة', panel.innerHTML.length > 5000, panel.innerHTML.length + ' حرفًا');
  eq('وتبويباتها الخمسة', W.document.querySelectorAll('#chubPanel [data-pane]').length, 5);

  const bound = [...W.document.querySelectorAll('#chubPanel *')]
    .filter(el => typeof el.onclick === 'function' || typeof el.onchange === 'function')
    .map(el => el.id).filter(Boolean).sort();
  // الأسماء لا العدد: عدٌّ وحده يمرّ لو سقط معالِجان وأُضيف اثنان.
  ['chdClose', 'chdMore', 'chdSave', 'chdVoid', 'chdSendBtn', 'chdSignNow', 'chdExport',
   'chdDuplicate', 'chdArchive', 'chdUnlink', 'chdMailCheck', 'chdTemplate',
   'chdAttAdd', 'chdAttUpload'].forEach(id =>
    t('مربوط: ' + id, bound.includes(id), bound.join(',')));

  console.log(`\nنجح ${ok} · فشل ${fail}`);
  process.exit(fail ? 1 : 0);
})();

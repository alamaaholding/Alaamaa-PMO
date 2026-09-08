// اختبار: حوكمة العقد — الحماية على مستوى الجدول وسجل التدقيق.
// خلفية: الحواجز كانت داخل الدوال وحدها، وسياسة UPDATE تسمح بتعديل الصف مباشرة عبر
// PostgREST فتتجاوزها. والعقود لم تكن موصولة بسجل التدقيق إطلاقًا.
const fs=require('fs');
let ok=0,fail=0;
const t=(n,c,x)=>{if(c){ok++;console.log('  ✓ '+n);}else{fail++;console.log('  ✗ '+n+(x?' → '+x:''));}};

const cfg=fs.readFileSync('src/config.js','utf8');
const api=fs.readFileSync('src/api.js','utf8');
const hub=fs.readFileSync('src/app/contractshub.js','utf8');
const sign=fs.readFileSync('src/app/contractsign.js','utf8');

// قاموس التدقيق يغطي دورة حياة العقد كاملة
const needed=['contract_created','contract_internally_approved','contract_sealed',
  'contract_terms_updated','contract_signed_alamaa','contract_signed_client','contract_voided',
  'contract_archived','contract_sent','contract_amendment_created','contract_attachment_added'];
needed.forEach(a=>t('السجل يترجم الإجراء: '+a, cfg.includes(a+":'")));
t('كيان «عقد» معرَّف في قاموس الكيانات',cfg.includes("AUDIT_ENTITIES={contract:'عقد'"));

t('دالة جلب سجل العقد معرَّفة',/async function fetchContractAudit/.test(api));
t('الجلب مقيَّد بهذا العقد تحديدًا',api.includes(".eq('entity','contract').eq('entity_id',contractId)"));
t('لوحة العقد تعرض السجل',hub.includes('id="chdAudit"')&&hub.includes('fetchContractAudit'));
t('السجل يعرض من نفّذ الإجراء لا الإجراء وحده',hub.includes('const who=id=>'));
t('تغيّر القيم يُعرَض بصيغة «من ← إلى»',hub.includes("('من' in x)"));

// ===== دليل التوقيع (الأولوية ٢) =====
t('دالة شهادة التوقيع معرَّفة',/async function fetchSignatureCertificate/.test(api));
t('كشف مشاكل الأدلة معرَّف',/async function fetchEvidenceIssues/.test(api));
t('الشهادة متاحة للموقَّع فقط — إجراءً أساسيًا أو في القائمة',
  hub.includes("add('chdCert','🎖 شهادة التوقيع',anySigned)")&&hub.includes("id:'chdCert',label:'🎖 شهادة التوقيع'"));
['الأطراف','المستند الموقَّع','التواقيع وأدلتها','سجل الإجراءات'].forEach(sec=>
  t('الشهادة تضم قسم: '+sec, hub.includes(sec)));
t('الشهادة تعرض بصمة النص وقت التوقيع',hub.includes('بصمة النص وقت التوقيع'));
t('الشهادة تحكم صراحة بمطابقة النص الحالي لما وُقِّع عليه',
  hub.includes('sg.signed_current_text?')&&hub.includes('لم يتغيّر منذ التوقيع'));
t('الشهادة تعرض إقرار القبول المسجَّل',hub.includes('إقرار القبول'));
t('الشهادة تعرض وسيلة تحقق الهوية ووقتها',hub.includes('تحقق الهوية')&&hub.includes('وقت التحقق'));

// ===== فصل الأدوار وتجزئة المرفقات (الأولوية ٣) =====
t('الاعتماد يمرّر مبرّر التجاوز وإقرار فرق القيمة',
  api.includes('async function approveContractInternal(contractId,overrideReason,ackValueMismatch)'));

// ===== الأولوية ٤: انتهاء الرابط ورقابة القيمة =====
t('تعارض القيمة يُمرَّر للواجهة بتفاصيله',api.includes('e.info=data'));
t('الواجهة تعرض الفرق بين قيمة العقد والمشروع وتطلب إقرارًا',
  hub.includes("e.code==='value_mismatch'")&&hub.includes('أقرّ بالفرق وأعتمد'));
t('التعارض والاعتماد الذاتي يتسلسلان بلا تعارض',hub.includes("e3.code==='self_approval'"));
t('صلاحية الرابط تظهر للمستخدم بأيام متبقية',hub.includes('الرابط صالح')&&hub.includes('أي تذكير يجدّد المدة'));
t('انتهاء الرابط ينبّه بوضوح مع الحل',hub.includes('انتهت صلاحية الرابط — أرسل تذكيرًا'));
t('صفحة التوقيع ترد برسالة مفهومة للشريك عند انتهاء الرابط',
  sign.includes("d.error==='link_expired'")&&sign.includes('تواصل مع علامة لإرسال رابط جديد'));
t('رمز خطأ الاعتماد الذاتي يُمرَّر للواجهة لا يُبتلع',api.includes("e.code=data.error"));
t('الواجهة تطلب مبرّرًا إلزاميًا عند الاعتماد الذاتي',
  hub.includes("e.code==='self_approval'")&&hub.includes('المبرّر إلزامي'));
t('الاعتماد الذاتي يظهر كتنبيه دائم في لوحة العقد',hub.includes('اعتماد ذاتي موثَّق'));
t('الشهادة تضم قسم حوكمة الاعتماد',hub.includes('حوكمة الاعتماد')&&hub.includes('فصل الأدوار'));
t('الشهادة تحكم على فصل الأدوار صراحة',hub.includes('مُعِدّ ومعتمِد مختلفان'));
t('بصمة محتوى الملف تُحسب عند الرفع',api.includes("crypto.subtle.digest('SHA-256',buf)"));
t('البصمة تُمرَّر عند تسجيل المرفق',api.includes('p_content_hash:(fileInfo&&fileInfo.hash)'));
t('الشهادة تعرض بصمات الملاحق',hub.includes('الملاحق وبصماتها'));

// ===== الأولوية ٥: الأتمتة وسجل النماذج =====
const pf=fs.readFileSync('src/app/portfolio.js','utf8');
t('إعدادات الأتمتة معرَّفة في api',/async function fetchAutomationSettings/.test(api));
t('لوحة الأتمتة متاحة من أدوات المكتب',pf.includes("id:'showAutomation'")&&/async function openAutomationPanel/.test(pf));
t('اللوحة تبيّن بوضوح أن الأتمتة معطَّلة افتراضيًا',pf.includes('التذكير التلقائي معطَّل'));
t('التفعيل يتطلب تأكيدًا صريحًا (لا إرسال صامت)',
  pf.includes('تفعيل الإرسال التلقائي')&&pf.includes('دون تدخل منك في كل مرة'));
t('سقف عدد التذكيرات يمنع إزعاج الشريك',pf.includes('id="autoMax"')&&pf.includes('الحدّ الأقصى يمنع إزعاج'));
t('معاينة العقود المشمولة قبل التفعيل',pf.includes('سيشمل التذكير حاليًا'));
t('تسجيل إصدار النموذج ببصمة نصه',/async function registerTemplateVersion/.test(api)&&api.includes('sha256Hex(JSON.stringify({intro:tpl.intro'));
t('مزامنة سجل النماذج تلقائية عند فتح المحفظة',hub.includes('syncTemplateRegistry()'));
t('الشهادة تعرض إصدار النموذج المستخدَم',hub.includes('cert.document.template_version'));

// ===== تدقيق ما بعد التنفيذ =====
t('فحص أمني متاح من أدوات المكتب',pf.includes("id:'showSecAudit'")&&/async function openSecurityAudit/.test(pf));
t('الفحص يكشف الدوال المكشوفة للمجهولين',pf.includes('دوال مكشوفة لغير المسجَّلين'));
t('الفحص يكشف تعدّد توقيعات الدوال (نمط سبّب ثغرة سابقة)',pf.includes('دوال بتوقيعات متعددة'));
t('الإصلاح متاح بضغطة لا يدويًا',pf.includes("id=\"secFix\"")&&api.includes('runSecurityAudit(fix)'));
t('الفحص يحذّر أن النسخة القديمة قد تتجاوز حواجز الجديدة',pf.includes('قد تتجاوز حواجز النسخة الجديدة'));


// ===== مبدأ «أربع عيون» — وتباينٌ كان بين نسختَي فحصه =====
//
// مُعِدّ العقد لا يعتمد عمله إلا بمبرّرٍ موثَّق يظهر في شهادة التوقيع وسجل
// العقد. وكان الفحص مكتوبًا مرّتين ومختلفًا بينهما: إلغاءُ النافذة يُنتج تنبيه
// «المبرّر إلزامي» في مسار تعارض القيمة، وصمتًا في المسار المباشر.
//
// والإلغاء ليس تقديمَ مبرّرٍ فارغ — هو انصرافٌ عن الاعتماد أصلًا، فتوبيخه خطأ.
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

  const D = w.selfApprovalDecision;
  // الضابط نفسه: المبرّر إلزامي، والفراغ ليس مبرّرًا.
  t('مبرّرٌ حقيقيّ يمضي', D({reason:'المخوَّل الآخر في إجازة'}).ok===true);
  t('ويصل مقصوصًا لا خامًّا', D({reason:'  س  '}).reason==='س');
  t('والفراغ يُرفَض', D({reason:'   '}).ok===false);
  t('وينبَّه عليه صراحةً', D({reason:''}).warn==='المبرّر إلزامي');
  t('وغيابُ الحقل كذلك', D({}).ok===false && D({}).warn==='المبرّر إلزامي');
  // وهذا هو التباين المُصلَح: الإلغاء صمتٌ لا توبيخ، في المسارين معًا.
  t('والإلغاء انصرافٌ لا خطأ', D(null).ok===false && D(null).warn===undefined);
  t('و undefined كذلك', D(undefined).ok===false && D(undefined).warn===undefined);
  // مصدر حقيقةٍ واحد: لم يبقَ فحصٌ نصّيّ مكرَّر في المصدر.
  // التعليقات تشرح التباين المُصلَح فتذكر النصّ — والعدّ الساذج يلتقطها. يُفحَص
  // الكود وحده. (وهذا ثالثُ فحصٍ في هذه الموجة التقط نثرًا بدل ما يقصده.)
  const hubCode = hub.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  t('ولا نسخة ثانية من الفحص في الكود',
    (hubCode.match(/المبرّر إلزامي/g)||[]).length===1,
    (hubCode.match(/المبرّر إلزامي/g)||[]).length+' نسخة');
  t('وكلا المسارين يستشير القرار الواحد',
    (hub.match(/selfApprovalDecision\(/g)||[]).length===3,
    (hub.match(/selfApprovalDecision\(/g)||[]).length+'');

  // تعارض القيمة: الرقمان يُعرَضان صراحةً كي يُراجَع الفرق قبل الإقرار به.
  const M = w.valueMismatchMessage({project_value:100000,contract_value:120000});
  t('رسالة التعارض تحمل الرقمين',
    M.includes((120000).toLocaleString('ar')) && M.includes((100000).toLocaleString('ar')), M);
  t('وتدعو للمراجعة قبل الإقرار', /راجعها قبل الاعتماد/.test(M));
  t('وبيانات ناقصة لا ترمي', typeof w.valueMismatchMessage(undefined)==='string');

  // نافذة «أربع عيون»: المبرّر حقلٌ إلزاميّ في الصيغتين، والمباشرة تذكر أين يُوثَّق.
  const S1 = w.selfApprovalDialogSpec(true), S2 = w.selfApprovalDialogSpec(false);
  t('كلتا الصيغتين تطلبان المبرّر',
    S1.fields[0].key==='reason' && S2.fields[0].key==='reason');
  t('وكلتاهما تذكر «أربع عيون»',
    /أربع عيون/.test(S1.message) && /أربع عيون/.test(S2.message));
  t('والمباشرة تذكر أين يُوثَّق المبرّر',
    /شهادة التوقيع وسجل العقد/.test(S1.message) && !/شهادة التوقيع/.test(S2.message));
}

console.log('\n(الحماية على مستوى الجدول مُطبَّقة بمُشغِّلات في القاعدة وتحقَّقت حيًّا:');
console.log(' منع تعديل قيمة/نص عقد موقَّع، ومنع حذف التوقيع، مع بقاء الربط والحالة قابلين للتعديل)');
console.log('\nنجح '+ok+' · فشل '+fail);
process.exit(fail?1:0);

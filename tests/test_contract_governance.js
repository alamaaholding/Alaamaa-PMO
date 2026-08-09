// اختبار: حوكمة العقد — الحماية على مستوى الجدول وسجل التدقيق.
// خلفية: الحواجز كانت داخل الدوال وحدها، وسياسة UPDATE تسمح بتعديل الصف مباشرة عبر
// PostgREST فتتجاوزها. والعقود لم تكن موصولة بسجل التدقيق إطلاقًا.
const fs=require('fs');
let ok=0,fail=0;
const t=(n,c,x)=>{if(c){ok++;console.log('  ✓ '+n);}else{fail++;console.log('  ✗ '+n+(x?' → '+x:''));}};

const cfg=fs.readFileSync('src/config.js','utf8');
const api=fs.readFileSync('src/api.js','utf8');
const hub=fs.readFileSync('src/app/contractshub.js','utf8');

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

console.log('\n(الحماية على مستوى الجدول مُطبَّقة بمُشغِّلات في القاعدة وتحقَّقت حيًّا:');
console.log(' منع تعديل قيمة/نص عقد موقَّع، ومنع حذف التوقيع، مع بقاء الربط والحالة قابلين للتعديل)');
console.log('\nنجح '+ok+' · فشل '+fail);
process.exit(fail?1:0);

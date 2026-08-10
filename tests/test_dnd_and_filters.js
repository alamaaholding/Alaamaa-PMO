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

// ===== فلترة العقود =====
['client','link','type','sort'].forEach(k=>t('فلتر متاح: '+k, hub.includes("CH_FILTER."+k)));
t('فلترة بحسب الارتباط بمشروع',hub.includes("CH_FILTER.link==='linked'")&&hub.includes("CH_FILTER.link==='unlinked'"));
t('فلترة الأصول (القوالب) والملاحق',hub.includes("CH_FILTER.link==='template'")&&hub.includes("CH_FILTER.link==='amendment'"));
t('فرز بالقيمة وبقرب الانتهاء',hub.includes("CH_FILTER.sort==='value'")&&hub.includes("CH_FILTER.sort==='ending'"));
t('البحث يشمل اسم العقد ورقمه والشريك والمشروع',
  hub.includes('[c.contract_name,c.contract_number,c.client_name,c.project_name]'));
t('مؤشرات سريعة تُحسب من المعروض فعليًا',hub.includes('const totalValue=filtered.reduce'));
t('زر مسح الفلاتر يظهر عند وجود فلتر نشط',hub.includes('id="chubReset"'));

console.log('\nنجح '+ok+' · فشل '+fail);
process.exit(fail?1:0);

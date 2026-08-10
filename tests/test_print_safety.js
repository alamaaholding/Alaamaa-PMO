// اختبار: سلامة الطباعة والتصدير.
// خلفية: window.print() كان يُستدعى فجأة بلا سياق، والاستعادة معلَّقة على afterprint وحده —
// فإن لم يُطلقه المتصفح يبقى التطبيق في وضع الطباعة (أو الجانت مصغَّرًا) ويبدو معطّلًا.
const fs=require('fs');
let ok=0,fail=0;
const t=(n,c,x)=>{if(c){ok++;console.log('  ✓ '+n);}else{fail++;console.log('  ✗ '+n+(x?' → '+x:''));}};
const exp=fs.readFileSync('src/app/exportcontract.js','utf8');
const hub=fs.readFileSync('src/app/contractshub.js','utf8');
const main=fs.readFileSync('src/app/main.js','utf8');

// استعادة مضمونة بثلاثة مسارات مستقلة
t('مُشغِّل طباعة آمن مشترك',/function runPrintSafely\(\)/.test(exp));
t('استعادة عبر afterprint',exp.includes("window.addEventListener('afterprint',restore)"));
t('استعادة عبر focus إن لم يُطلق afterprint',exp.includes("window.addEventListener('focus',restore)"));
t('شبكة أمان زمنية أخيرة',exp.includes('setTimeout(restore,60000)'));
t('حارس يمنع الاستعادة المزدوجة',exp.includes('if(done)return;done=true'));
t('فشل الطباعة نفسه يستعيد الحالة',exp.includes('catch(e){restore();}'));

// تطبيقه في كل المواضع
t('تصدير العقد يستخدم المُشغِّل الآمن',exp.includes('runPrintSafely();'));
t('شهادة التوقيع تستخدمه',hub.includes('runPrintSafely();'));
t('لا استدعاء مباشر متبقٍّ في العقود',!/window\.print\(\);/.test(hub));
t('طباعة الجانت محمية أيضًا',main.includes('window.addEventListener(\'focus\',restore)')&&main.includes('clearTimeout(guard)'));
t('الجانت يستعيد مستوى التكبير الأصلي',main.includes('PX=prevPX;render();'));

// حوار تمهيدي بدل مفاجأة حوار المتصفح
t('حوار يشرح ما سيُنتَج قبل التصدير',hub.includes('سيتضمّن المستند'));
t('يوجّه صراحة لخيار حفظ PDF',hub.includes('حفظ بصيغة PDF'));
t('يعدّد محتويات المستند ديناميكيًا لا نصًّا ثابتًا',hub.includes("const parts=['متن العقد الكامل']"));
t('ملحق الخطة يُذكر فقط إن وُجد',hub.includes("if(c.baseline_id)parts.push('ملحق الخطة المعتمدة')"));
t('الشهادة لها حوار تمهيدي يعدّد أدلتها',hub.includes('تتضمّن الشهادة'));
t('إلغاء الحوار يوقف التصدير',hub.includes('if(!ok)return;')&&hub.includes('if(!okc)return;'));

console.log('\nنجح '+ok+' · فشل '+fail);
process.exit(fail?1:0);

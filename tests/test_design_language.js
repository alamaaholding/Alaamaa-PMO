// اختبار: مرجع لغة التصميم موجود ويعكس الأنماط المطبَّقة فعليًا — لا وثيقة تتقادم بصمت.
// كل نمط موثَّق يجب أن يكون له أثر حقيقي في الكود، وإلا صار المرجع مضلِّلًا.
const fs=require('fs');
let ok=0,fail=0;
const t=(n,c,x)=>{if(c){ok++;console.log('  ✓ '+n);}else{fail++;console.log('  ✗ '+n+(x?' → '+x:''));}};
if(!fs.existsSync('DESIGN.md')){console.log('  ✗ DESIGN.md مفقود');console.log('\nنجح 0 · فشل 1');process.exit(1);}
const d=fs.readFileSync('DESIGN.md','utf8');
const hub=fs.readFileSync('src/app/contractshub.js','utf8');
const pf=fs.readFileSync('src/app/portfolio.js','utf8');
const exp=fs.readFileSync('src/app/exportcontract.js','utf8');
const wl=fs.readFileSync('src/app/workload.js','utf8');
const es=fs.readFileSync('src/emptystate.js','utf8');   // انتقل المكوّن من views.js في W2

// كل نمط موثَّق له أثر في الكود
const patterns=[
 ['الإجراء الأساسي الواحد','STAGE={primary:null',hub],
 ['شريط المرحلة الواحد','chub-stage-notes',hub],
 ['صف يجيب ثلاثة أسئلة','function rowStage(c)',hub],
 ['الحالة الفارغة الموجّهة','function emptyState(o)',es],
 ['التبويبات تفصل القراءة عن التحرير','data-pane="overview"',hub],
 ['القوائم الطويلة تُجمَّع','tools-grp-h',pf],
 ['الأتمتة معطَّلة افتراضيًا','تفعيل الإرسال التلقائي',pf],
 ['الطباعة بثلاثة مسارات استعادة','function runPrintSafely()',exp],
 ['مصدر حقيقة واحد للجدولة','scheduleTasks(tasks,p.start_date)',wl],
];
patterns.forEach(([name,marker,src])=>{
  t('موثَّق: '+name, d.includes(name.split(' ')[0]));
  t('  ومطبَّق فعلًا في الكود', src.includes(marker));
});

// المرجع يفسّر سبب النشأة لا القاعدة فقط — وإلا لم يمنع تكرار الخطأ
t('يوثّق أسباب النشأة من مشاكل حقيقية',(d.match(/سبب النشأة/g)||[]).length>=5);
t('يحذّر من فخ create or replace بتوقيع مختلف',d.includes('يُنشئ دالة جديدة ولا يستبدل القديمة'));
t('يوثّق قاعدة الحماية في أدنى طبقة',d.includes('الحارس في القاعدة لا في الدالة وحدها'));
t('يوثّق منهج الاختبار والتحقق',d.includes('بوابة تحقق بعد كل خطوة'));
t('يوثّق الدرس المنهجي في القياس',d.includes('القياس الخام بلا تفكيك'));
t('يوثّق التمييز بين نوعَي الحالة الفارغة',d.includes('لا نتائج لهذا الفلتر'));
t('يوثّق إتاحة الوصول كشرط لا خيار',d.includes('إتاحة الوصول ليست اختيارية'));

console.log('\nنجح '+ok+' · فشل '+fail);
process.exit(fail?1:0);

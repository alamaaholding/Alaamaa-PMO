// اختبار: إعادة تصميم لوحة العقد — إجراء أساسي واحد بحسب المرحلة، شريط حالة موحّد،
// وباقي الإجراءات في قائمة. خلفية: كان الرأس يعرض 9 أزرار متساوية الوزن وخمسة شرائط
// متنافسة، فلا يعرف المستخدم ما يفعله الآن.
const fs=require('fs');
let ok=0,fail=0;
const t=(n,c,x)=>{if(c){ok++;console.log('  ✓ '+n);}else{fail++;console.log('  ✗ '+n+(x?' → '+x:''));}};
const hub=fs.readFileSync('src/app/contractshub.js','utf8');
const css=fs.readFileSync('src/styles.css','utf8');

t('مصدر واحد يحدّد المرحلة والإجراء',hub.includes('const STAGE={primary:null'));

// كل حالة لها مرحلة وإجراء أساسي صحيح
const stages=[
  ['ملغى',"c.status==='void'",'عقد ملغى',null],
  ['مؤرشف',"c.archived_at",'عقد مؤرشف','chdUnarchive'],
  ['بانتظار الاعتماد',"!c.internal_approved&&!anySigned",'بانتظار الاعتماد الداخلي','chdApprove'],
  ['أصل معتمَد',"isTemplate",'عقد أصل (قالب) معتمَد','chdAssign'],
  ['بانتظار علامة',"!al",'بانتظار توقيع علامة','chdSignNow'],
  ['بانتظار الشريك',"!cl",'بانتظار توقيع الشريك',null],
  ['موقَّع',null,'موقَّع بالكامل','chdCert']
];
stages.forEach(([name,,title,primary])=>{
  t('مرحلة معرَّفة: '+name, hub.includes(title));
  if(primary)t('  إجراؤها الأساسي: '+primary, hub.includes("id:'"+primary+"'"));
});

t('كل مرحلة تشرح الخطوة التالية لا الحالة فقط',hub.includes('STAGE.hint='));
t('الإجراء الأساسي لا يتكرر في القائمة الثانوية',
  hub.includes("if(when&&(!STAGE.primary||STAGE.primary.id!==id))"));
t('قائمة ⋯ تُخفى تمامًا إن لم يكن فيها شيء',hub.includes("if(!STAGE.secondary.length)mb.style.display='none'"));
t('القائمة تُغلق بالنقر خارجها وبعد اختيار إجراء',
  hub.includes("document.addEventListener('click',close)")&&hub.includes("b.addEventListener('click',close)"));
t('القائمة تحمل سمات وصول صحيحة',hub.includes('aria-haspopup')&&hub.includes('aria-expanded'));

// الشرائط الخمسة صارت شريطًا واحدًا بملاحظات
t('شريط حالة واحد بدل خمسة متنافسة',hub.includes('class="chub-stage ${STAGE.tone}"'));
t('الملاحظات تُدمج في الشريط لا تُعرض شرائط منفصلة',hub.includes('chub-stage-notes'));
['wait','go','done','info','void','muted'].forEach(tone=>
  t('نبرة بصرية للمرحلة: '+tone, css.includes('.chub-stage.'+tone+'{')));

// لا تكرار للأزرار بين الرأس والمتن
t('زر الإلغاء لم يعد مكرَّرًا في المتن',(hub.match(/id="chdVoid"/g)||[]).length===0);
t('زر التصدير لم يعد مكرَّرًا في المتن',(hub.match(/id="chdExport"/g)||[]).length===0);

t('الرأس يستجيب للجوال',css.includes('.chub-hd-actions{width:100%'));
t('الإجراء الأساسي بارز بصريًا',css.includes('.chub-primary{font-weight:800'));

// ===== المرحلة ٣+٤: التبويبات وترتيب الاستخدام =====
['overview','terms','attach','send','log'].forEach(k=>
  t('تبويب معرَّف: '+k, hub.includes("data-pane=\""+k+"\"")));
t('التبويب الافتراضي يتبع المرحلة لا ترتيبًا ثابتًا',
  hub.includes("CHD_TAB = (!c.internal_approved&&!anySigned&&editable) ? 'terms'"));
t('عقد بانتظار التوقيع يفتح على تبويب الإرسال مباشرة',hub.includes("? 'send'"));
t('التبديل بلا إعادة بناء — يحفظ حالة الحقول والمعاينة',
  hub.includes("panel.querySelectorAll('.chub-pane').forEach")&&!hub.includes('CHD_TAB=b.dataset.chdtab;renderContract'));
t('الحفظ يُعيد الفتح على نفس التبويب لا يقفز للبداية',hub.includes('openContractDetailPanel(contractId,true)'));
t('المعاينة صعدت للواجهة (نظرة عامة) بدل قاع الصفحة',
  hub.indexOf('data-pane="overview"')<hub.indexOf('data-pane="log"'));
t('السجل انتقل لآخر تبويب (مرجع نادر الاستخدام)',
  hub.indexOf('data-pane="log"')>hub.indexOf('data-pane="attach"'));
t('نص العقد معنون بما يراه الشريك لا بوصف تقني',hub.includes('نص العقد كما سيراه الشريك'));
t('التبويبات بسمات وصول',hub.includes('role="tablist"')&&hub.includes('role="tab"'));
t('نسخ الأصل تبقى ظاهرة خارج التبويبات (سياق دائم)',
  hub.indexOf('id="chdInstances"')<hub.indexOf('class="chub-tabs"'));

console.log('\nنجح '+ok+' · فشل '+fail);
process.exit(fail?1:0);

// اختبار: جدول MS Project مصدر الحقيقة الوحيد — كل حقول الخطة تُحرَّر منه عبر مسار كتابة واحد.
// خلفية: كان يعرض 12 عمودًا و5 فقط قابلة للتحرير؛ المخرج وتاريخ البداية عرضًا ثابتًا.
const fs=require('fs');
let ok=0,fail=0;
const t=(n,c,x)=>{if(c){ok++;console.log('  ✓ '+n);}else{fail++;console.log('  ✗ '+n+(x?' → '+x:''));}};
const v=fs.readFileSync('src/views.js','utf8');
const api=fs.readFileSync('src/api.js','utf8');
const eng=fs.readFileSync('src/engine.js','utf8');

// الحقول القابلة للتحرير من الجدول
['name','type','duration','status','progress','deliverable','fixedDate'].forEach(f=>
  t('حقل قابل للتحرير من الجدول: '+f, v.includes('data-f="'+f+'"')));

t('مسار كتابة واحد لكل الحقول',v.includes('const map={duration:')&&v.includes('updateTaskFields(t._dbId,patch)'));
t('الخريطة تغطي كل الحقول المحرَّرة',
  ['deliverable','fixedDate','track','owner'].every(f=>v.includes(f+":'")||v.includes(f+':')));

// دلالة التثبيت صحيحة — أخطر نقطة
t('التاريخ يُخزَّن في fixed_date لا حقل مخترع',v.includes("fixedDate:'fixed_date'"));
t('المحرك يقرأ fixedDate للنوع «ثابت»',eng.includes("t.type==='fixed'&&t.fixedDate"));
t('تحديد تاريخ يحوّل النوع لـ«ثابت» تلقائيًا',v.includes("if(val&&t.type!=='fixed'){patch.type='fixed'"));
t('مسح التاريخ يعيد النوع لمهمة',v.includes("else if(!val&&t.type==='fixed'){patch.type='task'"));
t('المستخدم يُبلَّغ بأثر التثبيت لا يُترك يخمّن',v.includes('لن تتغيّر بإعادة الجدولة'));
t('البند المثبَّت مميَّز بصريًا',v.includes("t.type==='fixed'?'pinned':''"));
t('التاريخ المحسوب يبقى ظاهرًا بجانب المُدخَل',v.includes('class="dt-calc"'));

// حماية من التحرير غير المناسب
t('الحزم والمستمر لا يقبلان تاريخ بداية',v.includes("t.type!=='cont'&&t.type!=='package'"));
t('التحرير البنيوي محكوم بالصلاحية',v.includes("editStruct?'':'disabled'"));

// التبعيات تُدار من الجدول
t('التبعيات قابلة للتحرير من الجدول',v.includes('data-deps='));
t('النقل بين الحزم من الجدول (سحب وإفلات)',v.includes('data-dragtask=')&&api.includes('async function moveTask'));

console.log('\nنجح '+ok+' · فشل '+fail);
process.exit(fail?1:0);

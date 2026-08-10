// اختبار: إشارات الجانت — التأخير والمسار الحرج يظهران معًا بلا تنافس، وزر ثلاثي الحالات.
// خلفية: كان .gbar.late و.gbar.crit يستخدمان box-shadow نفسه، فالبند المتأخر والحرج معًا
// يُظهر إشارة واحدة فقط — أي أن أخطر حالة (حرج ومتأخر) كانت الأقل وضوحًا.
const fs=require('fs');
let ok=0,fail=0;
const t=(n,c,x)=>{if(c){ok++;console.log('  ✓ '+n);}else{fail++;console.log('  ✗ '+n+(x?' → '+x:''));}};
const css=fs.readFileSync('src/styles.css','utf8');
const v=fs.readFileSync('src/views.js','utf8');

t('التأخير نمط مخطَّط داخل الشريط لا حدًّا فقط',css.includes('.gbar.late::after')&&css.includes('repeating-linear-gradient(135deg'));
t('التأخير والحرج معًا يظهران بإشارتين مستقلتين',css.includes('.gbar.late.crit{box-shadow:inset 0 0 0 2px currentColor,0 0 0 2px var(--crit)'));
t('لون التأخير يميّز مسؤوليته (شريك/علامة)',css.includes('.gbar.late-client{color:var(--crit)}')&&css.includes('.gbar.late-alamah{color:var(--blue)}'));

t('حالة المسار الحرج ثلاثية',v.includes("GCRIT==='normal'?'focus':(GCRIT==='focus'?'hidden':'normal')"));
t('الحالة تُحفَظ بين الجلسات',v.includes("localStorage.setItem('pmo_gcrit',GCRIT)"));
t('وضع الإبراز يخفت ما ليس حرجًا',css.includes('.gantt.crit-focus .gbar:not(.crit)'));
t('وضع الإبراز يشمل المعالم والحزم لا الأشرطة فقط',
  css.includes('.gantt.crit-focus .gmile:not(.crit)')&&css.includes('.gantt.crit-focus .gpkg:not(.crit)'));
t('وضع الإخفاء يزيل تمييز الحرج',css.includes('.gantt.crit-hidden .gbar.crit'));
t('الزر يعكس الحالة نصًّا لا لونًا فقط',v.includes("LBL={normal:'◆ حرج',focus:'◆ حرج (مُبرَز)',hidden:'◇ حرج (مخفي)'}"));

t('مفتاح ألوان يشرح كل إشارة',css.includes('.g-legend{')&&v.includes('متأخر — على الشريك')&&v.includes('متأخر — على علامة'));
t('عدّاد فوري للمتأخرات والحرجة',v.includes('const lateN=visibleTasks()')&&v.includes('const critN=visibleTasks()'));
t('العدّاد يستثني المكتملة من التأخير',v.includes("k&&k.delay&&t.status!=='done'"));
t('العدّاد يحمر عند وجود تأخير',v.includes("lateN?'var(--crit)':'var(--muted)'"));

console.log('\nنجح '+ok+' · فشل '+fail);
process.exit(fail?1:0);

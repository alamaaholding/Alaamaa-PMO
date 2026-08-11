// اختبار: الحالات الفارغة الموجّهة وإتاحة الوصول عبر المنصة.
// خلفية: 19 حالة فارغة كانت نصوصًا جافة تُخبر ولا توجّه («لا تنبيهات.»)، وشاشة الشريك —
// وهي التي يراها العميل — كانت تحوي وصف وصول واحدًا فقط.
const fs=require('fs');const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8').replace(/<script[^>]*src=[^>]*><\/script>/g,'');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://pmo.alaamaa.com/'});
const w=dom.window;
const run=c=>{const s=w.document.createElement('script');s.textContent=c;w.document.body.appendChild(s);};
run(`window.supabase={createClient:()=>({rpc:()=>Promise.resolve({data:[],error:null}),
 from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null}),eq:()=>({maybeSingle:async()=>({data:null,error:null})})})}),
 auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
 channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:()=>{}})};`);
run(fs.readFileSync('app.bundle.js','utf8'));
run(`
const ul=document.createElement('ul');
ul.innerHTML=emptyState({wrap:'li',icon:'👍',title:'لا تنبيهات',hint:'المشروع على المسار.'});
const d=document.createElement('div');
d.innerHTML=emptyState({icon:'🚩',title:'لا معالم',hint:'لم تُحدَّد بعد.'});
window.__R=[];
const t=(n,c)=>window.__R.push([n,!!c]);
t('داخل القائمة يُصيَّر li فلا تنكسر بنية ul',ul.firstElementChild.tagName==='LI');
t('خارجها يُصيَّر div',d.firstElementChild.tagName==='DIV');
t('يعرض عنوانًا واضحًا',ul.querySelector('b')!==null);
t('يعرض إرشادًا لا عنوانًا فقط',ul.querySelector('.empty-state-hint')!==null);
t('الأيقونة الزخرفية مخفية عن قارئات الشاشة',
  ul.querySelector('.empty-state-icon').getAttribute('aria-hidden')==='true');
t('النص يُهرَّب فلا يُحقَن HTML',emptyState({title:'<img src=x>'}).includes('&lt;img'));
t('يعمل بلا أي معطيات',typeof emptyState()==='string'&&emptyState().includes('لا شيء هنا بعد'));
`);
setTimeout(()=>{
 const v=fs.readFileSync('src/views.js','utf8');
 const ch=fs.readFileSync('src/app/clienthome.js','utf8');
 const extra=[
  ['مكوّن مشترك للحالة الفارغة',/function emptyState\(o\)/.test(v)],
  ['حالات لوحة القيادة موجّهة',['لا مهام مجدولة اليوم','لا مهام هذا الأسبوع','لا متطلبات معلّقة','لا تنبيهات','لا معالم قادمة'].every(x=>v.includes(x))],
  ['كل حالة تشرح السبب لا الحالة فقط',v.includes('المشروع على المسار')&&v.includes('لا شيء يعطّل التنفيذ')],
  ['شاشة الشريك: حالة فارغة موجّهة بدل «لا خطط بعد»',ch.includes('لا خطط لهذا الشريك بعد')&&!ch.includes('لا خطط بعد.')],
  ['شاشة الشريك: بطاقات المشاريع موصوفة',ch.includes('aria-label="فتح مشروع')],
  ['شاشة الشريك: أزرار الرأس موصوفة',ch.includes('aria-label="العودة للمحفظة"')&&ch.includes('aria-label="إعدادات الشريك"')],
  ['أزرار تكبير/تصغير الجانت موصوفة',v.includes('aria-label="تكبير المخطط"')&&v.includes('aria-label="تصغير المخطط"')],
  ['زر الرد يوضّح على أي تعليق',v.includes('aria-label="الرد على تعليق')],
 ];
 let ok=0,fail=0;
 [...w.__R,...extra.map(([n,c])=>[n,c])].forEach(([n,c])=>{
  if(c){ok++;console.log('  ✓ '+n);}else{fail++;console.log('  ✗ '+n);}});
 console.log('\nنجح '+ok+' · فشل '+fail);
 process.exit(fail?1:0);
},400);

// اختبار: بيانات الطرفين حيّة قبل التوقيع، مجمَّدة بعده.
// خلفية: كان التجميد يحدث لحظة الإنشاء، فتصحيح خطأ في بيانات علامة لا ينعكس على أي عقد
// قائم ولو كان مسوّدة لم يوقّعها أحد. الصواب: التجميد لحظة أول توقيع لا لحظة الإنشاء.
const fs=require('fs');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8').replace(/<script[^>]*src=[^>]*><\/script>/g,'');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://pmo.alaamaa.com/'});
const w=dom.window;
const run=c=>{const s=w.document.createElement('script');s.textContent=c;w.document.body.appendChild(s);};
run(`window.supabase={createClient:()=>({rpc:()=>Promise.resolve({data:[],error:null}),
  from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null}),
    eq:()=>({maybeSingle:async()=>({data:null,error:null})})})}),
  auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),
    onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:()=>{}})};`);
run(fs.readFileSync('app.bundle.js','utf8'));
run(`
window.__R=[];const t=(n,c,x)=>window.__R.push([n,!!c,x||'']);
// بيانات علامة تصل من الخادم ضمن العقد — العارض يستخدمها كما هي
const m1=mergeContract({clientName:'سنام',org:{legal_name:'علامة',cr_number:'1010',vat_number:'300',
  national_address:'الرياض',rep_name:'صهيب',rep_title:'مدير',contact_email:'a@b.com',contact_phone:'059'}});
const nameRow=m1.partyRows.find(r=>r[0]==='الاسم');
t('اسم علامة يُقرأ من بيانات الخادم لا من ثابت في الكود',nameRow[1]==='علامة');
t('السجل التجاري لعلامة يظهر',m1.partyRows.find(r=>r[0]==='السجل التجاري')[1]==='1010');
t('الرقم الضريبي لعلامة يظهر',m1.partyRows.find(r=>r[0]==='الرقم الضريبي')[1]==='300');
t('الممثل المفوَّض بصفته يظهر مدموجًا',m1.partyRows.find(r=>r[0]==='الممثل المفوَّض')[1]==='صهيب — مدير');
t('البريد والجوال في صفّين منفصلين',
  m1.partyRows.find(r=>r[0]==='البريد الإلكتروني')[1]==='a@b.com'&&
  m1.partyRows.find(r=>r[0]==='رقم الجوال')[1]==='059');

// تغيير بيانات علامة ينعكس فورًا (محاكاة عقد غير موقَّع يتلقّى البيانات الحيّة)
const m2=mergeContract({clientName:'سنام',org:{legal_name:'علامة القابضة',cr_number:'2020'}});
t('تغيير اسم علامة ينعكس في جدول الأطراف فورًا',
  m2.partyRows.find(r=>r[0]==='الاسم')[1]==='علامة القابضة');
t('تغيير السجل التجاري ينعكس أيضًا',m2.partyRows.find(r=>r[0]==='السجل التجاري')[1]==='2020');

// بلا بيانات علامة إطلاقًا: لا ينكسر، ويعرض علامة الافتراضية وشُرَط للباقي
const m3=mergeContract({clientName:'سنام'});
t('بلا ملف علامة: الاسم الافتراضي «علامة» بلا انكسار',m3.partyRows.find(r=>r[0]==='الاسم')[1]==='علامة');
t('بلا ملف علامة: الحقول الناقصة تظهر كشرطة لا كـundefined',
  m3.partyRows.find(r=>r[0]==='السجل التجاري')[1]==='—');
`);
setTimeout(()=>{
  const hub=fs.readFileSync('src/app/contractshub.js','utf8');
  const extra=[
    ['ملاحظة تُعلم المستخدم أن البيانات حيّة قبل التوقيع',hub.includes('🔄 بيانات الطرفين حيّة — تُجمَّد عند أول توقيع')],
    ['ملاحظة تُعلمه أنها مجمَّدة بعد التوقيع',hub.includes('🔒 بيانات الطرفين مجمَّدة كما وُقِّع عليها')],
    ['الملاحظتان متنافيتان — لا تظهران معًا (كان هناك تكرار قبل التوحيد)',
      hub.includes("STAGE.notes.push(anySigned")],
  ];
  let ok=0,fail=0;
  [...w.__R,...extra.map(([n,c])=>[n,c,''])].forEach(([n,c,x])=>{
    if(c){ok++;console.log('  ✓ '+n);}else{fail++;console.log('  ✗ '+n+(x?' → '+x:''));}});
  console.log(`\nنجح ${ok} · فشل ${fail}`);
  process.exit(fail?1:0);
},100);

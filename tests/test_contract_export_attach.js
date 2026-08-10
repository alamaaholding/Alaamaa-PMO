// اختبار: إصلاح التصدير المستقل (كان يفشل تمامًا من محفظة العقود)، المرفقات، تكرار العقد،
// واكتمال حقول الملف التعاقدي المطلوبة فعليًا لتعبئة العقد تلقائيًا.
const fs=require('fs');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8').replace(/<script[^>]*src=[^>]*><\/script>/g,'');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://pmo.alaamaa.com/'});
const w=dom.window;
const run=c=>{const s=w.document.createElement('script');s.textContent=c;w.document.body.appendChild(s);};

run(`
window.__RPC=[];
window.supabase={createClient:()=>({
  rpc:(name,args)=>{window.__RPC.push({name,args});return window.__RPCHandler?window.__RPCHandler(name,args):Promise.resolve({data:{ok:true},error:null});},
  from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null})})}),
  auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:()=>{}
})};`);
run(fs.readFileSync('app.bundle.js','utf8'));

run(`
window.__R=[];
const t=(n,c,x)=>window.__R.push([n,!!c,x||'']);
toast=()=>{};ROLE='pmo';window.print=()=>{window.__printed=true;};
window.qrcode=()=>({addData(){},make(){},createDataURL:()=>'data:image/gif;base64,FAKE=='});
window.loadScript=async()=>{};

(async()=>{
  // ===== ١) الرقم الضريبي يظهر في جدول أطراف العقد (كان يُجمَع ويُخزَّن بلا استخدام) =====
  const merged=mergeContract({clientName:'ثبات',clientCr:'1010',clientVat:'300123456700003',includesAdSpend:false});
  t('الرقم الضريبي مُدمَج في جدول الأطراف',
    merged.partyRows.some(r=>r[2]&&r[2].includes('300123456700003')));
  t('صف الرقم الضريبي معنوَن صراحة',merged.partyRows.some(r=>r[0]==='الرقم الضريبي'));

  // ===== ٢) التصدير المستقل: يعمل بلا مشروع محمَّل وبلا لقطة إطلاقًا (كان يفشل فورًا) =====
  PROJECT=null; CID=null; CLIENTS=[];
  window.__printed=false;
  const contractNoBaseline={
    id:'c1',token:'tok1',contract_type:'standard',contract_name:'عقد اختبار',contract_number:'C-2026-9001',
    client_name:'ثبات',client_cr:'1010',client_vat:'300',client_address:null,client_rep_name:'محمد',
    client_rep_title:null,client_contact_email:null,client_contact_phone:null,
    includes_ad_spend:false,effective_date:'2026-01-01',contract_value:50000,late_payment_cap:1500,
    special_terms:null,baseline_id:null,project_name:null
  };
  await buildContractDoc(null,contractNoBaseline,[]);
  await new Promise(r=>setTimeout(r,250));
  const out=document.getElementById('contractPrint').innerHTML;
  t('التصدير ينجح بلا مشروع محمَّل وبلا لقطة — لا يخرج برسالة خطأ',out.length>500);
  t('اسم العقد ورقمه يظهران في الغلاف',out.includes('عقد اختبار')&&out.includes('C-2026-9001'));
  t('متن العقد القياسي مُدمَج فعليًا',out.includes('ctr-parties'));
  t('لا ملحق خطة يظهر حين لا توجد لقطة (بلا أخطاء أو أقسام فارغة)',!out.includes('ملحق (١)'));
  t('الطباعة استُدعيت فعليًا',window.__printed===true);

  // ===== ٣) التصدير لعقد بنص مخصَّص (كان الزر مخفيًا له تمامًا) =====
  window.__printed=false;
  await buildContractDoc(null,Object.assign({},contractNoBaseline,
    {contract_type:'custom',custom_title:'اتفاقية سرّية',custom_body:'نص خاص جدًا'}),[]);
  await new Promise(r=>setTimeout(r,250));
  const out2=document.getElementById('contractPrint').innerHTML;
  t('تصدير العقد المخصَّص يعرض نصه الحر لا القالب القياسي',
    out2.includes('نص خاص جدًا')&&!out2.includes('حساب مخصّص'));

  // ===== ٤) المرفقات تُدرَج في التصدير كملحق مستقل =====
  window.__printed=false;
  await buildContractDoc(null,contractNoBaseline,[
    {id:'a1',label:'كشف الأسعار',url:'https://example.com/prices.pdf',kind:'link'}
  ]);
  await new Promise(r=>setTimeout(r,250));
  const out3=document.getElementById('contractPrint').innerHTML;
  t('المرفقات تظهر كقسم ملحق في المستند المُصدَّر',
    out3.includes('مستندات مرفقة')&&out3.includes('كشف الأسعار'));

  // ===== ٥) تكرار العقد =====
  window.__RPCHandler=(name,args)=>{
    if(name==='pmo_duplicate_contract')return Promise.resolve({data:{ok:true,id:'dup1',number:'C-2026-9002'},error:null});
    return Promise.resolve({data:{ok:true},error:null});
  };
  const dup=await duplicateContract('c1','عقد اختبار (نسخة)');
  const dupCall=window.__RPC.find(x=>x.name==='pmo_duplicate_contract');
  t('التكرار يمرّر المعرّف والاسم الجديد',dupCall&&dupCall.args.p_contract_id==='c1'&&dupCall.args.p_new_name==='عقد اختبار (نسخة)');
  t('التكرار يُرجع معرّفًا ورقمًا جديدين مختلفين عن الأصل',dup.id==='dup1'&&dup.number==='C-2026-9002');

  // ===== ٦) المرفقات: إضافة وحذف، مع منع التعديل بعد التوقيع =====
  window.__RPCHandler=(name)=>{
    if(name==='pmo_add_contract_attachment')return Promise.resolve({data:{ok:true,id:'att1'},error:null});
    return Promise.resolve({data:{ok:true},error:null});
  };
  const att=await addContractAttachment('c1','كشف الأسعار','https://x.com/a.pdf','link',null);
  t('إضافة مرفق تنجح',att.ok===true);
  window.__RPCHandler=()=>Promise.resolve({data:{ok:false,error:'signed'},error:null});
  let threw=null;
  try{ await addContractAttachment('c1','x','y','link',null); }catch(e){ threw=e.message; }
  t('منع تعديل مرفقات عقد موقَّع برسالة عربية واضحة',threw&&threw.includes('وقّع عليه طرف'));

  window.__done=true;
})();
`);

const wait=setInterval(()=>{
  if(!w.__done)return;
  clearInterval(wait);
  const hub=fs.readFileSync('src/app/contractshub.js','utf8');
  const ch=fs.readFileSync('src/app/clienthome.js','utf8');
  const sign=fs.readFileSync('src/app/contractsign.js','utf8');
  const exp=fs.readFileSync('src/app/exportcontract.js','utf8');
  const extra=[
    ['التصدير لم يعد يشترط وجود لقطة (سبب الفشل الأصلي أُزيل)',
      !exp.includes("if(!bl){toast('لقطة غير موجودة'")],
    ['التصدير يجلب اللقطة من القاعدة إن لم يكن المشروع محمَّلًا',exp.includes('fetchBaselineById(baselineId)')],
    ['التصدير متاح لكل أنواع العقود ضمن قائمة الإجراءات',
      hub.includes("add('chdExport','📄 تصدير PDF',true)")],
    ['تكرار العقد متاح ضمن قائمة الإجراءات',hub.includes("add('chdDuplicate','📑 تكرار العقد',true)")],
    ['قسم المرفقات موجود في لوحة العقد',hub.includes('id="chdAttachments"')],
    ['ملحق الخطة يظهر تلقائيًا كمرفق حين يكون العقد مرتبطًا بلقطة',hub.includes('ملحق (١) — الخطة المعتمدة')],
    ['المرفقات تظهر للشريك في صفحة التوقيع قبل التوقيع',sign.includes('pubsign-attach')],
    ['البريد والجوال أُضيفا للملف التعاقدي (يستخدمهما العقد فعليًا)',
      ch.includes('id="cpEmail"')&&ch.includes('id="cpPhone"')],
    ['البريد والجوال محسوبان ضمن الحقول الناقصة',
      ch.includes("'rep_title','contact_email','contact_phone'].filter")],
  ];
  const all=[...w.__R,...extra.map(([n,c])=>[n,c,''])];
  let ok=0,fail=0;
  all.forEach(([n,c,x])=>{if(c){ok++;console.log('  ✓ '+n);}else{fail++;console.log('  ✗ '+n+(x?' → '+x:''));}});
  console.log('\n──────────────────────────────');
  console.log(`نجح ${ok} · فشل ${fail}`);
  process.exit(fail?1:0);
},30);
setTimeout(()=>{console.log('انتهت المهلة');process.exit(1);},9000);

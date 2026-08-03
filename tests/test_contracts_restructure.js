// اختبار: إعادة هيكلة صفحة إدارة العقود — لوحة تفصيلية موحّدة (عرض/تعديل/إنشاء)، QR يُولَّد
// ويظهر فوريًا (لا يحتاج تصدير PDF منفصل لإثبات وجوده)، معاينة نص حيّة تتحدّث مع كل تعديل،
// وشارة حالة نظيفة (نقطة صغيرة بدل رمز تعبيري كبير مزعج).
const fs=require('fs');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8').replace(/<script[^>]*src=[^>]*><\/script>/g,'');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://pmo.alaamaa.com/'});
const w=dom.window;
const run=c=>{const s=w.document.createElement('script');s.textContent=c;w.document.body.appendChild(s);};

const nodeCrypto=require('crypto');
w.__nodeSha256=(bytesArray)=>Array.from(nodeCrypto.createHash('sha256').update(Buffer.from(bytesArray)).digest());

run(`
window.__RPC=[];
window.supabase={createClient:()=>({
  rpc:(name,args)=>{window.__RPC.push({name,args});return window.__RPCHandler?window.__RPCHandler(name,args):Promise.resolve({data:{ok:true},error:null});},
  from:(tbl)=>({
    select:()=>({
      eq:()=>({
        maybeSingle:async()=>({data:window.__CLIENT_ROW||{id:'cid1',name:'ثبات',cr_number:'123',rep_name:'محمد'},error:null}),
        order:()=>Promise.resolve({data:window.__BASELINES||[{id:'bl1',label:'الأساس 1',approved_at:'2026-01-01'}],error:null})
      })
    })
  }),
  auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:()=>{}
})};
window.crypto.subtle={digest:async(algo,data)=>{
  const bytes=Array.from(new Uint8Array(data));
  return new Uint8Array(window.__nodeSha256(bytes)).buffer;
}};
window.loadScript=async()=>{}; // qrgen.js سيُحاكى مباشرة أدناه
`);
run(fs.readFileSync('app.bundle.js','utf8'));

run(`
window.__R=[];
const t=(n,c,x)=>window.__R.push([n,!!c,x||'']);
toast=()=>{};ROLE='pmo';CID='cid1';

// محاكاة مولّد QR الحقيقي (بديل خفيف لا يحتاج الملف الفعلي لهذا الاختبار تحديدًا)
window.qrcode=(tn,lvl)=>({addData(){},make(){},createDataURL:()=>'data:image/gif;base64,FAKEBUTVALIDSTRUCTURE=='});

// ===== 1) شارة الحالة: نقطة صغيرة نظيفة بدل رمز تعبيري كبير =====
const badge=renderStatusBadge(statusByKey.active);
t('الشارة لا تحوي أي رمز تعبيري كبير (إيموجي) بعد الآن',!/[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}]/u.test(badge));
t('الشارة تحوي نقطة صغيرة (span بصنف pstatus-dot)',badge.includes('pstatus-dot'));
t('لون النقطة مطابق للون الحالة نفسه',badge.includes('background:'+statusByKey.active.color));
t('التسمية النصية لا تزال تظهر بوضوح',badge.includes('نشط وعلى المسار'));

CH_CONTRACTS=[{
  id:'c1',token:'tok1',status:'pending_alamaa',baseline_id:'bl1',baseline_label:'الأساس 1',created_at:'2026-01-01',
  includes_ad_spend:false,effective_date:'2026-01-01',contract_value:50000,late_payment_cap:1500,special_terms:null,
  client_cr:'123',client_vat:null,client_address:null,client_rep_name:'محمد',client_rep_title:null,
  client_contact_email:null,client_contact_phone:null,document_hash:null,
  project_id:'p1',project_name:'مشروع اختبار',client_id:'cid1',client_name:'ثبات',signatures:[]
}];

(async()=>{
  document.body.innerHTML+='<div id="chubPanel"></div><div id="hProject"></div><div id="barClient"></div><div id="host"></div>';

  // ===== 2) فتح اللوحة التفصيلية لعقد غير موقَّع =====
  await openContractDetailPanel('c1');
  t('اللوحة التفصيلية تُبنى فعليًا في DOM',!!document.querySelector('.chub-detail'));
  t('حقول التعديل تظهر (لا توقيع بعد)',!!document.getElementById('chdValue')&&document.getElementById('chdValue').type==='number');
  t('زر «حفظ وتثبيت» يظهر بنص واضح لا مبهم',document.body.innerHTML.includes('📌 حفظ وتثبيت التعديلات'));
  await new Promise(r=>setTimeout(r,20));
  t('رمز QR يظهر فعليًا كصورة — لا نص «جارٍ التحميل» متجمِّد',
    document.getElementById('chdQrImg').innerHTML.includes('<img')&&document.getElementById('chdQrImg').innerHTML.includes('data:image/gif'));
  t('الرابط الصحيح يظهر بجانب الرمز',document.body.innerHTML.includes('#/sign/tok1'));
  t('معاينة النص الكامل تظهر تلقائيًا بلا حاجة لزر إضافي',!!document.getElementById('chdPreview').innerHTML.length);

  // ===== 3) المعاينة حيّة: تغيير حقل يُحدِّث النص فورًا =====
  const beforeText=document.getElementById('chdPreview').innerHTML;
  document.getElementById('chdValue').value='999000';
  document.getElementById('chdValue').dispatchEvent(new Event('input'));
  await new Promise(r=>setTimeout(r,20));
  const afterText=document.getElementById('chdPreview').innerHTML;
  t('تغيير القيمة يُحدِّث نص المعاينة فورًا بلا إعادة تحميل',afterText!==beforeText&&afterText.includes('999,000'));

  // ===== 4) الحفظ: يستدعي updateContract الحقيقية بالقيم المُحدَّثة =====
  window.__RPCHandler=(name,args)=>{
    if(name==='pmo_update_contract')return Promise.resolve({data:{ok:true},error:null});
    if(name==='pmo_all_contracts_view')return Promise.resolve({data:CH_CONTRACTS,error:null});
    return Promise.resolve({data:{ok:true},error:null});
  };
  document.getElementById('chdSpecial').value='شرط خاص جديد';
  document.getElementById('chdSave').click();
  await new Promise(r=>setTimeout(r,30));
  const saveCall=window.__RPC.find(c=>c.name==='pmo_update_contract');
  t('الحفظ يمرّر القيمة المُعدَّلة فعليًا',saveCall&&saveCall.args.p_contract_value===999000);
  t('الحفظ يمرّر الشروط الإضافية المُدخَلة',saveCall&&saveCall.args.p_special_terms==='شرط خاص جديد');

  // ===== 5) عقد موقَّع: لا حقول تعديل، رسالة قفل واضحة =====
  CH_CONTRACTS[0].signatures=[{party:'alamaa',name:'أحمد',signed_at:'2026-01-02'}];
  await openContractDetailPanel('c1');
  t('عقد عليه توقيع: زر الحفظ لا يظهر إطلاقًا',!document.getElementById('chdSave'));
  t('رسالة قفل واضحة تشرح السبب وتقترح البديل',document.body.innerHTML.includes('🔒')&&document.body.innerHTML.includes('ألغِ هذا العقد وأنشئ عقدًا جديدًا'));

  window.__done=true;
})();
`);

const wait=setInterval(()=>{
  if(!w.__done)return;
  clearInterval(wait);
  const hub=fs.readFileSync('src/app/contractshub.js','utf8');
  const extra=[
    ['اللوحة الموحّدة تُستخدَم لكل من العرض والتعديل (لا نماذج منفصلة متكررة)',
      hub.includes('async function openContractDetailPanel')&&hub.includes('chubReadStandardFields')],
    ['الإنشاء الجديد يستخدم نفس منطق المعاينة الحيّة (دالة مشتركة)',
      hub.includes('async function openNewContractPanel')&&hub.includes('chnPreview')],
    ['QR يُولَّد فوريًا عند فتح اللوحة لا عند تصدير PDF فقط',hub.includes('chubRenderQR(')],
  ];
  const all=[...w.__R,...extra.map(([n,c])=>[n,c,''])];
  let ok=0,fail=0;
  all.forEach(([n,c,x])=>{if(c){ok++;console.log('  ✓ '+n);}else{fail++;console.log('  ✗ '+n+(x?' → '+x:''));}});
  console.log('\n──────────────────────────────');
  console.log(`نجح ${ok} · فشل ${fail}`);
  process.exit(fail?1:0);
},30);
setTimeout(()=>{console.log('انتهت المهلة');process.exit(1);},9000);

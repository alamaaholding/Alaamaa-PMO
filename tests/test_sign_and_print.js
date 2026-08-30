// اختبار: زر توقيع علامة في لوحة العقود الشاملة، وإصلاح تخطيط الطباعة (رمز QR لا يُقطَع)
const fs=require('fs');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8').replace(/<script[^>]*src=[^>]*><\/script>/g,'');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://pmo.alaamaa.com/'});
const w=dom.window;
const run=c=>{const s=w.document.createElement('script');s.textContent=c;w.document.body.appendChild(s);};
run(`window.__RPC=[];
window.supabase={createClient:()=>({
  rpc:(n,a)=>{window.__RPC.push({name:n,args:a});return window.__H?window.__H(n,a):Promise.resolve({data:{ok:true},error:null});},
  from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null}),eq:()=>({maybeSingle:async()=>({data:null,error:null})})})}),
  auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:()=>{}})};`);
// jsdom لا يُنفّذ canvas بلا الحزمة الأصلية — نقصٌ في البيئة، يُسَدّ في موضعه.
// (كان الاختبار يلتفّ عليه بتثبيت mountSignaturePad على النطاق العام، وقد اختفى
//  المَنفَذ بتحويل contractsign.js إلى وحدة.)
w.HTMLCanvasElement.prototype.getContext=function(){
  const noop=()=>{};
  return {strokeStyle:'',lineWidth:0,lineCap:'',lineJoin:'',
    beginPath:noop,moveTo:noop,lineTo:noop,stroke:noop,clearRect:noop};
};
w.HTMLCanvasElement.prototype.toDataURL=()=>'data:image/png;base64,SIG';
run(fs.readFileSync('app.bundle.js','utf8'));
run(`
// contractshub.js صارت وحدة ESM في W2، فلم تعد CH_CONTRACTS رابطةً عامة يُكتَب فيها.
// فيملك الاختبار مصدره (__FIX) ويحمّله عبر reloadContracts() — أي أن
// fetchAllContracts الحقيقية تعمل بدل تخطّيها.
window.__FIX=[];
window.__H=(n)=>Promise.resolve({data:n==='pmo_all_contracts_view'?window.__FIX:{ok:true},error:null});
window.__R=[];const t=(n,c,x)=>window.__R.push([n,!!c,x||'']);
toast=()=>{};ROLE='pmo';IS_OWNER=true;
window.qrcode=()=>({addData(){},make(){},createDataURL:()=>'data:image/gif;base64,Q=='});
window.loadScript=async()=>{};

const base={id:'c1',token:'t1',contract_type:'standard',contract_name:'عقد سنام',contract_number:'C-2026-1005',
  client_id:'cid1',client_name:'سنام',project_id:null,project_name:null,baseline_id:null,
  includes_ad_spend:false,effective_date:'2026-01-01',contract_value:1000,late_payment_cap:30,
  special_terms:null,document_hash:null,template_key:'alamaa_v1',clause_overrides:{},
  source_contract_id:null,instance_count:0,client_cr:null,client_vat:null,client_address:null,
  client_rep_name:null,client_rep_title:null,client_contact_email:null,client_contact_phone:null};

(async()=>{
  document.body.innerHTML+='<div id="chubPanel"></div><div id="chubBody"></div>';

  // معتمَد داخليًا وبلا توقيع علامة → يجب أن يظهر زر التوقيع بارزًا
  window.__FIX=[Object.assign({},base,{internal_approved:true,status:'pending_alamaa',signatures:[]})]; await reloadContracts();
  await openContractDetailPanel('c1');
  await new Promise(r=>setTimeout(r,50));
  t('زر «توقيع علامة الآن» يظهر بعد الاعتماد الداخلي',!!document.getElementById('chdSignNow'));
  t('شريط التوقيع يشرح الخطوة التالية بوضوح',document.body.innerHTML.includes('بانتظار توقيع علامة'));

  // فتح لوحة التوقيع فعليًا
  document.getElementById('chdSignNow').click();
  await new Promise(r=>setTimeout(r,30));
  t('لوحة التوقيع تُفتح بحقل اسم وقلم توقيع',
    !!document.getElementById('chdSignName')&&!!document.getElementById('chdSignConfirm'));

  // التوقيع بلا اسم يُرفض
  window.__RPC=[];
  document.getElementById('chdSignConfirm').click();
  await new Promise(r=>setTimeout(r,30));
  t('رفض التوقيع بلا اسم الموقِّع',!window.__RPC.some(c=>c.name==='pmo_sign_contract_staff'));

  // التوقيع الصحيح — بقلم التوقيع **الحقيقي** لا ببديلٍ يُرجع ok دائمًا.
  // وهذا ما كشفه التحويل: البديل كان يُخفي أن الرفض بلا توقيع سلوكٌ حقيقي في
  // القلم نفسه. فيُسلَك مسار «اكتب اسمك بدل الرسم» — وهو مسار مستخدِمٍ فعليّ.
  document.getElementById('chdSignName').value='صهيب بن فرج';
  document.querySelector('[data-sigmode="type"]').click();
  document.getElementById('sigTypeName').value='صهيب بن فرج';
  window.__H=(n)=>Promise.resolve({data:n==='pmo_all_contracts_view'?window.__FIX:{ok:true},error:null});
  document.getElementById('chdSignConfirm').click();
  await new Promise(r=>setTimeout(r,60));
  const sc=window.__RPC.find(c=>c.name==='pmo_sign_contract_staff');
  t('التوقيع يستدعي دالة الخادم بالاسم والتوقيع',
    sc&&sc.args.p_contract_id==='c1'&&sc.args.p_name==='صهيب بن فرج'&&!!sc.args.p_signature_data);

  // غير معتمَد داخليًا → لا زر توقيع إطلاقًا
  window.__FIX=[Object.assign({},base,{internal_approved:false,status:'pending_alamaa',signatures:[]})]; await reloadContracts();
  await openContractDetailPanel('c1');
  await new Promise(r=>setTimeout(r,50));
  t('عقد غير معتمَد: لا زر توقيع (الاعتماد أولًا)',!document.getElementById('chdSignNow'));

  // بعد توقيع علامة → إشعار بانتظار الشريك، لا زر توقيع مكرر
  window.__FIX=[Object.assign({},base,{internal_approved:true,status:'pending_client',
    signatures:[{party:'alamaa',name:'صهيب',signed_at:'2026-08-02'}]})]; await reloadContracts();
  await openContractDetailPanel('c1');
  await new Promise(r=>setTimeout(r,50));
  t('بعد توقيع علامة: لا زر توقيع مكرر',!document.getElementById('chdSignNow'));
  t('بعد توقيع علامة: إشعار واضح بانتظار الشريك',document.body.innerHTML.includes('بانتظار توقيع الشريك'));
  window.__done=true;
})();
`);
const wait=setInterval(()=>{
  if(!w.__done)return; clearInterval(wait);
  const css=fs.readFileSync('src/styles.css','utf8');
  const extra=[
    ['الغلاف لم يعد يستخدم 100vh (وحدة شاشة لا معنى لها في الطباعة)',
      !/\.cx-cover\{min-height:100vh/.test(css)],
    // القاعدة الحاكمة السادسة: القدرة هي «الغلاف لا ينقسم عبر حدّ الصفحة»،
    // وكان التأكيد مثبَّتًا على نصّ يتضمّن `background:var(--ink)` — وهو تفصيل
    // عارض لا علاقة له بالقدرة. تغيّر الرمز في W4 (‎--ink للنصّ و‎--solid للأرضية)
    // فسقط التأكيد بلا أن تتغيّر القدرة. فصار يقرأ كتلة `.cx-cover` نفسها.
    ['منع انقسام الغلاف عبر حدّ الصفحة',(()=>{
      const m=css.match(/\.cx-cover\{[^}]*\}/);
      return !!m && /page-break-inside:avoid/.test(m[0]) && /break-inside:avoid/.test(m[0]);
    })()],
    ['منع انقسام رمز QR تحديدًا',css.includes('.cx-qr{margin-top:22px')&&css.includes('page-break-inside:avoid;break-inside:avoid}')],
    ['نص وصف QR بعرض كافٍ لا يتناثر عموديًا',css.includes('width:320px;max-width:100%')&&css.includes('word-break:normal')],
    ['مقاس صفحة وهوامش رسمية محدَّدة للطباعة',css.includes('@page{size:A4;margin:12mm}')],
    ['منع انقسام الجداول وصفوفها عبر الصفحات',css.includes('.cx-table tr{page-break-inside:avoid')],
  ];
  let ok=0,fail=0;
  [...w.__R,...extra.map(([n,c])=>[n,c,''])].forEach(([n,c,x])=>{
    if(c){ok++;console.log('  ✓ '+n);}else{fail++;console.log('  ✗ '+n+(x?' → '+x:''));}});
  console.log('\nنجح '+ok+' · فشل '+fail);
  process.exit(fail?1:0);
},30);
setTimeout(()=>{console.log('انتهت المهلة');process.exit(1);},9000);

// اختبار: نظام العقود المرن — عقد قياسي أو بنص مخصَّص بالكامل، على مستوى مشروع محدَّد أو
// الشريك كاملًا، مع بوابة اعتماد داخلي صريحة تمنع أي توقيع (من أي طرف) قبل اعتماد صريح.
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
  from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{name:'ثبات',cr_number:'123'},error:null})})}),order:()=>Promise.resolve({data:[],error:null})}),
  auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:()=>{}
})};
window.crypto.subtle={digest:async(algo,data)=>{
  const bytes=Array.from(new Uint8Array(data));
  return new Uint8Array(window.__nodeSha256(bytes)).buffer;
}};
`);
run(fs.readFileSync('app.bundle.js','utf8'));

run(`
window.__R=[];
const t=(n,c,x)=>window.__R.push([n,!!c,x||'']);
toast=()=>{};ROLE='pmo';IS_OWNER=false;CID='cid1';CLIENTS=[{id:'cid1',name:'ثبات'}];
mountSignaturePad=()=>({getData:()=>({ok:false})}); // لا حاجة لقلم توقيع حقيقي هنا — خارج نطاق هذا الاختبار

// ===== 1) عارض العقد المخصَّص: نص حرّ يُعرَض بنفس الهوية البصرية للعقد القياسي =====
const customHtml=renderCustomContractHTML({title:'اتفاقية سرّية',body:'هذا نص تجريبي\\n\\nفقرة ثانية',clientName:'ثبات',clientCr:'123'});
t('العقد المخصَّص يعرض العنوان المُدخَل',customHtml.includes('اتفاقية سرّية'));
t('العقد المخصَّص يعرض النص الحر كما هو',customHtml.includes('هذا نص تجريبي'));
t('العقد المخصَّص يحوي جدول الأطراف بنفس هوية العقد القياسي',customHtml.includes('ctr-parties')&&customHtml.includes('123'));
t('العقد المخصَّص يحوي قسم توقيعات بنفس الشكل',customHtml.includes('التوقيعات'));

// ===== 2) إنشاء عقد: يدعم النطاقين والنوعين معًا عبر دالة واحدة =====
window.__RPCHandler=(name,args)=>{
  if(name==='pmo_create_contract_v2')return Promise.resolve({data:{ok:true,id:'newc',token:'tok'},error:null});
  return Promise.resolve({data:{ok:true},error:null});
};

(async()=>{
  // عقد قياسي بنطاق مشروع
  await createContractV2({scopeType:'project',projectId:'p1',baselineId:'bl1',clientId:'cid1',
    clientRow:{name:'ثبات'},contractType:'standard',includesAdSpend:true,effectiveDate:'2026-01-01',contractValue:50000});
  let call=window.__RPC.find(c=>c.name==='pmo_create_contract_v2');
  t('عقد قياسي بمشروع: يمرّر معرّفات المشروع واللقطة',call&&call.args.p_project_id==='p1'&&call.args.p_baseline_id==='bl1');
  t('عقد قياسي: نوعه يصل صحيحًا',call.args.p_contract_type==='standard');

  // عقد مخصَّص بنطاق شريك (بلا مشروع أو لقطة إطلاقًا)
  window.__RPC=[];
  await createContractV2({scopeType:'client',clientId:'cid1',clientRow:{name:'ثبات'},
    contractType:'custom',customTitle:'اتفاقية عامة',customBody:'نص العقد الكامل هنا'});
  call=window.__RPC.find(c=>c.name==='pmo_create_contract_v2');
  t('عقد مخصَّص بنطاق الشريك: لا معرّف مشروع أو لقطة إطلاقًا',call.args.p_project_id===null&&call.args.p_baseline_id===null);
  t('عقد مخصَّص: العنوان والنص الحر يصلان كما أُدخِلا',call.args.p_custom_title==='اتفاقية عامة'&&call.args.p_custom_body==='نص العقد الكامل هنا');
  t('عقد مخصَّص: معرّف الشريك يصل صراحة',call.args.p_client_id==='cid1');

  // ===== 3) الاعتماد الداخلي =====
  window.__RPCHandler=(name)=>{
    if(name==='pmo_approve_contract_internal')return Promise.resolve({data:{ok:true},error:null});
    return Promise.resolve({data:{ok:true},error:null});
  };
  const r1=await approveContractInternal('c1');
  t('الاعتماد الداخلي الناجح يُرجع ok',r1.ok===true);

  window.__RPCHandler=()=>Promise.resolve({data:{ok:false,error:'صلاحية غير كافية — الاعتماد الداخلي لمالك/مدير المنصة حصرًا'},error:null});
  let threw=null;
  try{ await approveContractInternal('c2'); }catch(e){ threw=e.message; }
  t('اعتماد بلا صلاحية كافية: رسالة واضحة توضّح الفئة المخوَّلة',threw&&threw.includes('مالك/مدير المنصة'));

  // ===== 4) صفحة التوقيع العامة: رفض صريح قبل الاعتماد الداخلي، لكل من العقد القياسي والمخصَّص =====
  window.fetchPublicContract=async()=>({
    ok:true,status:'pending_alamaa',client_name:'ثبات',project_name:null,internal_approved:false,
    archived:false,signatures:[],contract_type:'custom'
  });
  await renderPublicSign('tok-not-approved');
  await new Promise(r=>setTimeout(r,20));
  t('عقد غير معتمد داخليًا: صفحة التوقيع ترفض بوضوح، لا تعرض نموذج توقيع',
    document.getElementById('publicSign').innerHTML.includes('قيد المراجعة الداخلية')&&
    !document.getElementById('publicSign').innerHTML.includes('اكتب اسمك'));

  // ===== 5) بعد الاعتماد: العقد المخصَّص يُعرَض بنصه الحر الصحيح لا القالب القياسي خطأً =====
  window.fetchPublicContract=async()=>({
    ok:true,status:'pending_alamaa',client_name:'ثبات',project_name:null,internal_approved:true,
    archived:false,signatures:[],contract_type:'custom',custom_title:'اتفاقية خاصة',custom_body:'نص فريد لهذا العقد تحديدًا'
  });
  await renderPublicSign('tok-custom-approved');
  await new Promise(r=>setTimeout(r,20));
  t('عقد مخصَّص معتمَد: يظهر نصه الحر الفعلي في صفحة التوقيع',
    document.getElementById('publicSign').innerHTML.includes('نص فريد لهذا العقد تحديدًا'));
  t('عقد مخصَّص معتمَد: لا يظهر أي بند رقمي من القالب القياسي (البند ٧ مثلًا)',
    !document.getElementById('publicSign').innerHTML.includes('حساب مخصّص'));

  window.__done=true;
})();
`);

const wait=setInterval(()=>{
  if(!w.__done)return;
  clearInterval(wait);
  const hub=fs.readFileSync('src/app/contractshub.js','utf8');
  const api=fs.readFileSync('src/api.js','utf8');
  const sign=fs.readFileSync('src/app/contracttemplate.js','utf8');
  const extra=[
    ['renderCustomContractHTML معرّفة ومُصدَّرة',sign.includes('function renderCustomContractHTML')&&sign.includes('window.renderCustomContractHTML')],
    ['الإنشاء لا يعرض خيار نطاق (مشروع/شريك) إطلاقًا — الفصل حقيقي، لا اختيار مربك',
      !hub.includes('name="chnScope"')&&hub.includes('scopeType:\'client\'')],
    ['رسالة صريحة توضّح أن الربط بمشروع يحدث لاحقًا من داخل ذلك المشروع تحديدًا',
      hub.includes('الربط بمشروع يحدث لاحقًا من داخل ذلك المشروع')],
    ['الشريك اختياري صراحة في نموذج الإنشاء — لا يمنع الإنشاء',
      hub.includes('الشريك (اختياري')&&hub.includes("document.getElementById('chnClient').value||null")],
    ['اسم العقد إلزامي ورقمه تلقائي — هوية مستقلة لكل عقد',
      hub.includes("id=\"chnName\"")&&hub.includes("id=\"chnNumber\"")&&hub.includes("toast('أدخل اسم العقد'")],
    ['شارة "بانتظار الاعتماد" لا تظهر أبدًا لعقد عليه توقيع (كانت تُنتج قفلًا تامًا)',
      hub.includes("(!c.internal_approved&&c.status!=='void'&&!anySigned)")],
    ['حفظ التعديل يشمل اسم العقد ورقمه في كلا النوعين',hub.includes('const nameNum={contractName:')],
    ['اللوحة الجديدة تعرض خيارَي النوع (قياسي/مخصَّص) صراحة',hub.includes('name="chnType"')&&hub.includes('value="custom"')],
    ['زر الاعتماد الداخلي يظهر فقط قبل أي توقيع ولمن يملك الصلاحية',hub.includes('canApprove=(IS_OWNER||ROLE===')],
    ['createContractV2 معرّفة',api.includes('async function createContractV2')],
    ['approveContractInternal معرّفة',api.includes('async function approveContractInternal')],
  ];
  const all=[...w.__R,...extra.map(([n,c])=>[n,c,''])];
  let ok=0,fail=0;
  all.forEach(([n,c,x])=>{if(c){ok++;console.log('  ✓ '+n);}else{fail++;console.log('  ✗ '+n+(x?' → '+x:''));}});
  console.log('\n──────────────────────────────');
  console.log(`نجح ${ok} · فشل ${fail}`);
  process.exit(fail?1:0);
},30);
setTimeout(()=>{console.log('انتهت المهلة');process.exit(1);},9000);

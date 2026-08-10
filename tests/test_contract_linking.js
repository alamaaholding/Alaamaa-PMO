// اختبار: ربط عقد قائم (بنطاق شريك، غير مرتبط بعد) بمشروع محدَّد، وفك الارتباط — يعالج
// بالضبط المشكلة المُبلَّغة: "لا يظهر خيار لاختيار عقد موجود مسبقًا... تكرار إنشاء نفس العقد".
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
  from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})})}),
  auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:()=>{}
})};`);
run(fs.readFileSync('app.bundle.js','utf8'));

run(`
window.__R=[];
const t=(n,c,x)=>window.__R.push([n,!!c,x||'']);
toast=()=>{};ROLE='pmo';

// ===== 1) الربط: يمرّر معرّفات العقد والمشروع واللقطة الصحيحة =====
window.__RPCHandler=(name,args)=>{
  if(name==='pmo_link_contract_to_project')return Promise.resolve({data:{ok:true},error:null});
  return Promise.resolve({data:{ok:true},error:null});
};
(async()=>{
  const r1=await linkContractToProject('c1','p1','bl1');
  const call1=window.__RPC.find(c=>c.name==='pmo_link_contract_to_project');
  t('الربط يمرّر معرّف العقد والمشروع واللقطة معًا',
    call1&&call1.args.p_contract_id==='c1'&&call1.args.p_project_id==='p1'&&call1.args.p_baseline_id==='bl1');
  t('الربط الناجح يُرجع ok',r1.ok===true);

  // ===== 2) رفض الربط: عقد لشريك مختلف عن شريك المشروع =====
  window.__RPCHandler=()=>Promise.resolve({data:{ok:false,error:'العقد لشريك مختلف عن شريك هذا المشروع'},error:null});
  const r2=await linkContractToProject('c2','p2','bl2');
  t('رفض ربط عقد لشريك مختلف: رسالة واضحة تفسّر السبب بدقة',
    r2.ok===false&&r2.error.includes('شريك مختلف'));

  // ===== 3) رفض الربط: عقد مرتبط بمشروع آخر بالفعل =====
  window.__RPCHandler=()=>Promise.resolve({data:{ok:false,error:'هذا العقد مرتبط بمشروع آخر بالفعل — افصله أولًا'},error:null});
  const r3=await linkContractToProject('c3','p3','bl3');
  t('رفض ربط عقد مرتبط مسبقًا بمشروع آخر — يمنع الربط المزدوج',
    r3.ok===false&&r3.error.includes('مرتبط بمشروع آخر'));

  // ===== 4) فك الارتباط =====
  window.__RPC=[];
  window.__RPCHandler=(name)=>{
    if(name==='pmo_unlink_contract_from_project')return Promise.resolve({data:{ok:true},error:null});
    return Promise.resolve({data:{ok:true},error:null});
  };
  const r4=await unlinkContractFromProject('c1');
  const call4=window.__RPC.find(c=>c.name==='pmo_unlink_contract_from_project');
  t('فك الارتباط يستهدف العقد المحدَّد فقط',call4&&call4.args.p_contract_id==='c1');
  t('فك الارتباط الناجح يُرجع ok',r4.ok===true);

  // ===== 5) جلب العقود غير المرتبطة لشريك بعينه (مؤهَّلة للربط) =====
  window.__RPCHandler=(name)=>{
    if(name==='pmo_unlinked_client_contracts')return Promise.resolve({data:[
      {id:'u1',contract_type:'custom',custom_title:'اتفاقية عامة',contract_value:null,status:'pending_alamaa',internal_approved:false},
      {id:'u2',contract_type:'standard',contract_value:50000,status:'pending_alamaa',internal_approved:true}
    ],error:null});
    return Promise.resolve({data:[],error:null});
  };
  const unlinked=await fetchUnlinkedClientContracts('cid1');
  t('جلب العقود غير المرتبطة يُرجع القائمة الصحيحة',unlinked.length===2);
  t('كل عقد يحمل حالة الاعتماد الداخلي — يظهر بوضوح للمستخدم قبل الربط',
    unlinked[0].internal_approved===false&&unlinked[1].internal_approved===true);

  window.__done=true;
})();
`);

const wait=setInterval(()=>{
  if(!w.__done)return;
  clearInterval(wait);
  const api=fs.readFileSync('src/api.js','utf8');
  const sign=fs.readFileSync('src/app/contractsign.js','utf8');
  const hub=fs.readFileSync('src/app/contractshub.js','utf8');
  const extra=[
    ['linkContractToProject معرّفة',api.includes('async function linkContractToProject')],
    ['unlinkContractFromProject معرّفة',api.includes('async function unlinkContractFromProject')],
    ['fetchUnlinkedClientContracts معرّفة',api.includes('async function fetchUnlinkedClientContracts')],
    ['لوحة عقود المشروع لم تعد تحوي نموذج إنشاء عقد جديد (الإنشاء حصريًا في إدارة العقود)',
      !sign.includes('id="ctNewBl"')&&!sign.includes('id="ctCreate"')],
    ['لوحة عقود المشروع تعرض زر ربط عقد قائم صراحة',sign.includes('ctLinkExisting')&&sign.includes('ربط عقد قائم')],
    ['لوحة عقود المشروع تعرض رابطًا لإدارة العقود الكاملة لإنشاء عقد جديد',sign.includes('ctGoHub')],
    ['كل عقد مرتبط بمشروع يحمل زر فك ارتباط في لوحة المشروع',sign.includes('data-unlink=')],
    ['فك الارتباط متاح لأي عقد مرتبط بمشروع، بصرف النظر عن حالة التوقيع',
      hub.includes("add('chdUnlink','🔓 فك الارتباط بالمشروع',!!c.project_id)")],
  ];
  const all=[...w.__R,...extra.map(([n,c])=>[n,c,''])];
  let ok=0,fail=0;
  all.forEach(([n,c,x])=>{if(c){ok++;console.log('  ✓ '+n);}else{fail++;console.log('  ✗ '+n+(x?' → '+x:''));}});
  console.log('\n──────────────────────────────');
  console.log(`نجح ${ok} · فشل ${fail}`);
  process.exit(fail?1:0);
},30);
setTimeout(()=>{console.log('انتهت المهلة');process.exit(1);},9000);

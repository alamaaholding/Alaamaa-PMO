// اختبار: نمط الأصل/النسخة — عقد أصل في المحفظة يُسنَد لعدة شركاء، كل إسناد يُنشئ نسخة
// مستقلة تمامًا (معرّف ورقم ورابط توقيع خاص)، والأصل يبقى كما هو. لا تداخل ولا تعارض.
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
  from:()=>({select:()=>({order:()=>Promise.resolve({data:[{id:'cid1',name:'سنام'},{id:'cid2',name:'ثبات'}],error:null})})}),
  auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:()=>{}
})};`);
run(fs.readFileSync('app.bundle.js','utf8'));

run(`
window.__R=[];
const t=(n,c,x)=>window.__R.push([n,!!c,x||'']);
toast=()=>{};ROLE='pmo';

(async()=>{
  // ===== 1) الإسناد يستدعي دالة الخادم بالمعرّفين الصحيحين =====
  window.__RPCHandler=(name,args)=>{
    if(name==='pmo_assign_contract_to_client')
      return Promise.resolve({data:{ok:true,id:'copy-'+args.p_client_id,token:'tok-'+args.p_client_id,number:'C-2026-2001'},error:null});
    return Promise.resolve({data:{ok:true},error:null});
  };
  const r1=await assignContractToClient('tpl1','cid1');
  const call=window.__RPC.find(c=>c.name==='pmo_assign_contract_to_client');
  t('الإسناد يمرّر معرّف الأصل والشريك معًا',call&&call.args.p_contract_id==='tpl1'&&call.args.p_client_id==='cid1');
  t('الإسناد يُرجع معرّف نسخة جديدة مختلفًا عن الأصل',r1.id!=='tpl1'&&r1.id==='copy-cid1');
  t('النسخة تحصل على رقم عقد خاص بها',r1.number==='C-2026-2001');
  t('النسخة تحصل على رمز توقيع خاص بها (لا رمز الأصل)',r1.token==='tok-cid1');

  // ===== 2) العزل: إسناد نفس الأصل لشريك ثانٍ يُنتج نسخة مختلفة تمامًا =====
  const r2=await assignContractToClient('tpl1','cid2');
  t('شريك ثانٍ من نفس الأصل: نسخة بمعرّف مختلف كليًا عن نسخة الشريك الأول',
    r2.id==='copy-cid2'&&r2.id!==r1.id);
  t('كل نسخة برمز توقيع مستقل — لا مجال لتداخل روابط التوقيع بين الشركاء',r2.token!==r1.token);

  // ===== 3) منع التكرار: نسخة سارية واحدة لكل شريك من نفس الأصل =====
  window.__RPCHandler=()=>Promise.resolve({data:{ok:false,error:'duplicate'},error:null});
  let threw=null;
  try{ await assignContractToClient('tpl1','cid1'); }catch(e){ threw=e.message; }
  t('منع التكرار: رسالة عربية واضحة عند وجود نسخة سارية للشريك نفسه',
    threw&&threw.includes('نسخة سارية من هذا العقد بالفعل'));

  // ===== 4) جلب نسخ الأصل =====
  window.__RPCHandler=(name)=>{
    if(name==='pmo_contract_instances')return Promise.resolve({data:[
      {id:'i1',contract_number:'C-2026-2001',contract_name:'عقد أ — سنام',client_name:'سنام',status:'pending_alamaa',internal_approved:false,project_name:null},
      {id:'i2',contract_number:'C-2026-2002',contract_name:'عقد أ — ثبات',client_name:'ثبات',status:'signed',internal_approved:true,project_name:'مشروع ثبات'}
    ],error:null});
    return Promise.resolve({data:[],error:null});
  };
  const insts=await fetchContractInstances('tpl1');
  t('جلب النسخ يُرجع كل نسخ الأصل',insts.length===2);
  t('كل نسخة تحمل حالتها المستقلة — واحدة موقَّعة وأخرى بانتظار الاعتماد، بلا تأثر ببعضهما',
    insts[0].status==='pending_alamaa'&&insts[1].status==='signed');
  t('كل نسخة ترتبط بمشروعها الخاص (أو لا شيء) استقلالًا',
    insts[0].project_name===null&&insts[1].project_name==='مشروع ثبات');

  window.__done=true;
})();
`);

const wait=setInterval(()=>{
  if(!w.__done)return;
  clearInterval(wait);
  const api=fs.readFileSync('src/api.js','utf8');
  const hub=fs.readFileSync('src/app/contractshub.js','utf8');
  const extra=[
    ['assignContractToClient معرّفة',api.includes('async function assignContractToClient')],
    ['fetchContractInstances معرّفة',api.includes('async function fetchContractInstances')],
    ['الإسناد يظهر للأصل فقط (لا لنسخة ولا لعقد مُسنَد أصلًا)',
      hub.includes('const isTemplate=!c.client_id&&!c.source_contract_id')
      &&hub.includes("id:'chdAssign',label:'👥 إسناد لشريك'")],
    ['شارة «أصل» مع عدد نسخه في القائمة',hub.includes('chub-tpl-tag')&&hub.includes('instance_count')],
    ['شارة «نسخة من» تُظهر اسم الأصل بوضوح',
      hub.includes('chub-copy-tag')&&hub.includes('نسخة من ${esc(c.source_name')],
    ['شرح صريح أن تعديل النسخة لا يمسّ الأصل',hub.includes('تعديلها لا يمسّ الأصل')],
  ];
  const all=[...w.__R,...extra.map(([n,c])=>[n,c,''])];
  let ok=0,fail=0;
  all.forEach(([n,c,x])=>{if(c){ok++;console.log('  ✓ '+n);}else{fail++;console.log('  ✗ '+n+(x?' → '+x:''));}});
  console.log('\n──────────────────────────────');
  console.log(`نجح ${ok} · فشل ${fail}`);
  process.exit(fail?1:0);
},30);
setTimeout(()=>{console.log('انتهت المهلة');process.exit(1);},9000);

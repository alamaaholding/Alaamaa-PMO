// اختبار تصييري فعلي: يبني لوحة العقد في DOM حقيقي لخمس حالات، ويتحقق أن التبويبات
// والمرحلة والإجراء الأساسي تظهر صحيحة — لا فحص نصوص في الملف بل تصيير فعلي.
const fs=require('fs');const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8').replace(/<script[^>]*src=[^>]*><\/script>/g,'');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://pmo.alaamaa.com/'});
const w=dom.window;
const run=c=>{const s=w.document.createElement('script');s.textContent=c;w.document.body.appendChild(s);};
run(`window.supabase={createClient:()=>({rpc:()=>Promise.resolve({data:[],error:null}),
 from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null}),eq:()=>({maybeSingle:async()=>({data:null,error:null})})})}),
 storage:{from:()=>({createSignedUrl:async()=>({data:{},error:null})})},
 auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
 channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:()=>{}})};`);
run(fs.readFileSync('app.bundle.js','utf8'));
run(`
toast=()=>{};ROLE='pmo';IS_OWNER=true;
window.qrcode=()=>({addData(){},make(){},createDataURL:()=>'data:image/gif;base64,Q=='});
window.loadScript=async()=>{};
const mk=(o)=>Object.assign({id:'c1',token:'t1',contract_type:'standard',contract_name:'عقد اختبار',
 contract_number:'C-1',client_id:'cl1',client_name:'سنام',project_id:null,project_name:null,
 baseline_id:null,includes_ad_spend:false,effective_date:'2026-01-01',contract_value:1000,
 late_payment_cap:30,special_terms:null,document_hash:null,template_key:'alamaa_v1',
 clause_overrides:{},org:{legal_name:'علامة'},source_contract_id:null,instance_count:0,
 signatures:[],internal_approved:false,status:'pending_alamaa',send_count:0,
 client_cr:null,client_vat:null,client_address:null,client_rep_name:null,client_rep_title:null,
 client_contact_email:null,client_contact_phone:null},o||{});
document.body.innerHTML+='<div id="chubPanel"></div><div id="chubBody"></div>';
(async()=>{
 const cases=[
  ['غير معتمد',mk({}),'terms','بانتظار الاعتماد الداخلي','chdApprove'],
  ['معتمد بلا توقيع',mk({internal_approved:true}),'send','بانتظار توقيع علامة','chdSignNow'],
  ['وقّعت علامة',mk({internal_approved:true,signatures:[{party:'alamaa',name:'أ',signed_at:'2026-01-02'}]}),'send','بانتظار توقيع الشريك',null],
  ['موقّع بالكامل',mk({internal_approved:true,status:'signed',signatures:[{party:'alamaa',name:'أ',signed_at:'x'},{party:'client',name:'ب',signed_at:'y'}]}),'overview','موقَّع بالكامل','chdCert'],
  ['أصل',mk({internal_approved:true,client_id:null,client_name:null}),'send','عقد أصل (قالب) معتمَد','chdAssign']
 ];
 window.__R=[];
 for(const [name,c,expTab,expTitle,expBtn] of cases){
   CH_CONTRACTS=[c];
   await openContractDetailPanel('c1');
   await new Promise(r=>setTimeout(r,40));
   const panes=[...document.querySelectorAll('.chub-pane')].length;
   const tabs=[...document.querySelectorAll('.chub-tab')].length;
   const active=document.querySelector('.chub-tab.active');
   const title=document.querySelector('.chub-stage-main b');
   const btn=expBtn?document.getElementById(expBtn):null;
   window.__R.push([name,{panes,tabs,activeTab:active?active.dataset.chdtab:null,
     title:title?title.textContent:null,primaryOk:expBtn?!!btn:true,
     expTab,expTitle}]);
 }
 window.__done=true;
})();
`);
const wait=setInterval(()=>{
 if(!w.__done)return;clearInterval(wait);
 let fail=0;
 w.__R.forEach(([n,r])=>{
   const ok=r.panes===5&&r.tabs===5&&r.title===r.expTitle&&r.activeTab===r.expTab&&r.primaryOk;
   if(!ok)fail++;
   console.log((ok?'  ✓ ':'  ✗ ')+n+` | تبويبات:${r.tabs} ألواح:${r.panes} نشط:${r.activeTab}(متوقع ${r.expTab}) | "${r.title}"`);
 });
 console.log('\nنجح '+(w.__R.length-fail)+' · فشل '+fail);
 process.exit(fail?1:0);
},30);
setTimeout(()=>{console.log('مهلة');process.exit(1);},9000);

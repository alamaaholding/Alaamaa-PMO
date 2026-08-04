// اختبار: دورة حياة العقد (مدة/انتهاء/تجديد) + الإرسال بالبريد وسجله
const fs=require('fs');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8').replace(/<script[^>]*src=[^>]*><\/script>/g,'');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://pmo.alaamaa.com/'});
const w=dom.window;
const run=c=>{const s=w.document.createElement('script');s.textContent=c;w.document.body.appendChild(s);};
run(`window.__RPC=[];window.__FETCH=[];
window.supabase={createClient:()=>({
  rpc:(n,a)=>{window.__RPC.push({name:n,args:a});return window.__H?window.__H(n,a):Promise.resolve({data:[],error:null});},
  from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null}),eq:()=>({maybeSingle:async()=>({data:null,error:null})})})}),
  auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:()=>{}})};
window.fetch=async(url,opt)=>{window.__FETCH.push({url,opt});return window.__FR||{json:async()=>({ok:true,id:'e1'})};};`);
run(fs.readFileSync('app.bundle.js','utf8'));
run(`
window.__R=[];const t=(n,c,x)=>window.__R.push([n,!!c,x||'']);
sb.auth.getSession=async()=>({data:{session:{access_token:'TOK'}}});
toast=()=>{};ROLE='pmo';
const C={id:'c1',token:'tk',contract_name:'عقد سنام',contract_number:'C-2026-1005',client_name:'سنام'};

(async()=>{
  // ===== الإرسال الناجح =====
  await sendContractEmail(C,'a@b.com','invite');
  const f=window.__FETCH[0];
  t('الإرسال يستدعي دالة الحافة لا Resend مباشرة (المفتاح لا يصل المتصفح)',
    f.url.includes('/functions/v1/send-contract-email')&&!f.url.includes('resend.com'));
  t('الطلب يحمل رمز الجلسة للتحقق من الهوية',f.opt.headers.Authorization==='Bearer TOK');
  const b=JSON.parse(f.opt.body);
  t('الرابط المُرسَل هو رابط توقيع هذا العقد تحديدًا',b.signUrl.includes('#/sign/tk'));
  t('اسم العقد ورقمه يُمرَّران للرسالة',b.contractName==='عقد سنام'&&b.contractNumber==='C-2026-1005');
  const log=window.__RPC.find(x=>x.name==='pmo_log_contract_send');
  t('النجاح يُسجَّل في سجل الإرسال',log&&log.args.p_status==='sent'&&log.args.p_to_email==='a@b.com');

  // ===== الفشل يُسجَّل أيضًا (لا يُبتلع) =====
  window.__FETCH=[];window.__RPC=[];
  window.__FR={json:async()=>({ok:false,error:'resend_failed',message:'نطاق غير موثّق'})};
  let threw=null;
  try{ await sendContractEmail(C,'a@b.com','reminder'); }catch(e){ threw=e.message; }
  t('فشل الإرسال يرفع خطأ واضح لا يُبتلع صامتًا',threw&&threw.includes('نطاق غير موثّق'));
  const flog=window.__RPC.find(x=>x.name==='pmo_log_contract_send');
  t('الفشل يُسجَّل أيضًا في السجل بحالة failed',flog&&flog.args.p_status==='failed');
  t('سبب الفشل محفوظ في السجل للمراجعة',flog&&flog.args.p_error==='نطاق غير موثّق');

  // ===== غياب المفتاح: رسالة إرشادية واضحة =====
  window.__FR={json:async()=>({ok:false,error:'missing_key'})};
  threw=null;
  try{ await sendContractEmail(C,'a@b.com','invite'); }catch(e){ threw=e.message; }
  t('غياب مفتاح Resend: رسالة إرشادية صريحة لا خطأ تقني مبهم',threw&&threw.includes('لم يُضبط مفتاح Resend'));

  // ===== تنبيهات الانتهاء =====
  window.__H=(n)=>n==='pmo_expiring_contracts'
    ? Promise.resolve({data:[{id:'x1',contract_name:'ع',contract_number:'C-1',client_name:'س',
        end_date:'2026-08-20',days_left:18,expired:false,auto_renew:true}],error:null})
    : Promise.resolve({data:[],error:null});
  const exp=await fetchExpiringContracts();
  t('جلب العقود المقاربة للانتهاء يعمل',exp.length===1&&exp[0].days_left===18);
  window.__done=true;
})();
`);
const wait=setInterval(()=>{
  if(!w.__done)return;clearInterval(wait);
  const hub=fs.readFileSync('src/app/contractshub.js','utf8');
  const api=fs.readFileSync('src/api.js','utf8');
  const extra=[
    ['حقول المدة وتاريخ الانتهاء والتجديد التلقائي في لوحة التعديل',
      hub.includes('id="chdDuration"')&&hub.includes('id="chdEnd"')&&hub.includes('id="chdRenew"')],
    ['الحقول تُقرأ وتُمرَّر عند الحفظ',hub.includes('durationMonths:')&&api.includes('p_duration_months')],
    ['صندوق الإرسال والمسار يظهر بعد الاعتماد الداخلي (ويبقى بعد التوقيع لعرض المسار مكتملًا)',
      hub.includes("(c.internal_approved&&c.status!=='void')?")],
    ['زر الإرسال نفسه يختفي بعد توقيع الشريك (لا إرسال بلا داعٍ)',
      hub.includes("${!cl?`")&&hub.includes("id=\"chdSendBtn\"")],
    ['الزر يتحول لتذكير بعد أول إرسال',hub.includes("c.send_count>0?'🔔 إرسال تذكير'")],
    ['مسار الرسالة يعرض الخطوات الخمس بالترتيب',
      ['أُرسلت','وصلت','فُتحت','نُقر الرابط','وُقِّع'].every(k=>hub.includes(k))],
    ['بريد الشريك يُحفظ في ملفه مرة واحدة فلا يُعاد إدخاله',
      hub.includes('chdSaveEmail')&&hub.includes('saveClientEmail(c.client_id,to)')],
    ['ارتداد الرسالة يظهر بسببه بوضوح',hub.includes('ارتدّت الرسالة')],
    ['شريط تنبيهات انتهاء العقود في المحفظة',hub.includes('chubExpiring')&&hub.includes('عقود تحتاج انتباهك')],
    ['تمييز العقد المنتهي فعلًا عن المقارب للانتهاء',hub.includes('x.expired?')],
  ];
  let ok=0,fail=0;
  [...w.__R,...extra.map(([n,c])=>[n,c,''])].forEach(([n,c,x])=>{
    if(c){ok++;console.log('  ✓ '+n);}else{fail++;console.log('  ✗ '+n+(x?' → '+x:''));}});
  console.log('\nنجح '+ok+' · فشل '+fail);
  process.exit(fail?1:0);
},30);
setTimeout(()=>{console.log('انتهت المهلة');process.exit(1);},9000);

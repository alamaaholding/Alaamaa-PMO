// اختبار: ختم نص العقد (الفجوات ١+٢+٣) — النص المختوم هو المرجع، والتجزئة تشمل كل ما
// يحدّد النص، وتُعاد عند كل تعديل فلا يظهر تحذير تلاعب كاذب.
const fs=require('fs');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8').replace(/<script[^>]*src=[^>]*><\/script>/g,'');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://pmo.alaamaa.com/'});
const w=dom.window;
const run=c=>{const s=w.document.createElement('script');s.textContent=c;w.document.body.appendChild(s);};
const nodeCrypto=require('crypto');
// jsdom 26 لا يوفّر TextEncoder (jsdom 30 يوفّره) — نقص في بيئة الاختبار لا في الكود
if(typeof w.TextEncoder==='undefined')w.TextEncoder=require('util').TextEncoder;
w.__sha=b=>Array.from(nodeCrypto.createHash('sha256').update(Buffer.from(b)).digest());
run(`window.__RPC=[];
window.supabase={createClient:()=>({
  rpc:(n,a)=>{window.__RPC.push({name:n,args:a});return Promise.resolve({data:{ok:true},error:null});},
  from:()=>({select:()=>({order:()=>Promise.resolve({data:[],error:null}),
    eq:()=>({maybeSingle:async()=>({data:null,error:null})})})}),
  auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),
    onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:()=>{}})};
Object.defineProperty(window,'crypto',{configurable:true,writable:true,value:{getRandomValues:a=>{for(let i=0;i<a.length;i++)a[i]=Math.floor(Math.random()*256);return a;},subtle:{digest:async(algo,data)=>new Uint8Array(window.__nodeSha256?window.__nodeSha256(Array.from(new Uint8Array(data))):window.__sha(Array.from(new Uint8Array(data)))).buffer}}});`);
run(fs.readFileSync('app.bundle.js','utf8'));
run(`
window.__R=[];const t=(n,c,x)=>window.__R.push([n,!!c,x||'']);
toast=()=>{};
const base={id:'c1',contract_type:'standard',client_name:'سنام',client_cr:'1',client_vat:'2',
  client_address:'الرياض',client_rep_name:'م',client_rep_title:'مدير',
  client_contact_email:'a@b.com',client_contact_phone:'05',org:{legal_name:'علامة',cr_number:'9'},
  includes_ad_spend:false,effective_date:'2026-01-01',contract_value:1000,late_payment_cap:30,
  special_terms:null,template_key:'alamaa_v1',clause_overrides:{}};

(async()=>{
  // ===== (٣) التجزئة تشمل النموذج وتعديلات البنود =====
  const h1=await computeContractHash(contractMergeData(base));
  const h2=await computeContractHash(contractMergeData(Object.assign({},base,{template_key:'alamaa_v2'})));
  t('تغيير النموذج يغيّر التجزئة',h1!==h2);
  const h3=await computeContractHash(contractMergeData(
    Object.assign({},base,{clause_overrides:{excluded:['٥'],added:[],edited:{}}})));
  t('حذف بند يغيّر التجزئة (كانت تتجاهله تمامًا)',h1!==h3);
  const h4=await computeContractHash(contractMergeData(
    Object.assign({},base,{clause_overrides:{excluded:[],added:[],edited:{'٤':{body:'نص محرَّر'}}}})));
  t('تحرير نص بند يغيّر التجزئة',h1!==h4);
  const h5=await computeContractHash(contractMergeData(
    Object.assign({},base,{org:{legal_name:'علامة المعدَّلة',cr_number:'9'}})));
  t('تغيير بيانات علامة يغيّر التجزئة',h1!==h5);
  t('نفس المدخلات تُنتج نفس التجزئة دائمًا',h1===await computeContractHash(contractMergeData(base)));

  // ===== (١) الختم =====
  window.__RPC=[];
  await sealContract(base);
  const call=window.__RPC.find(x=>x.name==='pmo_seal_contract');
  t('الختم يستدعي دالة الخادم بمعرّف العقد',call&&call.args.p_contract_id==='c1');
  t('الجسم المختوم يحمل النص المدموج كاملًا لا مرجعًا للقالب',
    call&&call.args.p_body&&Array.isArray(call.args.p_body.sections)&&call.args.p_body.sections.length>10);
  t('الجسم المختوم يميّز نوعه (قياسي)',call.args.p_body.kind==='standard');
  t('الجسم المختوم يحوي جدول الأطراف مدموجًا',Array.isArray(call.args.p_body.partyRows)&&call.args.p_body.partyRows.length>0);
  t('التجزئة المختومة مُمرَّرة بطول صحيح',call.args.p_hash&&call.args.p_hash.length===64);

  // العقد المخصَّص يُختَم بنصه الحر
  window.__RPC=[];
  await sealContract(Object.assign({},base,{contract_type:'custom',custom_title:'اتفاقية',custom_body:'نص حر'}));
  const c2=window.__RPC.find(x=>x.name==='pmo_seal_contract');
  t('العقد المخصَّص يُختَم بنصه الحر ونوعه',c2.args.p_body.kind==='custom'&&c2.args.p_body.body==='نص حر');
  window.__done=true;
})();
`);
const wait=setInterval(async()=>{
  if(!w.__done)return;clearInterval(wait);
  const sign=fs.readFileSync('src/app/contractsign.js','utf8');
  const hub=fs.readFileSync('src/app/contractshub.js','utf8');
  const api=fs.readFileSync('src/api.js','utf8');
  const extra=[
    ['صفحة التوقيع تعرض النص المختوم أولًا لا المُعاد توليده',
      sign.includes('d.sealed_body')&&sign.includes("d.sealed_body.kind==='custom'")],
    ['اللوحة تعرض المختوم للعقد الموقَّع',hub.includes('c.sealed_body&&anySigned')],
    ['(٢) إعادة الختم بعد كل حفظ',hub.includes('if(fresh){try{await sealContract(fresh);}catch(e){}}')],
    ['الاعتماد الداخلي يختم النص',hub.includes('وخُتم نصه')],
    ['ختم تلقائي للعقود القائمة بلا ختم',hub.includes("if(!c.sealed_body&&c.status!=='void')")],
    ['contractMergeData مصدر واحد لبناء بيانات التجزئة',api.includes('function contractMergeData(c)')],
  ];
  // ═══ إعادة الجلب محصَّنة ضد فقدان القائمة ═══
  //
  // كان هذا تأكيدًا **نصّيًّا** على سطرٍ بعينه، وقد كان مكتوبًا مرّتين فسقط حين
  // صار واحدًا. والدعوى أوسع من سطرها: جلبٌ يعود بقائمةٍ لا تحوي العقد
  // المعروض (سباقٌ، أو صلاحيةٌ تغيّرت أثناء الفتح) **يُبقي القديمة قائمة** بدل
  // أن يُفرغ اللوحة. فتُقاد الآن بقائمتين محقونتين، ويُقرأ الأثر من اللوحة.
  const R = w.reloadOne;
  const C = n => Array.from({length:n},(_,i)=>({id:'k'+i,status:'draft',contract_name:'ع'+i,signatures:[]}));
  const shownTotal = () => w.loadedContracts().length;
  await R('k1', async () => C(4));                      // قائمةٌ رابحة: تُثبَّت
  const before = shownTotal();
  extra.push(['القائمة الرابحة تُثبَّت', before === 4, String(before)]);

  const lost = await R('k1', async () => [{id:'غريب',status:'draft',signatures:[]}]);
  extra.push(['وجلبٌ يفقد العقد يعود بلا شيء', lost === null, JSON.stringify(lost)]);
  extra.push(['ولا يستبدل القائمة القائمة', shownTotal() === 4, String(shownTotal())]);

  const gone = await R('k1', async () => null);
  extra.push(['وقائمةٌ معدومة لا ترمي ولا تمسح', gone === null && shownTotal() === 4]);

  // ═══ مصدرُ نصّ المعاينة: ثلاثةٌ لا واحد ═══
  //
  // وأخطرُ ما قد تعرضه هذه اللوحة نصٌّ **لم يوقّعه أحد**: عقدٌ موقَّعٌ يُعاد
  // توليد نصّه من نموذجٍ تغيّر أو بياناتٍ عُدِّلت بعد التوقيع. فالمختوم
  // الموقَّع له الأسبقية، **حتى على المخصَّص**.
  const PS = w.previewSource;
  const SEALED = {sealed_body:{kind:'standard'}};
  extra.push(['مختومٌ وموقَّع: النصُّ المختوم',
    PS(SEALED,{anySigned:true,isCustom:false}) === 'sealed']);
  extra.push(['وله الأسبقية حتى على المخصَّص',
    PS(SEALED,{anySigned:true,isCustom:true}) === 'sealed',
    PS(SEALED,{anySigned:true,isCustom:true})]);
  // والشرطان مجتمعان: ختمٌ بلا توقيعٍ ما زال قابلًا للتعديل، فيُعاد توليده كي
  // تظهر تعديلاتُ المستخدم وهو يكتب.
  extra.push(['وختمٌ بلا توقيع يُعاد توليده',
    PS(SEALED,{anySigned:false,isCustom:false}) === 'merged',
    PS(SEALED,{anySigned:false,isCustom:false})]);
  extra.push(['وتوقيعٌ بلا ختمٍ كذلك',
    PS({sealed_body:null},{anySigned:true,isCustom:false}) === 'merged']);
  extra.push(['والمخصَّص غيرُ الموقَّع يُبنى من حقوله',
    PS({},{anySigned:false,isCustom:true}) === 'custom']);
  extra.push(['والنموذجيّ هو الافتراضي', PS({},{}) === 'merged']);
  extra.push(['وعقدٌ معدوم لا يرمي', PS(null,{anySigned:true}) === 'merged']);

  // وترتيبُ الإنعاش عقدٌ لا تفصيل: التوقيع يُقرأ **قبل** أوّل انتظار. ولو قُرئ
  // بعد الختم وإعادة الجلب، لاختلف المعنى في عقدٍ وُقِّع بين الخطوتين.
  {
    const body = (hub.match(/async function freshenContract[^]*?\n}/) || [''])[0];
    const sigAt = body.indexOf('signatures');
    const awaitAt = body.indexOf('await');
    extra.push(['التوقيع يُقرأ قبل أوّل انتظار في الإنعاش',
      sigAt > -1 && awaitAt > -1 && sigAt < awaitAt, sigAt + ' قبل ' + awaitAt]);
  }

  const won = await R('k1', async () => C(2));   // C(2) = k0,k1 — فيها k1
  extra.push(['وجلبٌ يجد العقد يعيده', won && won.id === 'k1', JSON.stringify(won && won.id)]);
  extra.push(['ويستبدل القائمة عندئذٍ', shownTotal() === 2, String(shownTotal())]);

  let ok=0,fail=0;
  [...w.__R,...extra.map(([n,c,x])=>[n,c,x||''])].forEach(([n,c,x])=>{
    if(c){ok++;console.log('  ✓ '+n);}else{fail++;console.log('  ✗ '+n+(x?' → '+x:''));}});
  console.log('\nنجح '+ok+' · فشل '+fail);
  process.exit(fail?1:0);
},30);
setTimeout(()=>{console.log('انتهت المهلة');process.exit(1);},9000);

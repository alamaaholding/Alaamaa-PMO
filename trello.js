// ===== تكامل Trello (وحدة كسولة) — المنصة مصدر الحقيقة، Trello سطح التنفيذ =====
// يعتمد على العام: sb, PROJECT, SCHED, TRACK, USER, dialog, confirmDialog, toast, esc, fmt,
//                  isoLocal, trackMeta, STATUS, loadProject, render, CID, PID

const TR_API='https://api.trello.com/1';
const TR_LISTS=[
  {key:'todo',   name:'بانتظار البدء'},
  {key:'doing',  name:'قيد التنفيذ'},
  {key:'review', name:'للمراجعة'},
  {key:'done',   name:'منجز'}
];
let TRELLO_CREDS=null;

// ---------- بيانات الاعتماد ----------
async function trelloLoadCreds(){
  if(TRELLO_CREDS)return TRELLO_CREDS;
  const {data}=await sb.from('pmo_integrations').select('*').eq('provider','trello').maybeSingle();
  TRELLO_CREDS=data||null;return TRELLO_CREDS;
}
async function trelloSaveCreds(api_key,token,config){
  const row={provider:'trello',api_key,token,config:config||{},updated_at:new Date().toISOString()};
  const {data,error}=await sb.from('pmo_integrations').upsert(row,{onConflict:'provider'}).select().single();
  if(error)throw error;TRELLO_CREDS=data;return data;
}
function trAuth(){
  if(!TRELLO_CREDS||!TRELLO_CREDS.api_key||!TRELLO_CREDS.token)throw new Error('لم تُضبط بيانات اعتماد Trello بعد');
  return 'key='+encodeURIComponent(TRELLO_CREDS.api_key)+'&token='+encodeURIComponent(TRELLO_CREDS.token);
}
async function trFetch(path,method,params){
  const sep=path.includes('?')?'&':'?';
  const url=TR_API+path+sep+trAuth()+(params?'&'+params:'');
  const res=await fetch(url,{method:method||'GET'});
  if(!res.ok){const t=await res.text().catch(()=>'');throw new Error('Trello '+res.status+(t?' — '+t.slice(0,120):''));}
  const ct=res.headers.get('content-type')||'';
  return ct.includes('json')?res.json():res.text();
}

// ---------- شاشة الإعدادات ----------
async function trelloSettings(){
  const c=await trelloLoadCreds();
  const r=await dialog({
    title:'إعدادات تكامل Trello',
    message:'بيانات الاعتماد تُخزَّن في قاعدة البيانات بصلاحية مالك المنصة وحده. لا تظهر لأي دور آخر ولا للعميل.',
    fields:[
      {key:'api_key',label:'API Key',value:(c&&c.api_key)||'',placeholder:'مفتاح الواجهة من إعدادات Power-Up'},
      {key:'token',label:'Token',value:(c&&c.token)||'',placeholder:'التوكن الناتج من صفحة التفويض'}
    ],
    confirmText:'حفظ واختبار الاتصال'
  });
  if(!r||!r.api_key||!r.token){if(r)toast('المفتاح والتوكن مطلوبان','warn');return;}
  try{
    await trelloSaveCreds(r.api_key.trim(),r.token.trim(),(c&&c.config)||{});
    const me=await trFetch('/members/me','GET','fields=username,fullName');
    toast('نجح الاتصال بحساب: '+(me.fullName||me.username),'ok');
  }catch(e){toast('تعذّر الاتصال: '+e.message,'err');}
}

// ---------- أدوات ----------
function trCardTitle(t){return t.id+' — '+t.name;}
function trCardDesc(t){
  const r=SCHED&&SCHED.R[t.id];
  const L=[];
  L.push('المرحلة: '+trackMeta(t.track).name);
  if(t.deliverable)L.push('المخرج: '+t.deliverable);
  if(t.owner)L.push('المسؤول: '+t.owner);
  if(r)L.push('المخطط: '+fmt(r.ES)+' → '+fmt(r.EF));
  L.push('');L.push('— تُدار الخطة من ALAMAH PMO. حرّك البطاقة بين القوائم لتحديث الحالة.');
  return L.join('\n');
}
function trListForTask(t){
  const k=TRACK&&TRACK[t.id];const st=(k&&k.effStatus)||t.status;
  if(t.status==='done')return 'done';
  if(st==='inprogress')return 'doing';
  return 'todo';
}
// بنود قابلة للتصدير: مهام ومعالم (بلا حزم ولا مستمر)
function trExportable(){return PROJECT.tasks.filter(t=>t.type!=='package'&&t.type!=='cont');}

// ---------- بناء/تعبئة اللوحة ----------
async function trelloSetupBoard(existingBoardId){
  await trelloLoadCreds();
  if(!TRELLO_CREDS||!TRELLO_CREDS.token){toast('اضبط إعدادات Trello من أدوات المكتب أولًا','warn');return;}
  if(!PROJECT){toast('افتح المشروع أولًا','warn');return;}
  const tasks=trExportable();
  if(!tasks.length){toast('لا بنود لتصديرها','warn');return;}
  let boardId=existingBoardId||null,boardUrl='';
  const L=$('#loader');
  try{
    if(!boardId){
      // اختيار مساحة العمل واسم اللوحة
      let orgs=[];try{orgs=await trFetch('/members/me/organizations','GET','fields=id,displayName');}catch(_e){}
      const f=[{key:'name',label:'اسم اللوحة',value:'ALAMAH — '+PROJECT.name}];
      if(orgs&&orgs.length)f.push({key:'org',label:'مساحة العمل',type:'select',value:orgs[0].id,
        options:orgs.map(o=>({v:o.id,t:o.displayName}))});
      const q=await dialog({title:'لوحة جديدة',
        message:'ستُنشأ لوحة خاصة بأربع قوائم تنفيذية و'+tasks.length+' بطاقة من بنود الخطة (بتواريخ الاستحقاق المحسوبة).',
        fields:f,confirmText:'إنشاء'});
      if(!q||!q.name)return;
      if(L)L.classList.remove('hidden');
      let p='name='+encodeURIComponent(q.name)+'&defaultLists=false&prefs_permissionLevel=private';
      if(q.org)p+='&idOrganization='+q.org;
      const board=await trFetch('/boards/','POST',p);
      boardId=board.id;boardUrl=board.url;
    }else{
      if(L)L.classList.remove('hidden');
      const b=await trFetch('/boards/'+boardId,'GET','fields=url');boardUrl=b.url;
    }
    // القوائم: نعيد استخدام الموجود وننشئ الناقص
    const existing=await trFetch('/boards/'+boardId+'/lists','GET','fields=id,name');
    const byName={};(existing||[]).forEach(l=>{byName[l.name]=l.id;});
    const listIds={};
    for(const l of TR_LISTS){
      if(byName[l.name]){listIds[l.key]=byName[l.name];continue;}
      const lst=await trFetch('/lists','POST','name='+encodeURIComponent(l.name)+'&idBoard='+boardId+'&pos=bottom');
      listIds[l.key]=lst.id;
    }
    // ملصقات المراحل
    const labelIds={};
    try{
      const labs=await trFetch('/boards/'+boardId+'/labels','GET','fields=id,name');
      const lbByName={};(labs||[]).forEach(l=>{if(l.name)lbByName[l.name]=l.id;});
      for(const tr of (PROJECT.tracks||[])){
        if(lbByName[tr.name]){labelIds[tr.key]=lbByName[tr.name];continue;}
        const lb=await trFetch('/labels','POST','name='+encodeURIComponent(tr.name)+'&color=null&idBoard='+boardId);
        labelIds[tr.key]=lb.id;
      }
    }catch(_e){}
    // البطاقات (تخطّي ما له بطاقة سلفًا)
    const {data:rows}=await sb.from('pmo_tasks').select('ref,trello_card_id').eq('project_id',PROJECT._dbId);
    const has={};(rows||[]).forEach(r=>{if(r.trello_card_id)has[r.ref]=1;});
    let n=0;
    for(const t of tasks){
      if(has[t.id])continue;
      const r=SCHED.R[t.id];
      let p='name='+encodeURIComponent(trCardTitle(t))
        +'&desc='+encodeURIComponent(trCardDesc(t))
        +'&idList='+listIds[trListForTask(t)]+'&pos=bottom';
      if(r)p+='&due='+encodeURIComponent(isoLocal(r.EF)+'T12:00:00.000Z');
      if(labelIds[t.track])p+='&idLabels='+labelIds[t.track];
      const card=await trFetch('/cards','POST',p);
      await sb.from('pmo_tasks').update({trello_card_id:card.id}).eq('id',t._dbId);
      const reqs=(t.requirements||[]);
      if(reqs.length){
        try{
          const cl=await trFetch('/checklists','POST','idCard='+card.id+'&name='+encodeURIComponent('المتطلبات'));
          for(const q of reqs)await trFetch('/checklists/'+cl.id+'/checkItems','POST',
            'name='+encodeURIComponent(q.desc||'متطلب')+'&checked='+(q.received?'true':'false'));
        }catch(_e){}
      }
      n++;
    }
    await sb.from('pmo_projects').update({trello_board_id:boardId}).eq('id',PROJECT._dbId);
    if(L)L.classList.add('hidden');
    await dialog({title:existingBoardId?'تم الربط':'أُنشئت اللوحة',
      message:(existingBoardId?'رُبط المشروع باللوحة، وأُضيفت ':'أُنشئت اللوحة و')+n+' بطاقة.\n\nالرابط:\n'+boardUrl,confirmText:'تمام'});
    toast('اللوحة جاهزة على Trello','ok');
  }catch(e){if(L)L.classList.add('hidden');toast('تعذّر: '+e.message,'err');}
}

// ---------- الدفع: المنصة ← Trello ----------
async function trelloPush(){
  await trelloLoadCreds();
  if(!PROJECT)return;
  const {data:pr}=await sb.from('pmo_projects').select('trello_board_id').eq('id',PROJECT._dbId).single();
  if(!pr||!pr.trello_board_id){toast('لا توجد لوحة مرتبطة — أنشئها أولًا','warn');return;}
  const L=$('#loader');if(L)L.classList.remove('hidden');
  try{
    const lists=await trFetch('/boards/'+pr.trello_board_id+'/lists','GET','fields=id,name');
    const byName={};lists.forEach(l=>byName[l.name]=l.id);
    const listIds={};TR_LISTS.forEach(l=>{listIds[l.key]=byName[l.name];});
    const {data:rows}=await sb.from('pmo_tasks').select('id,ref,trello_card_id').eq('project_id',PROJECT._dbId);
    const cardOf={};(rows||[]).forEach(r=>{cardOf[r.ref]=r.trello_card_id;});
    let upd=0,created=0;
    for(const t of trExportable()){
      const r=SCHED.R[t.id];
      const due=r?encodeURIComponent(isoLocal(r.EF)+'T12:00:00.000Z'):'';
      const cid=cardOf[t.id];
      if(cid){
        let p='name='+encodeURIComponent(trCardTitle(t))+'&desc='+encodeURIComponent(trCardDesc(t));
        if(due)p+='&due='+due;
        try{await trFetch('/cards/'+cid,'PUT',p);upd++;}catch(_e){}
      }else{
        let p='name='+encodeURIComponent(trCardTitle(t))+'&desc='+encodeURIComponent(trCardDesc(t))
          +'&idList='+listIds[trListForTask(t)]+'&pos=bottom';
        if(due)p+='&due='+due;
        const card=await trFetch('/cards','POST',p);
        await sb.from('pmo_tasks').update({trello_card_id:card.id}).eq('id',t._dbId);
        created++;
      }
    }
    if(L)L.classList.add('hidden');
    toast('اكتمل الدفع: '+upd+' تحديثًا · '+created+' بطاقة جديدة','ok');
  }catch(e){if(L)L.classList.add('hidden');toast('تعذّر الدفع: '+e.message,'err');}
}

// ---------- السحب: Trello ← المنصة (باعتماد بشري) ----------
async function trelloPull(){
  await trelloLoadCreds();
  if(!PROJECT)return;
  const {data:pr}=await sb.from('pmo_projects').select('trello_board_id').eq('id',PROJECT._dbId).single();
  if(!pr||!pr.trello_board_id){toast('لا توجد لوحة مرتبطة','warn');return;}
  const L=$('#loader');if(L)L.classList.remove('hidden');
  try{
    const [lists,cards]=await Promise.all([
      trFetch('/boards/'+pr.trello_board_id+'/lists','GET','fields=id,name'),
      trFetch('/boards/'+pr.trello_board_id+'/cards','GET','fields=id,name,idList,closed')
    ]);
    const listName={};lists.forEach(l=>{listName[l.id]=l.name;});
    const keyOf={};TR_LISTS.forEach(l=>{keyOf[l.name]=l.key;});
    const byCard={};PROJECT.tasks.forEach(t=>{});
    const {data:rows}=await sb.from('pmo_tasks').select('id,ref,status,trello_card_id').eq('project_id',PROJECT._dbId);
    const taskOfCard={};(rows||[]).forEach(r=>{if(r.trello_card_id)taskOfCard[r.trello_card_id]={db:r.id,ref:r.ref,status:r.status};});
    const props=[];
    cards.forEach(c=>{
      if(c.closed)return;
      const t=taskOfCard[c.id];if(!t)return;
      const k=keyOf[listName[c.idList]];
      let want=null;
      if(k==='doing')want='inprogress';
      else if(k==='done')want='done';
      else if(k==='review')want='inprogress';
      if(want&&want!==t.status)props.push({db:t.db,ref:t.ref,from:t.status,to:want,list:listName[c.idList]});
    });
    if(L)L.classList.add('hidden');
    if(!props.length){toast('لا تغييرات جديدة من Trello','ok');return;}
    const done=props.filter(p=>p.to==='done');
    const lines=props.slice(0,14).map(p=>'• '+p.ref+': '+(STATUS[p.from]||p.from)+' ← '+(STATUS[p.to]||p.to)+'  ('+p.list+')').join('\n');
    const more=props.length>14?('\n… و'+(props.length-14)+' أخرى'):'';
    const ok=await confirmDialog('تقرير المزامنة من Trello',
      props.length+' تحديثًا مقترحًا'+(done.length?('، منها '+done.length+' إنجاز يحتاج اعتمادك'):'')+':\n\n'+lines+more+
      '\n\nهل تعتمد تطبيقها على الخطة؟',done.length>0);
    if(!ok)return;
    for(const p of props)await sb.from('pmo_tasks').update({status:p.to}).eq('id',p.db);
    await loadProject(CID,PID);render();
    toast('طُبِّق '+props.length+' تحديثًا من Trello','ok');
  }catch(e){if(L)L.classList.add('hidden');toast('تعذّر السحب: '+e.message,'err');}
}

// ---------- القائمة ----------
async function trelloMenu(mode){
  if(mode==='settings')return trelloSettings();
  await trelloLoadCreds();
  if(!TRELLO_CREDS||!TRELLO_CREDS.token){
    await dialog({title:'لم يُضبط الاتصال بعد',
      message:'بيانات اعتماد Trello تُضبط مرة واحدة فقط لكل المنصة، من:\n\nالمحفظة ← ⚙ أدوات المكتب ← إعدادات Trello\n\n(بصلاحية مالك المنصة)',confirmText:'تمام'});
    return;
  }
  if(!PROJECT)return;
  const {data:pr}=await sb.from('pmo_projects').select('trello_board_id').eq('id',PROJECT._dbId).single();
  const linked=pr&&pr.trello_board_id;
  let bname='';
  if(linked){try{const b=await trFetch('/boards/'+linked,'GET','fields=name,url');bname=b.name;TRELLO_CREDS._url=b.url;}catch(_e){bname='(تعذّر قراءة اسم اللوحة)';}}
  const opts=linked
    ? [{v:'push',t:'دفع التحديثات إلى اللوحة'},{v:'pull',t:'سحب الحالات من اللوحة'},
       {v:'open',t:'فتح اللوحة في Trello'},{v:'unlink',t:'فكّ الارتباط بهذه اللوحة'}]
    : [{v:'new',t:'إنشاء لوحة جديدة لهذا المشروع'},{v:'link',t:'الربط بلوحة موجودة في حسابي'}];
  const r=await dialog({title:'لوحة Trello — '+PROJECT.name,
    message:linked?('اللوحة المرتبطة حاليًا: «'+bname+'»\n\nالمنصة مصدر الحقيقة للخطة؛ Trello سطح تنفيذ للفريق ولا يراه العميل.')
                  :'لا توجد لوحة مرتبطة بهذا المشروع بعد. اختر إنشاء لوحة جديدة أو الربط بواحدة موجودة.',
    fields:[{key:'a',label:'الإجراء',type:'select',value:opts[0].v,options:opts}],confirmText:'متابعة'});
  if(!r)return;
  if(r.a==='new')return trelloSetupBoard(null);
  if(r.a==='link')return trelloLinkExisting();
  if(r.a==='push')return trelloPush();
  if(r.a==='pull')return trelloPull();
  if(r.a==='open'){
    try{const b=await trFetch('/boards/'+linked,'GET','fields=url');
      await dialog({title:'رابط اللوحة',message:b.url,confirmText:'تمام'});}catch(e){toast('تعذّر','err');}
    return;
  }
  if(r.a==='unlink'){
    if(!await confirmDialog('فكّ الارتباط','سيُفكّ ربط المشروع بهذه اللوحة (اللوحة نفسها تبقى في Trello كما هي، ولن تُحذف). يمكنك الربط بلوحة أخرى بعدها.',true))return;
    await sb.from('pmo_projects').update({trello_board_id:null}).eq('id',PROJECT._dbId);
    await sb.from('pmo_tasks').update({trello_card_id:null}).eq('project_id',PROJECT._dbId);
    toast('فُكّ الارتباط','ok');
  }
}

// ---------- الربط بلوحة موجودة ----------
async function trelloLinkExisting(){
  const L=$('#loader');if(L)L.classList.remove('hidden');
  let boards=[];
  try{boards=await trFetch('/members/me/boards','GET','fields=id,name,closed&filter=open');}
  catch(e){if(L)L.classList.add('hidden');toast('تعذّر جلب اللوحات: '+e.message,'err');return;}
  if(L)L.classList.add('hidden');
  boards=(boards||[]).filter(b=>!b.closed);
  if(!boards.length){toast('لا لوحات مفتوحة في حسابك — أنشئ لوحة جديدة بدلًا من ذلك','warn');return;}
  const r=await dialog({title:'الربط بلوحة موجودة',
    message:'اختر لوحة من حسابك. سيتحقق النظام من وجود القوائم الأربع وينشئ الناقص منها، ثم يُنشئ بطاقات البنود التي لا بطاقة لها.',
    fields:[{key:'b',label:'اللوحة',type:'select',value:boards[0].id,options:boards.map(b=>({v:b.id,t:b.name}))}],
    confirmText:'ربط وتعبئة'});
  if(!r||!r.b)return;
  return trelloSetupBoard(r.b);
}

window.trelloMenu=trelloMenu;
window.trelloSettings=trelloSettings;

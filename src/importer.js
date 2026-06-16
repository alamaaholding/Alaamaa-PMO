// importer.js — مستورد خطة Excel ذكي ومرن
// يعتمد: $, esc, toast, dialog, confirmDialog, PROJECT, CID, ROLE, TRACKS, TYPES
// ودوال api: clearProjectPlan, bulkInsertTasks, bulkInsertDeps, fetchProjectTaskRefs, loadProject, render

// ===== خرائط المرادفات (مرنة: عربي/إنجليزي/تنويعات) =====
const SHEET_SYNONYMS={
  plan:['الخطة','خطة','المهام','مهام','plan','tasks','schedule','الجدول','الجدول الزمني','timeline','wbs'],
};
const COL_SYNONYMS={
  ref:['المعرف','المعرّف','معرف','رمز','id','ref','code','wbs','#'],
  name:['الاسم','اسم المهمة','المهمة','اسم','task name','name','task','المهمة / المرحلة','title'],
  name_en:['task name (en)','name en','english','الاسم الانجليزي','english name'],
  track:['المسار','مسار','track','phase','المرحلة','category','الفئة'],
  type:['النوع','نوع','type','kind'],
  duration:['المدة','مدة','duration','المدة (أيام عمل)','المدة (يوم)','days','أيام','المدة بالأيام'],
  deps:['يعتمد على','التبعيات','تبعيات','depends','dependency','dependencies','predecessor','predecessors','deps','يسبقه'],
  deliverable:['المخرج','مخرج','المخرجات','deliverable','output','outcome'],
  owner:['المسؤول','مسؤول','owner','responsible','assignee','الجهة'],
};

// تطبيع نص للمطابقة: تجريد، توحيد، إزالة تشكيل/علامات
function normTxt(s){
  if(s==null) return '';
  return String(s).trim().toLowerCase()
    .replace(/[\u064B-\u0652]/g,'')        // تشكيل عربي
    .replace(/[إأآا]/g,'ا').replace(/ة/g,'ه').replace(/[ىي]/g,'ي') // توحيد عربي
    .replace(/[_\-\.\/\\:()]/g,' ').replace(/\s+/g,' ').trim();
}
// مطابقة مرنة: تطابق كامل، أو احتواء، أو تشابه (مسافة ليفنشتاين قصيرة)
function lev(a,b){
  const m=a.length,n=b.length;if(!m)return n;if(!n)return m;
  const d=Array.from({length:m+1},(_,i)=>[i,...Array(n).fill(0)]);
  for(let j=0;j<=n;j++)d[0][j]=j;
  for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)
    d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  return d[m][n];
}
function fuzzyMatch(value, synonyms){
  const v=normTxt(value); if(!v) return false;
  for(const s of synonyms){
    const ns=normTxt(s);
    if(v===ns) return true;
    if(v.includes(ns)||ns.includes(v)) return true;
    // تشابه لطيف: مسافة ≤2 للكلمات القصيرة، ≤3 للأطول
    const tol=ns.length<=5?1:(ns.length<=10?2:3);
    if(lev(v,ns)<=tol) return true;
  }
  return false;
}

// إيجاد ورقة المهام في المصنّف
function findPlanSheet(wb){
  for(const name of wb.SheetNames){
    if(fuzzyMatch(name, SHEET_SYNONYMS.plan)) return name;
  }
  // إن لم نجد بالاسم: نأخذ أول ورقة فيها أعمدة معرّف+اسم
  for(const name of wb.SheetNames){
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1});
    if(detectHeaderRow(rows)>=0) return name;
  }
  return null;
}
// كشف صف الرؤوس: أول صف يحوي عمودي ref + name على الأقل
function detectHeaderRow(rows){
  for(let i=0;i<Math.min(rows.length,8);i++){
    const cells=(rows[i]||[]).map(c=>String(c||''));
    const hasRef=cells.some(c=>fuzzyMatch(c,COL_SYNONYMS.ref));
    const hasName=cells.some(c=>fuzzyMatch(c,COL_SYNONYMS.name));
    if(hasRef&&hasName) return i;
  }
  return -1;
}
// بناء خريطة الأعمدة من صف الرؤوس
function mapColumns(headerCells){
  const map={};
  headerCells.forEach((cell,idx)=>{
    for(const [key,syns] of Object.entries(COL_SYNONYMS)){
      if(map[key]!=null) continue;
      if(fuzzyMatch(cell,syns)){ map[key]=idx; break; }
    }
  });
  return map;
}
// تطبيع قيمة النوع
function normType(v){
  const n=normTxt(v);
  if(/معلم|milestone|gate|بوابه/.test(n)) return 'milestone';
  if(/مستمر|cont|continuous|ongoing/.test(n)) return 'cont';
  if(/ثابت|fixed/.test(n)) return 'fixed';
  return 'task';
}
// تطبيع المسار (أول حرف/رقم معروف)
function normTrack(v){
  const n=String(v||'').trim().toUpperCase();
  if(['0','A','B','C'].includes(n[0])) return n[0];
  // محاولة من كلمات
  const t=normTxt(v);
  if(/تاسيس|setup|readiness/.test(t)) return '0';
  if(/ذكاء|تحليل|intel|insight/.test(t)) return 'B';
  if(/استراتيج|strategy|قرار/.test(t)) return 'C';
  if(/تنفيذ|execution|experiment/.test(t)) return 'A';
  return '0';
}
function parseDeps(v){
  if(!v) return [];
  const s=String(v).trim();
  if(s==='—'||s==='-'||normTxt(s)==='لا'||s==='') return [];
  return s.split(/[,،;]/).map(x=>x.trim()).filter(x=>x&&x!=='—');
}

// ===== القراءة والتحليل =====
function parseWorkbook(arrayBuffer){
  const wb=XLSX.read(arrayBuffer,{type:'array'});
  const sheetName=findPlanSheet(wb);
  if(!sheetName) throw {ar:'لم أجد ورقة الخطة. تأكّد من وجود ورقة باسم «الخطة» أو «Tasks» فيها عمودا المعرّف والاسم.'};
  const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,blankrows:false});
  const hr=detectHeaderRow(rows);
  if(hr<0) throw {ar:`وجدت ورقة «${sheetName}» لكن لم أتعرّف على صف الرؤوس (يجب أن يحوي عمودي المعرّف والاسم).`};
  const cols=mapColumns(rows[hr].map(c=>String(c||'')));
  // أعمدة أساسية مفقودة
  const missing=[];
  if(cols.ref==null) missing.push('المعرّف');
  if(cols.name==null) missing.push('الاسم');
  if(missing.length) throw {ar:`أعمدة أساسية مفقودة في ورقة «${sheetName}»: ${missing.join('، ')}.`};

  const tasks=[]; const warnings=[]; const seen=new Set();
  for(let i=hr+1;i<rows.length;i++){
    const row=rows[i]||[];
    const ref=String(row[cols.ref]==null?'':row[cols.ref]).trim();
    if(!ref) continue; // صف فارغ أو عنوان مجموعة
    const name=cols.name!=null?String(row[cols.name]||'').trim():'';
    if(!name && !ref) continue;
    // تخطّي صفوف عناوين المجموعات (معرّف بلا اسم ولا مدة، أو يحوي "—")
    if(seen.has(ref)){ warnings.push(`معرّف مكرّر: «${ref}» — تم تجاهل التكرار.`); continue; }
    seen.add(ref);
    const durRaw=cols.duration!=null?row[cols.duration]:'';
    let duration=parseInt(String(durRaw).replace(/[^\d]/g,''),10); if(isNaN(duration))duration=0;
    const type=cols.type!=null?normType(row[cols.type]):'task';
    tasks.push({
      ref, name:name||ref,
      track:cols.track!=null?normTrack(row[cols.track]):'0',
      type, duration:(type==='milestone'||type==='cont')?0:duration,
      deps:cols.deps!=null?parseDeps(row[cols.deps]):[],
      deliverable:cols.deliverable!=null?String(row[cols.deliverable]||'').trim():'',
      owner:cols.owner!=null?String(row[cols.owner]||'').trim():'',
    });
  }
  if(!tasks.length) throw {ar:`ورقة «${sheetName}» لا تحوي مهامًا صالحة تحت صف الرؤوس.`};

  // تحقّق التبعيات: كل تبعية يجب أن تشير لمعرّف موجود
  const refs=new Set(tasks.map(t=>t.ref));
  const depPairs=[];
  tasks.forEach(t=>t.deps.forEach(d=>{
    if(refs.has(d)) depPairs.push([t.ref,d]);
    else warnings.push(`المهمة «${t.ref}» تعتمد على «${d}» غير الموجود — تم تجاهل هذه التبعية.`);
  }));
  // كشف الدورات (تبعية دائرية)
  const cycle=detectCycle(tasks, depPairs);
  if(cycle) warnings.push(`تحذير: دورة تبعية محتملة عبر: ${cycle.join(' → ')} — راجع التبعيات.`);

  return {sheetName, colsFound:Object.keys(cols), tasks, depPairs, warnings};
}
// كشف دورة بسيط (DFS)
function detectCycle(tasks, depPairs){
  const adj={}; tasks.forEach(t=>adj[t.ref]=[]);
  depPairs.forEach(([a,b])=>{ if(adj[a])adj[a].push(b); });
  const state={}; let found=null;
  function dfs(n,path){
    if(found)return; state[n]='gray';
    for(const m of adj[n]||[]){
      if(state[m]==='gray'){ found=[...path,n,m]; return; }
      if(!state[m]) dfs(m,[...path,n]);
    }
    state[n]='black';
  }
  for(const t of tasks){ if(!state[t.ref]) dfs(t.ref,[]); if(found)break; }
  return found;
}

// ===== واجهة الاستيراد =====
function openImporter(){
  if(!PROJECT){ toast('افتح مشروعًا أولًا','warn'); return; }
  if(PROJECT.status==='baselined'){ toast('الخطة مثبّتة — لا يمكن الاستيراد. يتطلب طلب تغيير.','warn'); return; }
  const ov=$('#impOverlay'); ov.style.display='flex';
  $('#impBody').innerHTML=`
    <div class="imp-hint">
      <b>الورقة المتوقّعة:</b> «الخطة» أو «Tasks» أو «المهام» (الأسماء المتقاربة تُقبل تلقائيًا).<br>
      <b>الأعمدة الأساسية:</b> <span class="imp-col">المعرّف</span> <span class="imp-col">الاسم</span> (إلزامية)،
      و<span class="imp-col">المسار</span> <span class="imp-col">النوع</span> <span class="imp-col">المدة</span>
      <span class="imp-col">يعتمد على</span> <span class="imp-col">المخرج</span> <span class="imp-col">المسؤول</span> (اختيارية).<br>
      <small>المسمّيات بالعربي أو الإنجليزي والتنويعات اللطيفة مقبولة. التواريخ تُحسب آليًا من التبعيات — لا حاجة لإدخالها.</small>
    </div>
    <label class="imp-drop">
      <input type="file" id="impFile" accept=".xlsx,.xls" style="display:none">
      <span class="imp-drop-txt">📄 اختر ملف Excel (.xlsx) للرفع</span>
    </label>
    <div id="impResult"></div>`;
  $('#impFile').onchange=handleImpFile;
}
async function handleImpFile(e){
  const file=e.target.files[0]; if(!file) return;
  const res=$('#impResult');
  res.innerHTML='<div class="skeleton" style="height:50px"></div>';
  try{
    const buf=await file.arrayBuffer();
    const parsed=parseWorkbook(buf);
    IMP_DATA=parsed;
    renderImpPreview(parsed);
  }catch(err){
    const msg=err&&err.ar?err.ar:(err&&err.message?err.message:'تعذّرت قراءة الملف. تأكّد أنه ملف Excel صالح.');
    res.innerHTML=`<div class="imp-err"><b>تعذّر الاستيراد:</b><br>${esc(msg)}</div>`;
  }
}
let IMP_DATA=null;
function renderImpPreview(p){
  const tcount=p.tasks.length, dcount=p.depPairs.length, mcount=p.tasks.filter(t=>t.type==='milestone').length;
  const warns=p.warnings.length
    ? `<div class="imp-warn"><b>ملاحظات (${p.warnings.length}):</b><ul>${p.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></div>`
    : '<div class="imp-ok">لا تحذيرات — الملف سليم.</div>';
  const sample=p.tasks.slice(0,6).map(t=>`<tr><td>${esc(t.ref)}</td><td>${esc(t.name)}</td><td>${esc(t.track)}</td><td>${TYPES[t.type]||t.type}</td><td>${t.duration||'—'}</td><td>${esc(t.deps.join('، ')||'—')}</td></tr>`).join('');
  $('#impResult').innerHTML=`
    <div class="imp-summary">
      ✓ قُرئت ورقة «${esc(p.sheetName)}»: <b>${tcount}</b> مهمة · <b>${mcount}</b> معلم · <b>${dcount}</b> تبعية.
    </div>
    ${warns}
    <div class="imp-tablewrap"><table class="imp-table"><thead><tr><th>المعرّف</th><th>الاسم</th><th>المسار</th><th>النوع</th><th>المدة</th><th>يعتمد على</th></tr></thead><tbody>${sample}</tbody>${tcount>6?`<tfoot><tr><td colspan="6">… و${tcount-6} مهمة أخرى</td></tr></tfoot>`:''}</table></div>
    <div class="imp-actions">
      <button class="hbtn" id="impMerge" style="background:var(--blue);border-color:var(--blue)">دمج مع الموجود</button>
      <button class="hbtn" id="impReplace" style="background:var(--crit);border-color:var(--crit)">استبدال كامل</button>
      <button class="hbtn" id="impCancel" style="background:#fff;color:var(--ink);border-color:var(--line)">إلغاء</button>
    </div>`;
  $('#impMerge').onclick=()=>runImport('merge');
  $('#impReplace').onclick=()=>runImport('replace');
  $('#impCancel').onclick=()=>{$('#impOverlay').style.display='none';};
}
async function runImport(mode){
  if(!IMP_DATA) return;
  if(mode==='replace'){
    const ok=await confirmDialog('تأكيد الاستبدال','سيُحذف كل محتوى الخطة الحالي ويُستبدل بالملف. هل أنت متأكد؟',true);
    if(!ok) return;
  }
  const btn=$('#impMerge'); if(btn)btn.disabled=true;
  $('#impResult').insertAdjacentHTML('afterbegin','<div class="imp-summary" id="impProg">جارٍ الاستيراد…</div>');
  try{
    let tasks=IMP_DATA.tasks, depPairs=IMP_DATA.depPairs;
    if(mode==='replace'){
      await clearProjectPlan(PROJECT._dbId);
    }else{
      // دمج: نتجاهل المهام التي معرّفها موجود (نُبقي الموجود)
      const existing=await fetchProjectTaskRefs(PROJECT._dbId);
      const exRefs=new Set(existing.map(r=>r.ref));
      const before=tasks.length;
      tasks=tasks.filter(t=>!exRefs.has(t.ref));
      const skipped=before-tasks.length;
      if(skipped>0) toast(`الدمج: ${skipped} مهمة موجودة بالفعل تم تخطّيها`,'warn');
    }
    const refToId=await bulkInsertTasks(PROJECT._dbId, tasks);
    // للدمج: نحتاج خريطة شاملة (الموجود + الجديد) لربط التبعيات
    if(mode==='merge'){
      const all=await fetchProjectTaskRefs(PROJECT._dbId);
      all.forEach(r=>{ refToId[r.ref]=r.id; });
    }
    const dn=await bulkInsertDeps(PROJECT._dbId, depPairs, refToId);
    $('#impOverlay').style.display='none';
    toast(`تم الاستيراد: ${Object.keys(refToId).length? tasks.length:0} مهمة و${dn} تبعية · التواريخ محسوبة آليًا`,'ok');
    await loadProject(CID); render();
  }catch(err){
    const msg=err&&err.message?err.message:'خطأ غير متوقّع';
    $('#impResult').insertAdjacentHTML('afterbegin',`<div class="imp-err">تعذّر الاستيراد: ${esc(msg)}</div>`);
    if(btn)btn.disabled=false;
  }
}

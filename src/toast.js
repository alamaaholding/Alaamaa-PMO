// ═══════════════════════════════════════════════════════════════════════
//  toast.js — الإشعارات العابرة (وحدة ESM)
// ═══════════════════════════════════════════════════════════════════════
//
//  لماذا خرجت من app/main.js: هي `esc` مرة أخرى — دالة صغيرة مدفونة في أكبر
//  ملف، تستدعيها كل المنصّة فتصنع دورة في المخطط. القياس:
//
//      views.js  →  toast × ٢٥   (من أصل ٤٠ اسمًا تحتاجها من main.js)
//      api.js    →  toast × ٤    (ولا تحتاج من main.js غيرها إلا startApp مرة)
//
//  فإخراجها يقطع اعتماد api.js على main.js عمليًا، ويُنقص أثقل خيط بين
//  views.js وmain.js. وهذا هو الدرس المتكرّر منذ format.js: الدورات تأتي من
//  المساعدات المدفونة، لا من الملفات الكبيرة.
//
//  وموضعها هنا مقصود لسبب ثانٍ: **مركز الإشعارات في W5 يبدأ من هذا الملف.**
//  التشخيص رصد أن الخطأ يختفي بعد ٣٫٢ ثانية بلا أثر يُراجَع — وعلاج ذلك يحتاج
//  جهة واحدة تملك كل إشعار في المنصّة. هذه هي.

/** إشعار عابر. kind: ok | err | warn | (افتراضي) */
export function toast(msg, kind){
  const wrap=document.getElementById('toastWrap'); if(!wrap)return;
  const t=document.createElement('div'); t.className='toast'+(kind?' '+kind:'');
  const icon=kind==='ok'?'✓':kind==='err'?'✕':kind==='warn'?'⚠':'•';
  t.innerHTML='<span>'+icon+'</span><span>'+msg+'</span>';
  wrap.appendChild(t);
  setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),300);},3200);
}

/** توست بزر تراجع (يبقى 8 ثوانٍ) */
export function toastUndo(msg,onUndo){
  const wrap=document.getElementById('toastWrap'); if(!wrap)return;
  const t=document.createElement('div'); t.className='toast undo';
  t.innerHTML='<span>🗑</span><span>'+msg+'</span><button class="undo-btn">تراجع</button>';
  wrap.appendChild(t);
  const tm=setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),300);},8000);
  t.querySelector('.undo-btn').onclick=async()=>{clearTimeout(tm);t.remove();
    try{await onUndo();}catch(e){toast('تعذّر التراجع: '+e.message,'err');}};
}

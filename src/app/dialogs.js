// ===== app/dialogs.js — جزء من طبقة التطبيق (مقسّم من app.js) =====
function dialog(opts){ // {title, message, fields:[{key,label,value,type,placeholder,options}], confirmText, danger}
  return new Promise(resolve=>{
    const ov=document.getElementById('dlgOverlay');
    const fieldsHtml=(opts.fields||[]).map(f=>{
      if(f.type==='select'){
        return `<label class="dlg-l">${esc(f.label)}<select class="dlg-i" data-k="${f.key}">${f.options.map(o=>`<option value="${o.v}" ${o.v===f.value?'selected':''}>${esc(o.t)}</option>`).join('')}</select></label>`;
      }
      if(f.type==='textarea'){
        return `<label class="dlg-l">${esc(f.label)}<textarea class="dlg-i" data-k="${f.key}" placeholder="${esc(f.placeholder||'')}">${esc(f.value||'')}</textarea></label>`;
      }
      return `<label class="dlg-l">${esc(f.label)}<input class="dlg-i" data-k="${f.key}" type="${f.type||'text'}" value="${esc(f.value||'')}" placeholder="${esc(f.placeholder||'')}"></label>`;
    }).join('');
    document.getElementById('dlgBox').innerHTML=`
      <div class="rqhd"><h3 style="font-size:1.02rem" id="dlgTitle">${esc(opts.title||'')}</h3><button id="dlgX" aria-label="إغلاق" style="background:none;border:none;color:#fff;font-size:1.3rem;cursor:pointer">✕</button></div>
      <div style="padding:18px">
        ${opts.message?`<p style="font-size:.86rem;color:var(--muted);margin-bottom:14px;line-height:1.7;white-space:pre-line">${esc(opts.message)}</p>`:''}
        ${fieldsHtml}
        <div style="display:flex;gap:10px;margin-top:18px;justify-content:flex-start">
          <button class="hbtn" id="dlgOk" style="background:${opts.danger?'var(--crit)':'var(--gold)'};border-color:${opts.danger?'var(--crit)':'var(--gold)'};padding:9px 20px">${esc(opts.confirmText||'تأكيد')}</button>
          <button class="hbtn" id="dlgCancel" style="background:#fff;color:var(--ink);border-color:var(--line);padding:9px 20px">إلغاء</button>
        </div>
      </div>`;
    const box=document.getElementById('dlgBox');
    box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-labelledby','dlgTitle');
    ov.style.display='flex';
    const prevFocus=document.activeElement;
    const first=document.querySelector('#dlgBox .dlg-i')||document.getElementById('dlgOk');if(first)setTimeout(()=>first.focus(),50);
    const close=val=>{ov.style.display='none';document.removeEventListener('keydown',keyH,true);if(prevFocus&&prevFocus.focus)prevFocus.focus();resolve(val);};
    const collect=()=>{ if(!opts.fields||!opts.fields.length)return true; const o={}; document.querySelectorAll('#dlgBox .dlg-i').forEach(i=>o[i.dataset.k]=i.value.trim()); return o; };
    // لوحة المفاتيح: Escape يغلق، Tab محبوس داخل الحوار
    const keyH=e=>{
      if(e.key==='Escape'){e.preventDefault();close(null);return;}
      if(e.key==='Tab'){
        const f=[...box.querySelectorAll('button,input,select,textarea')].filter(x=>!x.disabled);
        if(!f.length)return;
        const i=f.indexOf(document.activeElement);
        if(e.shiftKey&&(i<=0)){e.preventDefault();f[f.length-1].focus();}
        else if(!e.shiftKey&&(i===f.length-1)){e.preventDefault();f[0].focus();}
      }
    };
    document.addEventListener('keydown',keyH,true);
    document.getElementById('dlgOk').onclick=()=>close(collect());
    document.getElementById('dlgCancel').onclick=()=>close(null);
    document.getElementById('dlgX').onclick=()=>close(null);
    ov.onclick=e=>{if(e.target.id==='dlgOverlay')close(null);};
    document.querySelectorAll('#dlgBox .dlg-i').forEach(i=>i.addEventListener('keydown',e=>{if(e.key==='Enter'&&i.tagName!=='TEXTAREA'){e.preventDefault();close(collect());}}));
  });
}

async function confirmDialog(title,message,danger){
  const r=await dialog({title,message,confirmText:danger?'حذف':'تأكيد',danger});
  return r!==null;
}


// ===== بدء التطبيق =====

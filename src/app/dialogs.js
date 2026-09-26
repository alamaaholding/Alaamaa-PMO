// ===== app/dialogs.js — الحوار الموحَّد (وحدة ESM) =====
//
// اعتمادها الوحيد خارجها كان `esc` من views.js — دالة سطر واحد في ملف من ٩٨٢
// سطرًا. بانتقال `esc` إلى format.js صار هذا الملف قابلًا للتحويل بلا أن يجرّ
// طبقة العرض كلها معه.
//
// opts.html: HTML جاهز يُدرَج بين الرسالة والحقول (للمحتوى المُنسَّق كجدول الفروق).
// يُبنى داخليًا فقط ولا يقبل مدخلات مستخدم خامًا.
import { esc } from '../format.js';
import { $$, byId } from '../config.js';

export function dialog(opts){ // {title, message, html, fields:[{key,label,value,type,placeholder,options}], confirmText, danger}
  return new Promise(resolve=>{
    const ov=byId('dlgOverlay');
    const fieldsHtml=(opts.fields||[]).map(f=>{
      if(f.type==='select'){
        return `<label class="dlg-l">${esc(f.label)}<select class="dlg-i" data-k="${f.key}">${f.options.map(o=>`<option value="${o.v}" ${o.v===f.value?'selected':''}>${esc(o.t)}</option>`).join('')}</select></label>`;
      }
      if(f.type==='textarea'){
        return `<label class="dlg-l">${esc(f.label)}<textarea class="dlg-i" data-k="${f.key}" placeholder="${esc(f.placeholder||'')}">${esc(f.value||'')}</textarea></label>`;
      }
      return `<label class="dlg-l">${esc(f.label)}<input class="dlg-i" data-k="${f.key}" type="${f.type||'text'}" value="${esc(f.value||'')}" placeholder="${esc(f.placeholder||'')}"></label>`;
    }).join('');
    byId('dlgBox').innerHTML=`
      <div class="rqhd"><h3 id="dlgTitle">${esc(opts.title||'')}</h3><button id="dlgX" aria-label="إغلاق" class="rq-x">✕</button></div>
      <div class="p-18">
        ${opts.message?`<p class="dlg-msg">${esc(opts.message)}</p>`:''}
        ${opts.html||''}
        ${fieldsHtml}
        <div class="row-10 mt-18 jc-start">
          <button class="hbtn" id="dlgOk" data-css="background:${opts.danger?'var(--crit)':'var(--gold)'};border-color:${opts.danger?'var(--crit)':'var(--gold)'};padding:9px 20px">${esc(opts.confirmText||'تأكيد')}</button>
          <button class="hbtn btn-plain bordered p-9-20" id="dlgCancel">إلغاء</button>
        </div>
      </div>`;
    const box=byId('dlgBox');
    box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-labelledby','dlgTitle');
    ov.style.display='flex';
    const prevFocus=document.activeElement;
    const first=document.querySelector('#dlgBox .dlg-i')||byId('dlgOk');if(first)setTimeout(()=>first.focus(),50);
    const close=val=>{ov.style.display='none';document.removeEventListener('keydown',keyH,true);if(prevFocus&&prevFocus.focus)prevFocus.focus();resolve(val);};
    const collect=()=>{ if(!opts.fields||!opts.fields.length)return true; const o={}; $$('#dlgBox .dlg-i').forEach(i=>o[i.dataset.k]=i.value.trim()); return o; };
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
    byId('dlgOk').onclick=()=>close(collect());
    byId('dlgCancel').onclick=()=>close(null);
    byId('dlgX').onclick=()=>close(null);
    ov.onclick=e=>{if(e.target.id==='dlgOverlay')close(null);};
    $$('#dlgBox .dlg-i').forEach(i=>i.addEventListener('keydown',e=>{if(e.key==='Enter'&&i.tagName!=='TEXTAREA'){e.preventDefault();close(collect());}}));
  });
}

export async function confirmDialog(title,message,danger,confirmText){
  const r=await dialog({title,message,confirmText:confirmText||'تأكيد',danger});
  return r!==null;
}


// ===== بدء التطبيق =====

// ===== dcss.js — الهندسةُ المحسوبة: سمةُ بياناتٍ لا سمةَ أسلوب =====
//
// بقي في الترميز بعد الدفعة السابقة **٩٢ نمطًا سطريًّا ديناميكيًّا**: عرضُ
// شريطٍ بالبكسل، إزاحتُه على محور الزمن، لونُ مسارٍ آتٍ من القاعدة. وهذه
// لا تصير أصنافًا — فقيمتُها تُحسَب لكل عنصرٍ على حدة، ولا يُعرَف عددُها
// سلفًا كي يُكتَب لها صنف.
//
// لكنّ بقاءها سمةَ `style=` في الترميز يُبقي `'unsafe-inline'` في
// `style-src`، وهي ثغرةٌ حقيقية: من استطاع حقنَ ترميزٍ في الصفحة استطاع
// معها حقنَ أسلوبٍ يُخفي زرًّا أو يُغطّي الشاشة أو يُسرِّب قيمةَ حقلٍ عبر
// مُحدِّدِ سمة. والقيدُ الذي تفرضه CSP قيدٌ على **الترميز** لا على الكود:
// `el.style.setProperty` نداءُ CSSOM، وهو خارج حكم `style-src` بالتعريف.
//
// فالتحويل هنا تحويلُ **حاملٍ** لا تحويلُ قيمة: تُبَثّ التصريحات نفسها
// حرفًا بحرف في `data-css`، ثم تُنقَل إلى `el.style` بعد التصيير. والقيمة
// الظاهرة للمتصفح واحدة — أسلوبٌ سطريٌّ بأعلى أولوية — والفرق كلُّه في
// **من كتبها**: الترميز أم الكود.
//
// ═══ لماذا مُراقِبٌ عامّ لا نداءٌ عند كل تصيير ═══
// مواضعُ `innerHTML=` في المشروع عشرات، ونسيانُ نداءٍ واحدٍ منها يعني
// عنصرًا بلا هندسة **بلا أن يفشل اختبار**. فالمُراقِب يلتقط كل إدراجٍ في
// الشجرة مرةً واحدة وللأبد. وتوقيتُه ليس تأخيرًا مرئيًّا: نداءُ
// MutationObserver مهمّةٌ دقيقة (microtask) تسبق أولَ رسمٍ للمتصفح.
//
// ═══ وأين لا يكفي المُراقِب ═══
// من يقيس **في النبضة نفسها** لا ينتظر المهمة الدقيقة: `drawGanttLinks`
// تقرأ `getBoundingClientRect` للأشرطة فور إسناد `innerHTML`. فمن قاس
// طبّق أولًا صراحةً — والتطبيقُ مُتماثلٌ (idempotent) فلا ضرر في تكراره.

// تصريحاتُ `data-css` تُقسَم على الفاصلة المنقوطة **في العمق صفر** وحده:
// `background:color-mix(in srgb,var(--x) 14%,#fff)` قوسٌ لا فاصلةَ فيه اليوم،
// لكنّ القسمة الساذجة تنكسر يوم يدخل `url(...)` أو دالةٌ ذات فاصلة منقوطة.
export function parseDecls(text){
  const out=[];
  if(!text)return out;
  let depth=0,start=0;
  const take=chunk=>{
    const s=chunk.trim();if(!s)return;
    const i=s.indexOf(':');if(i<1)return;
    out.push([s.slice(0,i).trim(),s.slice(i+1).trim()]);
  };
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='(')depth++;
    else if(ch===')'){if(depth)depth--;}
    else if(ch===';'&&!depth){take(text.slice(start,i));start=i+1;}
  }
  take(text.slice(start));
  return out;
}

// عنصرٌ واحد. تبقى السمة بعد التطبيق عمدًا: هي **الأصل** الذي يشرح من أين
// جاءت الهندسة، وإعادةُ التطبيق عليها لا تُغيّر شيئًا.
function styleOne(el){
  for(const [prop,val] of parseDecls(el.getAttribute('data-css')))el.style.setProperty(prop,val);
}

// العقدةُ نفسها وكلّ ذريّتها. تُعيد عدد العناصر المطبَّقة — رقمٌ يستجوبه الاختبار.
export function applyDataCss(node){
  if(!node||node.nodeType!==1)return 0;
  let n=0;
  if(node.hasAttribute('data-css')){styleOne(node);n++;}
  const kids=node.querySelectorAll('[data-css]');
  for(const el of kids){styleOne(el);n++;}
  return n;
}

let OBSERVER=null;

export function watchDataCss(doc){
  const d=doc||(typeof document!=='undefined'?document:null);
  if(!d||!d.documentElement||typeof MutationObserver==='undefined')return null;
  if(OBSERVER)OBSERVER.disconnect();
  // ما كان في الصفحة قبل تركيب المُراقِب لا يصله سجلٌّ — فيُطبَّق مرةً ابتداءً.
  applyDataCss(d.documentElement);
  OBSERVER=new MutationObserver(recs=>{
    for(const r of recs){
      if(r.type==='attributes'){if(r.target&&r.target.nodeType===1)styleOne(r.target);}
      else for(const node of r.addedNodes)applyDataCss(node);
    }
  });
  OBSERVER.observe(d.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-css']});
  return OBSERVER;
}

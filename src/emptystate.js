// ═══════════════════════════════════════════════════════════════════════
//  emptystate.js — الحالة الفارغة (وحدة ESM)
// ═══════════════════════════════════════════════════════════════════════
//
//  ثماني أسطر كانت في views.js — الملف الأكبر في المشروع (٧٢ KB). وكان ذلك
//  وحده يربط `app/workload.js` و`app/clienthome.js` بجدول المشروع كله.
//
//  والنمط هو نفسه المتكرّر في كل موجة W2 (`esc` · `todayISO` · `toast` ·
//  `hideChrome`): **العقدة مساعدٌ صغير مدفون في ملف كبير، لا الملف الكبير.**
//
//  وهي شقيقة `skeleton.js`: تلك ما يُعرَض **أثناء** التحميل، وهذه ما يُعرَض
//  **بعده حين لا توجد بيانات**. بقيتا ملفّين لأن لكلٍّ مستهلكيها.

import { esc } from './format.js';

/**
 * حالة فارغة موحَّدة.
 *
 * @param {{icon?:string,title?:string,hint?:string,wrap?:string}} o
 *   `wrap` يغيّر الوسم الحاوي — `li` حين تُدرَج داخل قائمة، وإلا `div`.
 *   والأيقونة `aria-hidden` عمدًا: زخرفة لا معنى، والعنوان هو النص المقروء.
 *   ولا يُهرَّب `icon` لأنه ثابت في الكود دائمًا؛ والعنوان والتلميح يُهرَّبان.
 */
export function emptyState(o){
  o=o||{};
  const inner=`${o.icon?`<span class="empty-state-icon" aria-hidden="true">${o.icon}</span>`:''}
    <b>${esc(o.title||'لا شيء هنا بعد')}</b>
    ${o.hint?`<span class="empty-state-hint">${esc(o.hint)}</span>`:''}`;
  const tag=o.wrap||'div';
  return `<${tag} class="empty-state">${inner}</${tag}>`;
}

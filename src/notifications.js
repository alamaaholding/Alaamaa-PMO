// ═══════════════════════════════════════════════════════════════════════
//  notifications.js — سجلّ الإشعارات ومركزها (وحدة ESM · الموجة W5)
// ═══════════════════════════════════════════════════════════════════════
//
//  المشكلة كما قِيست، لا كما تُخمَّن:
//
//      ١٩٣ كتلة catch في المشروع
//       ٩٩ منها تُخبر المستخدم بـtoast
//       ٤٥ منها **فارغة تمامًا** — الخطأ يُبتلع بلا أثر
//        ٠ منها تُسجّل في الطرفية
//
//  والصفر الأخير هو المفاجأة: **لا سطر console واحد في المصدر كلّه.** فكل خطأ
//  في المنصّة إمّا توست يعيش ٣٫٢ ثانية ثم يزول، أو لا شيء إطلاقًا. ولا موضع
//  ثالث يُراجَع بعد فوات اللحظة — لا في الواجهة ولا في الطرفية.
//
//  الأثر العملي: مستخدم يبتعد عن الشاشة ثانيتين فيفقد الخبر نهائيًا. وخطآن
//  يقعان معًا فيغطّي أحدهما الآخر. ومن يقول «ظهرت لي رسالة حمراء ولا أذكرها»
//  لا سبيل لمساعدته — لا يوجد ما يُقرأ.
//
//  ═══ ما تفعله هذه الوحدة ═══
//  تُبقي **سجلًّا واحدًا** لكل إشعار مرّ في المنصّة، ويُفتح في مركز يُراجَع
//  متى شاء المستخدم. التوست يبقى كما هو — إشعار عابر لا يُزعج؛ الجديد أنه لم
//  يعد المكان **الوحيد** الذي يعيش فيه الخبر.
//
//  ═══ لماذا الذاكرة لا localStorage ═══
//  قرار مقصود. رسائل الأخطاء تحمل نصوص خادم قد تتضمّن معرّفات أو أسماء عملاء،
//  وتخزينها على جهاز مشترك يوسّع سطح التسريب بلا مقابل. والسجلّ سياقه الجلسة:
//  بعد إعادة التحميل انتهى ما كان يُشخَّص. فحدّه عمر التبويب.
//
//  ═══ حدّ السعة ═══
//  حلقة بـ٢٠٠ مدخل. سجلّ بلا حدّ تسريبُ ذاكرة في جلسة طويلة، ودورة مزامنة
//  واحدة مع Trello قد تُطلق عشرات الإشعارات.

import { esc, fmt } from './format.js';

const CAP = 200;
const log = [];
let seq = 0;

//  ═══ المرجع للدعم ═══
//  «ظهرت لي رسالة حمراء» لا يكفي لتشخيص شيء. فلكل إشعار مرجعٌ يُنسخ ويُرسَل:
//  رمز جلسة قصير + رقم تسلسلي. الرمز يميّز الجلسة (تبويبان مفتوحان ليسا واحدًا)،
//  والرقم يحدّد الترتيب داخلها — فيعرف من يساعد **أيّ** خطأ وفي أي تسلسل وقع.
//  عشوائي بلا معنى في ذاته: لا يحمل هوية ولا يصلح للتتبّع، وينتهي بانتهاء التبويب.
const SESSION_REF = Math.random().toString(36).slice(2, 7).toUpperCase();
export const refOf = e => `${SESSION_REF}-${e.id}`;
let lastSeen = 0;
const listeners = new Set();

/** نوع غير معروف يُعامَل كإشعار عادي — لا يُسقط شيئًا ولا يُخفي الخبر. */
const KINDS = { ok: 'نجاح', err: 'خطأ', warn: 'تنبيه', info: 'إشعار' };
const kindOf = k => (k && KINDS[k] ? k : 'info');

/**
 * تسجيل إشعار. تستدعيها toast() لكل ما يمرّ بها — فالسجلّ مرآة كاملة لما
 * رآه المستخدم، لا مجموعة منتقاة.
 */
export function record(msg, kind) {
  const entry = { id: ++seq, msg: String(msg == null ? '' : msg), kind: kindOf(kind), at: new Date() };
  log.push(entry);
  if (log.length > CAP) log.splice(0, log.length - CAP);
  listeners.forEach(fn => { try { fn(entry); } catch (e) {} });
  return entry;
}

/** نسخة من السجلّ، الأحدث أولًا. نسخة لا مرجع — كي لا يعدّله مستهلك. */
export function notifications() { return log.slice().reverse(); }

/** كم إشعارًا وصل بعد آخر مرة فُتح فيها المركز. */
export function unseenCount() { return log.filter(e => e.id > lastSeen).length; }

/** كم منها خطأ — الشارة تُميّزها لأن الخطأ وحده يستحق مقاطعة المستخدم. */
export function unseenErrors() { return log.filter(e => e.id > lastSeen && e.kind === 'err').length; }

export function markAllSeen() { lastSeen = seq; notify(); }

export function clearNotifications() { log.length = 0; lastSeen = seq; notify(); }

/** اشتراك يُستدعى عند كل تغيّر. يُرجع دالة إلغاء. */
export function onNotification(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function notify() { listeners.forEach(fn => { try { fn(null); } catch (e) {} }); }

const ICON = { ok: '✓', err: '✕', warn: '⚠', info: '•' };
const time = d => String(d.getHours()).padStart(2, '0') + ':' +
                  String(d.getMinutes()).padStart(2, '0') + ':' +
                  String(d.getSeconds()).padStart(2, '0');

/** يوم الإشعار — يظهر فقط إن لم يكن اليوم، فلا يُزحم السطر بما لا يفيد. */
const dayOf = d => {
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return sameDay ? '' : fmt(d);
};

/** النص الذي يُنسَخ: كل ما يحتاجه من يساعد، في سطر واحد. */
export function copyTextOf(e) {
  return `[${refOf(e)}] ${KINDS[e.kind]} · ${e.at.toISOString()}\n${e.msg}`;
}

/** بناء صفّ واحد. النص مُرمَّز — نفس السبب الذي أُصلح في toast. */
function rowHtml(e) {
  const day = dayOf(e.at);
  return `<li class="ntf-row ntf-${e.kind}">
    <span class="ntf-ic" aria-hidden="true">${ICON[e.kind]}</span>
    <span class="ntf-msg">${esc(e.msg)}</span>
    <span class="ntf-meta">
      <time class="ntf-at" datetime="${e.at.toISOString()}">${day ? esc(day) + ' ' : ''}${time(e.at)}</time>
      <code class="ntf-ref">${esc(refOf(e))}</code>
    </span>
    <button class="ntf-copy" data-ntf-copy="${e.id}" aria-label="نسخ الإشعار ${esc(refOf(e))}">نسخ</button>
  </li>`;
}

/**
 * النسخ إلى الحافظة. `navigator.clipboard` غير متاح في كل سياق (بروتوكول غير
 * آمن، أو رفض المستخدم)، فثمّة مسار احتياطي بـtextarea مؤقتة — والفشل التام
 * يُبلَّغ عنه بدل أن يُبتلع، فالمستخدم كان ينسخ نصًّا يحتاجه.
 */
export async function copyEntry(id) {
  const e = log.find(x => x.id === Number(id));
  if (!e) return false;
  const text = copyTextOf(e);
  try {
    if (globalThis.navigator && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.className = 'ntf-copy-sink';
    document.body.appendChild(ta);
    ta.select();
    const done = document.execCommand && document.execCommand('copy');
    ta.remove();
    return !!done;
  } catch (err) { return false; }
}

export function renderNotificationCenter() {
  const body = document.getElementById('ntfBody');
  if (!body) return;
  const items = notifications();
  const errs = items.filter(e => e.kind === 'err').length;
  body.innerHTML = items.length
    ? `<p class="ntf-sum">${items.length} إشعارًا${errs ? ` · <b class="ntf-sum-err">${errs} خطأ</b>` : ''}</p>
       <ul class="ntf-list">${items.map(rowHtml).join('')}</ul>`
    : `<p class="pempty">لا إشعارات في هذه الجلسة.</p>`;
  const clear = document.getElementById('ntfClear');
  if (clear) clear.disabled = !items.length;
}

/** تحديث الشارة على زر الجرس. */
export function refreshNotificationBadge() {
  const b = document.getElementById('ntfBadge');
  if (!b) return;
  const n = unseenCount(), e = unseenErrors();
  b.textContent = n > 99 ? '99+' : String(n);
  b.hidden = n === 0;
  b.classList.toggle('has-err', e > 0);
  const btn = document.getElementById('ntfBtn');
  if (btn) btn.setAttribute('aria-label', n ? `مركز الإشعارات — ${n} جديد` : 'مركز الإشعارات');
}

export function openNotificationCenter() {
  const ov = document.getElementById('ntfOverlay');
  if (!ov) return;
  renderNotificationCenter();
  ov.style.display = 'flex';
  markAllSeen();
  refreshNotificationBadge();
  const close = document.getElementById('ntfClose');
  if (close) close.focus();
}

export function closeNotificationCenter() {
  const ov = document.getElementById('ntfOverlay');
  if (ov) ov.style.display = 'none';
}

/** ربط عناصر المركز. يُستدعى مرة عند الإقلاع. */
export function bindNotificationCenter() {
  const btn = document.getElementById('ntfBtn');
  const ov = document.getElementById('ntfOverlay');
  if (!btn || !ov) return;
  btn.onclick = openNotificationCenter;
  const close = document.getElementById('ntfClose');
  if (close) close.onclick = closeNotificationCenter;
  const clear = document.getElementById('ntfClear');
  if (clear) clear.onclick = () => { clearNotifications(); renderNotificationCenter(); refreshNotificationBadge(); };
  ov.onclick = ev => { if (ev.target === ov) closeNotificationCenter(); };
  // تفويض النقر: الصفوف تُبنى من جديد عند كل عرض، فربطُ كل زر على حدة يعيد
  // الربط في كل مرة ويترك مستمعين ميتين خلفه.
  const body = document.getElementById('ntfBody');
  if (body) body.addEventListener('click', async ev => {
    const b = ev.target.closest && ev.target.closest('[data-ntf-copy]');
    if (!b) return;
    const okCopy = await copyEntry(b.dataset.ntfCopy);
    b.textContent = okCopy ? 'نُسخ ✓' : 'تعذّر';
    b.classList.toggle('failed', !okCopy);
    setTimeout(() => { b.textContent = 'نسخ'; b.classList.remove('failed'); }, 1400);
  });
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && ov.style.display === 'flex') { ev.preventDefault(); closeNotificationCenter(); }
  });
  // السجلّ يتغيّر من أي مكان في المنصّة، فالشارة تتبعه بلا أن يعرف المُطلِق بها.
  onNotification(() => {
    refreshNotificationBadge();
    if (ov.style.display === 'flex') { renderNotificationCenter(); markAllSeen(); refreshNotificationBadge(); }
  });
  refreshNotificationBadge();
}

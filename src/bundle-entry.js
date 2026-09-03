// ═══════════════════════════════════════════════════════════════════════
//  مدخل حزمة ESM — الجسر بين المُحوَّل وغير المُحوَّل (الموجة W2)
// ═══════════════════════════════════════════════════════════════════════
//  المشروع في هجرة تدريجية من نطاق عام مشترك إلى وحدات ESM. لا يمكن تحويل
//  17 ملفًا دفعة واحدة — فذلك فرقٌ غير قابل للمراجعة في أخطر جزء من العمل.
//
//  فالبناء هجين مؤقتًا: esbuild يحزم الوحدات المُحوَّلة في قطعة IIFE توضع
//  **أولًا**، ثم تُلحَق بها الملفات القديمة نصيًا كما كانت. وهذا الملف يعرض
//  صادرات الوحدات المُحوَّلة على globalThis كي يظل الكود القديم يراها.
//
//  لماذا IIFE لا ESM في الإخراج: ستة عشر ملف اختبار تحقن app.bundle.js
//  **كنص** داخل نافذة jsdom. أي صيغة إخراج أخرى تُسقط شبكة الأمان كلها
//  دفعةً واحدة — وهو ما تمنعه القاعدة الحاكمة الثالثة صراحةً.
//
//  هذا الملف **مؤقّت بطبيعته**: يتقلّص كلما تحوّل ملف، ويُحذف حين يكتمل
//  التحويل ويصير الاستيراد صريحًا في كل موضع.
// ═══════════════════════════════════════════════════════════════════════

// theme أولًا عمدًا: تطبيق الوسم على <html> يقع عند تحميل هذه الوحدة، فيسبق
// بناء الصفحة كلها. تأخيره يعني ومضة بيضاء لمن يفتح المنصّة في الوضع الداكن.
import * as theme from './theme.js';
import * as engine from './engine.js';
import * as format from './format.js';
import * as config from './config.js';
import * as chrome from './chrome.js';
import * as screens from './screens.js';
import * as actions from './actions.js';
import * as views from './views.js';
import * as projectActions from './app/projectactions.js';
import * as taskPanel from './taskpanel.js';
import * as lifecycle from './app/lifecycle.js';
import * as emptyStateMod from './emptystate.js';
import * as api from './api.js';
import * as toastMod from './toast.js';
import * as notifications from './notifications.js';
import * as undo from './undo.js';
import * as urlstate from './urlstate.js';
import * as skeletonMod from './skeleton.js';
import * as dialogs from './app/dialogs.js';
import * as contractTemplate from './app/contracttemplate.js';
import * as exportContract from './app/exportcontract.js';
import * as staffAccess from './app/staffaccess.js';
import * as workload from './app/workload.js';
import * as contractSign from './app/contractsign.js';
import * as contractsHub from './app/contractshub.js';
// شاشتان تُسجَّلان في سجلّ الشاشات ولا تُصدّران شيئًا يحتاجه القديم — عدا
// `resolveClientIdentifier` (يستدعيها محلّل الرابط في main.js). فالمحفظة تُستورَد
// لأثرها وحده، وصفحة الشريك تُمرَّر إلى الجسر لاسمها الواحد.
import './app/portfolio.js';
import * as clientHome from './app/clienthome.js';
import { STATE_KEYS, getState, setState, savePFilters } from './app/state.js';

Object.assign(globalThis, theme, engine, format, config, api, toastMod, notifications, undo, urlstate, skeletonMod, dialogs, contractTemplate, exportContract, chrome, screens, actions, views, projectActions, taskPanel, lifecycle, emptyStateMod, staffAccess, workload, contractSign, contractsHub, clientHome);

// state.js **لا تُمرَّر كفضاء أسماء** — حالتها تصل بواصفات لا بنسخ (أدناه). لكن
// `savePFilters` دالةٌ لا حالة، ومكانها هناك لأن القراءة المقابلة لها هناك. فتُجسَّر
// بالاسم صراحةً: استثناءٌ مقصود ومرئيّ، لا تمريرٌ عامّ يجرّ getState/setState معه.
Object.assign(globalThis, { savePFilters });

// ═══ الحالة المشتركة: واصفات لا نسخ ═══
// النسخ (Object.assign) يصلح للدوال ولا يصلح للحالة — ينسخ القيمة مرة واحدة
// فتتجمّد، بينما تتغيّر الحالة الحقيقية بعدها فلا يرى الكود القديم التغيير.
// فالحالة تُوصَل بواصفات: كل قراءة وكل كتابة تمرّ إلى الوحدة وقت حدوثها.
//
// وهذا ما يجعل ٦٣١ موضع قراءة و٦٩ موضع كتابة تعمل **بلا تعديل حرف واحد فيها**:
// الكود القديم يكتب `CID = x` فيلتقطها الـsetter، ويقرأ `PROJECT.tasks` فيجيبه
// الـgetter بالقيمة الحيّة. (الإسناد بلا تصريح يصل إلى globalThis لأن الحزمة
// سكربت غير صارم — وهو نفس القيد الذي فرض صيغة IIFE.)
//
// configurable: true عن قصد — كي تُحذف هذه الواصفات دفعةً واحدة يوم يكتمل
// التحويل ويستورد كل ملف getState/setState صراحةً.
for (const key of STATE_KEYS) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    enumerable: true,
    get: () => getState(key),
    set: value => { setState(key, value); }
  });
}

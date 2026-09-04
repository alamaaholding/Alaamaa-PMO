# -*- coding: utf-8 -*-
# build.py — معمارية الأداء:
#   app.bundle.js  = النواة (config/engine/api/views/app-*) — خارجية قابلة للتخزين المؤقت
#   dol.js / importer.js / pgantt.js = وحدات كسولة تُحمّل عند الطلب
#   styles.css خارجي — index.html صغير فقط
#   %BUILD_V% = بصمة إصدار لكسر التخزين المؤقت عند كل نشر
import os, hashlib
ROOT=os.path.dirname(os.path.abspath(__file__))
def read(p): return open(os.path.join(ROOT,p),encoding='utf-8').read()
def write(p,c): open(os.path.join(ROOT,p),'w',encoding='utf-8').write(c)

# فارغة — لم يبقَ ملفٌ واحد في الدمج النصي. تُبقى القائمة (لا تُحذف) لأن
# حارسًا في tests/test_esm_migration.js يعدّ ما فيها: صفرٌ يعني اكتمال W2،
# وأي عودةٍ إلى الدمج النصي تُوقف الاختبار.
CORE=[]
LAZY=['src/dol.js','src/importer.js','src/pgantt.js','src/timeline.js','src/trello.js','src/qrgen.js']

# ===== حزمة ESM: الوحدات المُحوَّلة تُحزَم بـesbuild وتُوضع أولًا =====
# المشروع في هجرة تدريجية من نطاق عام مشترك إلى وحدات ESM (الموجة W2). البناء
# هجين مؤقتًا: esbuild يحزم ما تحوّل، ثم تُلحَق الملفات القديمة نصيًا كما كانت.
#
# صيغة الإخراج IIFE لا ESM — وهذا قيد مفروض لا تفضيل: ستة عشر ملف اختبار تحقن
# app.bundle.js **كنص** داخل نافذة jsdom، وأي صيغة أخرى تُسقط شبكة الأمان دفعة
# واحدة. والقطعة توضع **أولًا** لأنها تعرض صادراتها على globalThis، فيراها ما
# يليها من كود قديم لم يُحوَّل بعد.
import subprocess, shutil
ESM_ENTRY='src/bundle-entry.js'
_esbuild = shutil.which('esbuild') or os.path.join(ROOT,'node_modules','.bin','esbuild')
if not os.path.exists(_esbuild) and not shutil.which('esbuild'):
    raise SystemExit('✗ esbuild غير موجود — شغّل `npm ci` أولًا. '
                     '(ملاحظة: لا تستبعد devDependencies من تثبيت النشر، فالبناء يحتاجها.)')
# --minify-whitespace و--minify-syntax **دون** --minify-identifiers، وهذا قرار
# مقصود لا نصف خطوة: تصغير الأسماء يوفّر ١٦ KB إضافية ويكلّف أثرًا لا يُقرأ في
# كل تتبّع خطأ يصل من مستخدم. الفريق صغير والأخطاء تُشخَّص من الطرفية مباشرةً،
# فالمقايضة خاسرة اليوم. تُعاد حين توجد خرائط مصدر (W6).
#
# ═══ --charset=utf8 — أثمن سطرٍ هنا، وواجهتُه عربية ═══
#
# esbuild يُخرج بـ--charset=ascii افتراضيًا، فيهرّب كل محرف غير ASCII إلى
# \uXXXX. وواجهة هذا المشروع عربية بالكامل: كل حرف يصير **ستة بايتات بدل
# اثنين**، أي ثلاثة أضعاف حجمه.
#
# ولم يظهر الأثر إلا بتقدّم W2: كل ملف يتحوّل ينتقل من الدمج النصي (حيث نصّه
# العربي كما هو) إلى هذه القطعة (حيث يُهرَّب). فكانت النواة **تنمو** كلما تحسّنت
# بنيتها — ٥٢٠ ← ٦٢١ KB — وهو انحدارٌ صامت لا يُنتج خطأً واحدًا.
#
#     --charset=ascii : 621 KB
#     --charset=utf8  : 414 KB      ← ٢٠٧ KB، بلا أي تغيير في الكود
#
# والسلامة مُتحقَّق منها لا مفترَضة: جُرّبت الحزمة في Chromium والخادم **لا
# يُصرّح بالترميز إطلاقًا** (أسوأ حالة)، فوصل النصّ العربي سليمًا — لأن السكربت
# الكلاسيكي يرث ترميز الوثيقة، وindex.html يُصرّح بـUTF-8 في أول سطر.
_r = subprocess.run([_esbuild, ESM_ENTRY, '--bundle', '--format=iife',
                     '--target=es2020', '--legal-comments=none',
                     '--minify-whitespace', '--minify-syntax', '--charset=utf8'],
                    capture_output=True, text=True)
if _r.returncode != 0:
    raise SystemExit('✗ فشل حزم وحدات ESM:\n' + _r.stderr)
esm_chunk = '/* ===== وحدات ESM (esbuild) ===== */\n' + _r.stdout

core_js = esm_chunk + '\n\n' + '\n\n'.join('/* ===== '+os.path.basename(f)+' ===== */\n'+read(f) for f in CORE)
lazy_js={os.path.basename(f):read(f) for f in LAZY}
# ===== supabase-js مستضاف ذاتيًا (AUDIT §د-٢) =====
# كان يُحمَّل من `cdn.jsdelivr.net/npm/@supabase/supabase-js@2` — **وسمٌ متحرّك**
# من نطاق خارجي، بلا integrity وبلا crossorigin. أي اختراق للـCDN، أو إصدار
# ثانوي مُخترَق يُنشَر تحت `@2`، يعني تنفيذ كودٍ عشوائي في سياقٍ يملك جلسة
# المستخدم ومفتاح Supabase. وSRI وحدها لا تكفي مع وسمٍ متحرّك: البصمة تتغيّر مع
# كل إصدار، فإمّا أن تُثبَّت (فلمَ CDN؟) أو تُترَك (فلا حراسة).
#
# ولا يُلتزَم الملف في المستودع: يُنسَخ من node_modules وقت البناء، فالإصدار
# مُثبَّت في package-lock.json — قابلٌ للتدقيق والتحديث بأدوات npm المعتادة، بلا
# كتلةٍ من ٢٠٠ KB في كل فرقٍ يُراجَع.
#
# والمكسب الثاني أكبر: بلا نطاق خارجي يبقى في الصفحة، تصير CSP صارمة ممكنة
# (AUDIT §د-١) بلا استثناء لأي مضيف.
_SB_SRC = os.path.join(ROOT, 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js')
if not os.path.exists(_SB_SRC):
    raise SystemExit('✗ supabase-js غير موجود — شغّل `npm ci` أولًا. '
                     '(الملف يُنسَخ من node_modules ولا يُلتزَم في المستودع.)')
supabase_js = open(_SB_SRC, encoding='utf-8').read()

# xlsx كذلك — تُحمَّل كسولًا عند الاستيراد من Excel وحده، فلا تمسّ حجم النواة.
_XL_SRC = os.path.join(ROOT, 'node_modules', 'xlsx', 'dist', 'xlsx.full.min.js')
if not os.path.exists(_XL_SRC):
    raise SystemExit('✗ xlsx غير موجود — شغّل `npm ci` أولًا.')
xlsx_js = open(_XL_SRC, encoding='utf-8').read()

css=read('src/styles.css')
html=read('src/index.html')

# بصمة الإصدار من كامل المحتوى (أي تغيير في أي ملف = بصمة جديدة)
# core_js يتضمّن قطعة ESM المحزومة، فأي تعديل في وحدة مُحوَّلة يغيّر البصمة.
v=hashlib.sha1((core_js+css+''.join(lazy_js.values())+html+supabase_js+xlsx_js).encode()).hexdigest()[:8]

# حقن البصمة كثابت في أول الحزمة (تستخدمه مغلّفات التحميل الكسول)
# `globalThis.BUILD_V=` لا `const BUILD_V=` — والفرق ليس أسلوبيًا:
# الإعلان بـconst في نص برمجي كلاسيكي يُنشئ رابطة في **البيئة المعجمية** العامة،
# لا خاصيةً على globalThis. فالكود القديم المدموج نصيًا يراها باسمها المجرَّد،
# لكن قطعة ESM المحزومة (التي تقرأ `globalThis.BUILD_V` صراحةً لأنها لا تشارك
# النطاق) كانت تحصل على undefined — فتُطلَب كل وحدة كسولة بـ`?v=undefined`.
# أي أن كاسر التخزين المؤقت للوحدات الكسولة كان **ميتًا**: رابط ثابت لا يتغيّر
# بين النشرات، فتُخدَم نسخة قديمة من dol/importer/pgantt/timeline/trello مع
# نواة جديدة. الإسناد على globalThis يُرضي الوصولين معًا.
core_js="globalThis.BUILD_V='"+v+"';\n"+core_js

write('app.bundle.js',core_js)
for name,content in lazy_js.items(): write(name,content)
write('styles.css',css)
write('supabase.js',supabase_js)
write('xlsx.js',xlsx_js)
write('index.html',html.replace('%BUILD_V%',v))

print('BUILD_V:',v)
print('index.html:',len(html),'حرف (هيكل فقط)')
print('app.bundle.js:',round(len(core_js)/1024,1),'KB (نواة قابلة للتخزين)')
for n,c in lazy_js.items(): print(n+':',round(len(c)/1024,1),'KB (كسول)')
print('styles.css:',round(len(css)/1024,1),'KB')
print('supabase.js:',round(len(supabase_js)/1024,1),'KB (مستضاف ذاتيًا — لا CDN)')
print('xlsx.js:',round(len(xlsx_js)/1024,1),'KB (مستضاف ذاتيًا — كسول)')

# ===== حارس النشر: قائمة الملفات المُولَّدة التي يجب نشرها معًا دائمًا =====
# سبب وجودها: البناء يُولّد ملفات جذرية (styles.css, app.bundle.js, ...) من مصادرها في src/.
# نشر المصدر وحده لا يغيّر شيئًا على الموقع الحي — الصفحة تخدم الملفات الجذرية فقط.
# حدث هذا فعليًا: نُشر src/styles.css ونُسي styles.css الجذري، فبقيت الأنماط غائبة تمامًا.
DEPLOY_ARTIFACTS = ['app.bundle.js','styles.css','index.html','supabase.js','xlsx.js'] + [os.path.basename(f) for f in LAZY]
print('\n⚠ ملفات يجب نشرها معًا (مُولَّدة — نشر src/ وحده لا يكفي):')
print('   ' + '  '.join(DEPLOY_ARTIFACTS))

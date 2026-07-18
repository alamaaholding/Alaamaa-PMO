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

CORE=['src/config.js','src/engine.js','src/api.js','src/views.js',
      'src/app/state.js','src/app/dialogs.js','src/app/lifecycle.js',
      'src/app/portfolio.js','src/app/main.js']
LAZY=['src/dol.js','src/importer.js','src/pgantt.js','src/timeline.js','src/trello.js']

core_js='\n\n'.join('/* ===== '+os.path.basename(f)+' ===== */\n'+read(f) for f in CORE)
lazy_js={os.path.basename(f):read(f) for f in LAZY}
css=read('src/styles.css')
html=read('src/index.html')

# بصمة الإصدار من كامل المحتوى (أي تغيير في أي ملف = بصمة جديدة)
v=hashlib.sha1((core_js+css+''.join(lazy_js.values())+html).encode()).hexdigest()[:8]

# حقن البصمة كثابت في أول الحزمة (تستخدمه مغلّفات التحميل الكسول)
core_js="const BUILD_V='"+v+"';\n"+core_js

write('app.bundle.js',core_js)
for name,content in lazy_js.items(): write(name,content)
write('styles.css',css)
write('index.html',html.replace('%BUILD_V%',v))

print('BUILD_V:',v)
print('index.html:',len(html),'حرف (هيكل فقط)')
print('app.bundle.js:',round(len(core_js)/1024,1),'KB (نواة قابلة للتخزين)')
for n,c in lazy_js.items(): print(n+':',round(len(c)/1024,1),'KB (كسول)')
print('styles.css:',round(len(css)/1024,1),'KB')

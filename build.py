# -*- coding: utf-8 -*-
# build.py — يدمج ملفات src/ في index.html واحد للنشر على Cloudflare Pages
# المصدر يُطوّر في src/ ، وهذا يولّد index.html (لا يُحرّر يدويًا)
import os, re
ROOT=os.path.dirname(os.path.abspath(__file__))
def read(p): return open(os.path.join(ROOT,p),encoding='utf-8').read()

html=read('src/index.html')
css=read('src/styles.css')
js_files=['src/config.js','src/engine.js','src/api.js','src/views.js','src/app.js','src/dol.js','src/importer.js','src/pgantt.js']
js='\n\n'.join('/* ===== '+os.path.basename(f)+' ===== */\n'+read(f) for f in js_files)

# استبدال رابط CSS بالمحتوى المضمّن
html=html.replace('<link rel="stylesheet" href="styles.css">','<style>\n'+css+'\n</style>')
# إزالة روابط <script src> المحلية واستبدالها بحزمة واحدة (نُبقي Supabase CDN)
html=re.sub(r'\n<script src="(config|engine|api|views|app|dol|importer|pgantt)\.js"></script>','',html)
html=html.replace('</body></html>','<script>\n'+js+'\n</script>\n</body></html>')

open(os.path.join(ROOT,'index.html'),'w',encoding='utf-8').write(html)
print('index.html مُولّد:',len(html),'حرف')

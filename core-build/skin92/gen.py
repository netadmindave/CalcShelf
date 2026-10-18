# Key rectangles of Graph89's TI-92 Plus and Voyage 200 skins (from their key masks) -> ti89/js/skin92.js
import numpy as np, json, sys
from scipy import ndimage
import os
SRC = os.environ.get('G89', '../graph89') + '/app/src/main/assets/landscape/'
N = ['DOWN','RIGHT','UP','LEFT','HAND','SHIFT','DIAMOND','2ND','3','2','1','F8','W','S','Z','6','5','4','F3','E','D','X','9','8','7','F7','R','F','C','STORE','COMMA','PARIGHT','PALEFT','F2','T','G','V','SPACE','TAN','COS','SIN','F6','Y','H','B','DIVIDE','P','ENTER2','LN','F1','U','J','N','POWER','MULTIPLY','APPS','CLEAR','F5','I','K','M','EQUALS','NU','ESCAPE','MODE','PLUS','O','L','THETA','BACKSPACE','NEGATE','PERIOD','0','F4','Q','A','ENTER1','MINUS','ON','ALPHA','EE','CATALOG','HOME','PIPE','VOID']
OUT = {}
for name, (w, h), scr, tools in [('v200', (708, 430), (82, 0, 956, 467), (2, 4, 37, 222, 'v')), ('ti92plus', (547, 324), (158, 33, 775, 359), (400, 0, 146, 21, 'h'))]:
    m = np.fromfile(SRC + name + '/buttonmask.bin', dtype=np.uint8)[:w * h].reshape(h, w)
    keys = []
    for v in range(79):
        if v == 62: continue
        lab, n = ndimage.label(m == v)
        for i in range(1, n + 1):
            ys, xs = np.where(lab == i)
            if len(xs) < 20: continue
            keys.append([N[v], int(xs.min()), int(ys.min()), int(xs.max() + 1 - xs.min()), int(ys.max() + 1 - ys.min())])
    keys.sort(key=lambda k: (k[2] // 12, k[1]))
    OUT['92p' if name == 'ti92plus' else name] = dict(w=w, h=h, screen=[scr[0] / 2, scr[1] / 2, scr[2] / 2, scr[3] / 2], tools=list(tools), keys=keys)
js = '''/*
 * skin92.js — key positions of the TI-92 Plus and Voyage 200 as laid out in Graph89 (Dritan Hashorva, GPL-3.0),
 * taken from its landscape skins' key masks by core-build/skin92/gen.py. Each key: [TiEmu key, x, y, width, height]
 * in mask pixels; screen: [x0, y0, x1, y1]; tools: free area for the menu buttons [x, y, w, h, direction].
 */
self.SKIN92 = ''' + json.dumps(OUT, separators=(',', ':')) + ';\n'
open(sys.argv[1], 'w').write(js); print({k: len(v['keys']) for k, v in OUT.items()})

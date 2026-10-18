# Generates app/www/hp/js/layouts.js: HP 48SX/48GX/49G/49g+ keypads with Emu48 out/in codes from the KML scripts.
import json, re, sys
import os
KML = os.environ.get('EMU48', '../emu48android') + '/app/src/main/assets/calculators/'
def codes(name):
    s = open(KML + name + '.kml', encoding='latin-1').read(); d = {}
    for m in re.finditer(r'\nButton\s+(\d+)(.*?)\nEnd', s, re.S):
        oi = re.search(r'OutIn\s+(\d+)\s+(\d+)', m.group(2))
        if oi: d[int(m.group(1))] = [int(oi.group(1)), int(oi.group(2))]
    return d
def K(id, p, l='', r='', a='', t='', w=1): return dict(id=id, p=p, l=l, r=r, a=a, t=t, w=w)
M = lambda i, a: K(i, '', '', '', a, 'menu')
# ---- HP 48GX (left shift purple, right shift teal)
GX = [
  [M(11,'A'), M(12,'B'), M(13,'C'), M(14,'D'), M(15,'E'), M(16,'F')],
  [K(21,'MTH','RAD','POLAR','G'), K(22,'PRG','','CHARS','H'), K(23,'CST','','MODES','I'), K(24,'VAR','','MEMORY','J'), K(25,'▲','','STACK','K','nav'), K(26,'NXT','PREV','MENU','L')],
  [K(31,"'",'UP','HOME','M'), K(32,'STO','DEF','RCL','N'), K(33,'EVAL','→NUM','UNDO','O'), K(34,'◀','PICTURE','','P','nav'), K(35,'▼','VIEW','','Q','nav'), K(36,'▶','SWAP','','R','nav')],
  [K(41,'SIN','ASIN','∂','S'), K(42,'COS','ACOS','∫','T'), K(43,'TAN','ATAN','Σ','U'), K(44,'√x','x²','ˣ√y','V'), K(45,'yˣ','10ˣ','LOG','W'), K(46,'1/x','eˣ','LN','X')],
  [K(51,'ENTER','EQUATION','MATRIX','','enter',2), K(52,'+/−','EDIT','CMD','Y'), K(53,'EEX','PURG','ARG','Z'), K(54,'DEL','CLEAR',''), K(55,'⌫','DROP','','','',1)],
]
GX2 = [
  [K(61,'α','USER','ENTRY','','alpha'), K(62,'7','','SOLVE','','num'), K(63,'8','','PLOT','','num'), K(64,'9','','SYMBOLIC','','num'), K(65,'÷','( )','#','','op')],
  [K(71,'◀','','','','lshift'), K(72,'4','','TIME','','num'), K(73,'5','','STAT','','num'), K(74,'6','','UNITS','','num'), K(75,'×','[ ]','_','','op')],
  [K(81,'▶','','','','rshift'), K(82,'1','','I/O','','num'), K(83,'2','','LIBRARY','','num'), K(84,'3','','EQ LIB','','num'), K(85,'−','« »','" "','','op')],
  [K(91,'ON','CONT','OFF','','on'), K(92,'0','=','→','','num'), K(93,'.',',','↵','','num'), K(94,'SPC','π','∡','','num'), K(95,'+','{ }','::','','op')],
]
# ---- HP 48SX (left shift orange, right shift blue)
SX = [
  GX[0],
  [K(21,'MTH','PRINT','','G'), K(22,'PRG','I/O','','H'), K(23,'CST','MODES','','I'), K(24,'VAR','MEMORY','','J'), K(25,'▲','LIBRARY','','K','nav'), K(26,'NXT','PREV','','L')],
  [K(31,"'",'UP','HOME','M'), K(32,'STO','DEF','RCL','N'), K(33,'EVAL','→Q','→NUM','O'), K(34,'◀','GRAPH','','P','nav'), K(35,'▼','REVIEW','','Q','nav'), K(36,'▶','SWAP','','R','nav')],
  GX[3],
  [K(51,'ENTER','EQUATION','MATRIX','','enter',2), K(52,'+/−','EDIT','VISIT','Y'), K(53,'EEX','2D','3D','Z'), K(54,'DEL','PURGE',''), K(55,'⌫','DROP','CLR')],
]
SX2 = [
  [K(61,'α','USR','ENTRY','','alpha'), K(62,'7','SOLVE','','','num'), K(63,'8','PLOT','','','num'), K(64,'9','ALGEBRA','','','num'), K(65,'÷','( )','#','','op')],
  [K(71,'◀','','','','lshift'), K(72,'4','TIME','','','num'), K(73,'5','STAT','','','num'), K(74,'6','UNITS','','','num'), K(75,'×','[ ]','_','','op')],
  [K(81,'▶','','','','rshift'), K(82,'1','RAD','POLAR','','num'), K(83,'2','STACK','ARG','','num'), K(84,'3','CMD','MENU','','num'), K(85,'−','« »','" "','','op')],
  [K(91,'ON','CONT','OFF','','on'), K(92,'0','=','→','','num'), K(93,'.',',','↵','','num'), K(94,'SPC','π','∡','','num'), K(95,'+','{ }','::','','op')],
]
# ---- HP 49G / 49g+ (left shift blue/violet, right shift red)
F49 = [K(11,'F1','Y=','','A','fn'), K(12,'F2','WIN','','B','fn'), K(13,'F3','GRAPH','','C','fn'), K(14,'F4','2D/3D','','D','fn'), K(15,'F5','TBLSET','','E','fn'), K(16,'F6','TABLE','','F','fn')]
TOP49 = [[K(21,'APPS','FILES','BEGIN','G'), K(22,'MODE','CUSTOM','END','H'), K(23,'TOOL','i','|','I')],
         [K(31,'VAR','UPDIR','COPY','J'), K(32,'STO▸','RCL','CUT','K'), K(33,'NXT','PREV','PASTE','L')]]
ARR49 = {'up': K(113,'▲','⇞','⤒','','nav'), 'left': K(112,'◀','⇤','|◀','','nav'), 'right': K(110,'▶','⇥','▶|','','nav'), 'down': K(111,'▼','⇟','⤓','','nav')}
def rows49(plus):
    r4 = [K(41,'HIST','CMD','UNDO','M'), K(42,'EVAL','PRG','CHARS','N'), K(43,"'",'MTRW','EQW','O'), K(44,'SYMB','MTH','CAT','P'), K(45,'⌫','DEL','CLEAR')] if plus else \
         [K(41,'HIST','CMD','UNDO','M'), K(42,'CAT','PRG','CHARS','N'), K(43,'EQW','MTRW',"'",'O'), K(44,'SYMB','MTH','EVAL','P'), K(45,'⌫','DEL','CLEAR')]
    return [r4,
      [K(51,'yˣ','eˣ','LN','Q'), K(52,'√x','x²','ˣ√y','R'), K(53,'SIN','ASIN','Σ','S'), K(54,'COS','ACOS','∂','T'), K(55,'TAN','ATAN','∫','U')],
      [K(61,'EEX','10ˣ','LOG','V'), K(62,'+/−','≠','=','W'), K(63,'X','≤','<','X'), K(64,'1/x','≥','>','Y'), K(65,'÷','ABS','ARG','Z','op')],
      [K(71,'ALPHA','USER','ENTRY','','alpha'), K(72,'7','S.SLV','NUM.SLV','','num'), K(73,'8','EXP&LN','TRIG','','num'), K(74,'9','FINANCE','TIME','','num'), K(75,'×','[ ]','" "','','op')],
      [K(81,'◀','','','','lshift'), K(82,'4','CALC','ALG','','num'), K(83,'5','MATRICES','STAT','','num'), K(84,'6','CONVERT','UNITS','','num'), K(85,'−','( )','_','','op')],
      [K(91,'▶','','','','rshift'), K(92,'1','ARITH','CMPLX','','num'), K(93,'2','DEF','LIB','','num'), K(94,'3','#','BASE','','num'), K(95,'+','{ }','« »','','op')],
      [K(101,'ON','CONT','OFF','','on'), K(102,'0','∞','→','','num'), K(103,'.','::','↵','','num'), K(104,'SPC','π',',','','num'), K(105,'ENTER','ANS','→NUM','','enter')]]
def attach(rows, cd):
    for r in rows:
        for k in r:
            k['k'] = cd[k['id']]
    return rows
gx, sx, x49, q49 = codes('real48gx-l'), codes('real48sx-l'), codes('real49g-l'), codes('real49gp-l')
def arrows(cd): return {d: dict(v, k=cd[v['id']]) for d, v in ARR49.items()}
OUT = {
  '48sx': dict(name='HP 48SX', short='HP 48SX', type='S', cls=48, rom='rom.48s', lcd=64, family='48', colors=['#F08A4B', '#73B7F0'], top=attach(SX, sx), bottom=attach(SX2, sx)),
  '48gx': dict(name='HP 48GX', short='HP 48GX', type='G', cls=48, rom='rom.48g', lcd=64, family='48', colors=['#B9A7F5', '#59D6D1'], top=attach(GX, gx), bottom=attach(GX2, gx)),
  '49g':  dict(name='HP 49G', short='HP 49G', type='X', cls=49, rom='rom.49g', lcd=64, family='49', colors=['#9C95F2', '#F2737B'], fkeys=attach([F49], x49)[0], top=attach([r[:] for r in TOP49], x49), arrows=arrows(x49), bottom=attach(rows49(False), x49)),
  '49gp': dict(name='HP 49g+', short='HP 49g+', type='Q', cls=49, rom='rom.49g', lcd=80, family='49', colors=['#4FB3E8', '#F2575F'], fkeys=attach([[dict(k) for k in F49]], q49)[0], top=attach([[dict(k) for k in r] for r in TOP49], q49), arrows=arrows(q49), bottom=attach(rows49(True), q49)),
}
js = '''/*
 * layouts.js — HP 48SX, 48GX, 49G and 49g+ keypads, generated by core-build/hp48/gen/layouts.py.
 * k: Emu48 keyboard [out, in] code (from Emu48's KML scripts), p: key face, l/r: left-/right-shift legend,
 * a: alpha letter, t: role, w: column span. Part of CAS Touch, GPL-2.0-or-later.
 */
self.HPLAYOUTS = ''' + json.dumps(OUT, ensure_ascii=False, separators=(',', ':')) + ';\n'
open(sys.argv[1], 'w').write(js)
print('ok', {k: sum(len(r) for r in v['top']) + sum(len(r) for r in v['bottom']) + len(v.get('fkeys', [])) + len(v.get('arrows', {})) for k, v in OUT.items()})

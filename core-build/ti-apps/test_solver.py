#!/usr/bin/env python3
"""Run the generated CalcShelf-Solver.lua under Lua 5.1 (lupa) with a mock of the Nspire API.
Checks that every closed form compiles, then solves a few worked examples.  pip install lupa"""
import sys, os, math
from lupa import lua51

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = open(os.path.join(HERE, 'out', 'CalcShelf-Solver.lua'), encoding='utf-8').read()

MOCK = r'''
platform = { apiLevel = '2.4', window = { invalidate = function() end, width = function() return 318 end, height = function() return 212 end } }
on = {}
toolpalette = { register = function(m) MENU = m end }
math.eval = function(s) local f = loadstring('return ' .. s:gsub('pi', 'math.pi')); return f and f() end
GC = {}
local font = 10
function GC:setFont(a, b, s) font = s end
function GC:getStringWidth(s) return #s * font * 0.55 end
for _, n in ipairs({ 'drawString', 'fillRect', 'drawRect', 'setColorRGB', 'drawLine' }) do GC[n] = function() end end
'''

L = lua51.LuaRuntime(unpack_returned_tuples=True)
L.execute(MOCK)
L.execute(SRC)
G = L.globals()
fails = 0

def check(name, ok, info=''):
    global fails
    print(('OK   ' if ok else 'FAIL ') + name + (' ' + str(info) if info else ''))
    if not ok: fails += 1

# every closed form and residual compiles
bad = L.execute(r'''
local bad, n = {}, 0
for fi, f in ipairs(F) do
  for k, s in ipairs(f[7]) do
    if type(s) == 'table' then for _, c in ipairs(s) do n = n + 1
      if not loadstring('return function(a) return ' .. c[1] .. ' end') then bad[#bad+1] = f[1] .. ': ' .. c[1] end end end
  end
  if f[8] and not loadstring('return function(a) return ' .. f[8] .. ' end') then bad[#bad+1] = f[1] .. ' resid' end
  if f[10] and not loadstring('return function(a) return ' .. f[10] .. ' end') then bad[#bad+1] = f[1] .. ' when' end
end
return table.concat(bad, '\n'), n, #F, #Q
''')
check('all expressions compile (%d closed forms, %d formulas, %d quantities)' % (bad[1], bad[2], bad[3]), bad[0] == '', bad[0][:2000])

L.execute(r'''
function findQ(base, sub, word)
  for i, q in ipairs(Q) do if q[1] == base and q[2] == (sub or '') and (not word or string.find(string.lower(q[3]), word, 1, true)) then return i end end
end
function set(i, v) _G.__user = _G.__user end
''')
findQ = G.findQ

def run(title, inputs, expect):
    L.execute('MENU[1][2][2]()')
    user = {}
    for (b, s, w), v in inputs.items():
        qi = findQ(b, s, w)
        if not qi:
            check(title + ': input %s_%s (%s) exists' % (b, s, w), False); return
        user[str(qi)] = v
    L.globals().__u = L.table_from(user)
    L.execute('on.restore({user=__u})')
    known = L.eval('solve()')
    for (b, s, w), want in expect.items():
        qi = findQ(b, s, w)
        k = known[qi] if qi else None
        got = k['v'] if k else None
        ok = got is not None and abs(got - want) <= 2e-3 * abs(want)
        how = ''
        if k and k['f']: how = ' via ' + L.eval('F')[k['f']][1]
        check('%s: %s_%s = %s (want %g)%s' % (title, b, s, got, want, how), ok)

# list the quantities so examples can be written against them
if '--list' in sys.argv:
    Q = L.eval('Q')
    for i in range(1, len(Q) + 1):
        q = Q[i]; print(i, q[1], q[2], '|', q[3], '|', q[6])
    sys.exit(0)

exec(open(os.path.join(HERE, 'test_examples.py')).read()) if os.path.exists(os.path.join(HERE, 'test_examples.py')) else None

# the UI paints in every mode without errors
L.execute(r'''
buildRows(); on.paint(GC)
on.charIn('n'); on.paint(GC); on.escapeKey()
on.arrowDown(); on.enterKey(); on.paint(GC); on.charIn('2'); on.enterKey(); on.paint(GC)
on.arrowRight(); on.paint(GC)
MENU[3][4][2](); on.paint(GC); on.escapeKey()
MENU[3][3][2](); on.paint(GC); on.escapeKey()
MENU[2][2][2](); on.paint(GC); MENU[2][5][2]()
local s = on.save(); on.restore(s); on.paint(GC)
''')
check('UI paints in list, search, edit, detail, help and menu states', True)
print('\n%d failure(s)' % fails)
sys.exit(1 if fails else 0)

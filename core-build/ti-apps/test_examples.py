# worked examples for test_solver.py: values in the named unit; expectations in the named unit
def U(base, sub, word, unit):
    qi = findQ(base, sub, word); us = L.eval('Q')[qi][7]
    for i in range(1, len(us) + 1):
        if us[i][1] == unit: return us[i][2]
    if unit == '': return 1
    raise KeyError('%s_%s has no unit %s (has %s)' % (base, sub, unit, [us[i][1] for i in range(1, len(us)+1)]))

def ex(title, given, want):
    try:
        run(title, {k[:3]: v * U(*k) for k, v in given.items()}, {k[:3]: v * U(*k) for k, v in want.items()})
    except KeyError as e:
        check(title, False, e)

ex('thin lens', {('f', '', 'focal length', 'mm'): 100, ('s', 'o', 'object distance', 'mm'): 150},
   {('s', 'i', 'image distance', 'mm'): 300})
ex('photon energy at 1550 nm', {('λ', '0', 'wavelength (vacuum)', 'nm'): 1550},
   {('E', '', 'photon energy', 'eV'): 0.79990})
ex('bandgap wavelength of Si', {('E', 'g', 'bandgap', 'eV'): 1.12}, {('λ', 'g', 'bandgap wavelength', 'µm'): 1.10700})
ex('intrinsic density of Si', {('N', 'c', 'conduction', '1/cm^3'): 2.8e19, ('N', 'v', 'valence', '1/cm^3'): 1.04e19,
    ('E', 'g', 'bandgap', 'eV'): 1.12, ('T', '', 'temperature', 'K'): 300},
   {('n', 'i', 'intrinsic', '1/cm^3'): 6.6788e9})

# numeric fallback: make consistent values with another variable's closed form, hide one variable, solve it back
res = L.execute(r'''
math.randomseed(7)
local tried, good, bad = 0, 0, {}
for fi, f in ipairs(F) do
  for k, s in ipairs(f[7]) do
    if s == true and f[8] then
      local done = false
      for attempt = 1, 30 do
        local a = {}
        for j = 1, #f[5] do a[j] = 0.2 + math.random() * 3 end
        for j, sj in ipairs(f[7]) do
          if j ~= k and type(sj) == 'table' then
            local b = {}; for i, v in pairs(a) do b[i] = v end; b[j] = nil
            local fn = loadstring('return function(a) return ' .. sj[1][1] .. ' end'); setfenv(fn, getfenv(evalForTest)); local y = fn()(b)
            if y == y and y and math.abs(y) < 1e30 and y ~= 0 then a[j] = y; done = true; break end
          end
        end
        if done then
          tried = tried + 1
          local want = a[k]; a[k] = nil
          local roots = numericTest(f, a, k)
          local ok = false
          for _, x in ipairs(roots) do a[k] = x; local r = residTest(f, a); a[k] = nil; if r and math.abs(r) < 1e-6 * (1 + math.abs(want)) then ok = true end end
          if ok then good = good + 1 else bad[#bad + 1] = f[1] .. ' for ' .. Q[f[5][k]][3] end
          break
        end
      end
    end
  end
end
return tried, good, table.concat(bad, '; ')
''')
check('numeric solving: %d of %d hidden values recovered' % (res[1], res[0]), res[1] >= 0.85 * res[0], res[2][:600])

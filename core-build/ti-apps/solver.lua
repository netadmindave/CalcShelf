platform.apiLevel = '2.3'
-- CalcShelf Variable Solver for the TI-Nspire CX / CX II: optics, optoelectronics and semiconductors.
-- Enter the values you know; every formula left with one unknown is solved, its result feeds the others, and so on.
-- Part of CalcShelf (github.com/netadmindave/CalcShelf), GPL-3.0-or-later. The formula data below is generated.

--[[DATA]]

------------------------------------------------------------------ maths for the formulas
local abs, floor, sqrt, log, exp = math.abs, math.floor, math.sqrt, math.log, math.exp
local PI, EU = math.pi, math.exp(1)
local function finite(x) return type(x) == 'number' and x == x and x ~= math.huge and x ~= -math.huge end
local function pw(a, b)
  if a < 0 and b ~= floor(b) then            -- odd roots of negatives: (-8)^(1/3) = -2
    local inv = 1 / b
    if abs(inv - floor(inv + 0.5)) < 1e-9 and floor(inv + 0.5) % 2 == 1 then return -((-a) ^ b) end
    return 0 / 0
  end
  return a ^ b
end
local function asinh(x) return log(x + sqrt(x * x + 1)) end
local function erf(x)                         -- Abramowitz–Stegun 7.1.26, |error| < 1.5e-7
  local s = x < 0 and -1 or 1; x = abs(x)
  local t = 1 / (1 + 0.3275911 * x)
  local y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * exp(-x * x)
  return s * y
end
local ENV = {
  PI = PI, EU = EU, pw = pw, sqrt = function(x) if x < 0 then return 0 / 0 end return sqrt(x) end, exp = exp,
  log = function(x) if x <= 0 then return 0 / 0 end return log(x) end, log10 = function(x) if x <= 0 then return 0 / 0 end return log(x) / log(10) end,
  sin = math.sin, cos = math.cos, tan = math.tan, asin = math.asin, acos = math.acos, atan = math.atan,
  sinh = math.sinh, cosh = math.cosh, tanh = math.tanh, asinh = asinh,
  acosh = function(x) return log(x + sqrt(x * x - 1)) end, atanh = function(x) return 0.5 * log((1 + x) / (1 - x)) end,
  sec = function(x) return 1 / math.cos(x) end, csc = function(x) return 1 / math.sin(x) end, cot = function(x) return 1 / math.tan(x) end,
  abs = abs, floor = floor, ceil = math.ceil, max = math.max, min = math.min, erf = erf, erfc = function(x) return 1 - erf(x) end,
  sgn = function(x) if x > 0 then return 1 elseif x < 0 then return -1 end return 0 end,
}
local cache = {}
local function compile(src)
  local fn = cache[src]
  if fn == nil then
    local chunk = loadstring('return function(a) return ' .. src .. ' end')
    if chunk then setfenv(chunk, ENV); fn = chunk() else fn = false end
    cache[src] = fn
  end
  return fn or nil
end
local function call(src, a)
  local fn = compile(src); if not fn then return nil end
  local ok, y = pcall(fn, a)
  if ok then return y end
  return nil
end

------------------------------------------------------------------ state
local user, userUnit, unitSel, ignored, ignoredF = {}, {}, {}, {}, {}
local topics = { true, true, true }
local TOPIC_NAME = { 'Optics', 'Optoelectronics', 'Semiconductors' }
local known, conflicts = {}, {}
local FQ = {}                                   -- formulas each quantity is in
for fi, f in ipairs(F) do for _, qi in ipairs(f[5]) do FQ[qi] = FQ[qi] or {}; table.insert(FQ[qi], fi) end end

local function active(fi)
  local f = F[fi]
  if not topics[f[2]] or ignoredF[fi] then return false end
  for _, qi in ipairs(f[5]) do if ignored[qi] then return false end end
  return true
end

------------------------------------------------------------------ solving
local function residAt(f, a, k, x) a[k] = x; local r = call(f[8], a); a[k] = nil; return r end
-- no closed form: Newton from several starting points, keeping roots that make the equation hold
local function numeric(f, a, k, hint)
  local roots = {}
  local starts = { hint or 1, 1, 0.5, 2, 10, 0.1, 100, 0.01, 1e3, 1e-3, 1e6, 1e-6, 1e-9, 1e9, -1 }
  for _, x in ipairs(starts) do
    local ok = true
    for _ = 1, 60 do
      local r = residAt(f, a, k, x); if not finite(r) then ok = false; break end
      local h = (abs(x) > 1e-300 and abs(x) or 1) * 1e-7
      local r2 = residAt(f, a, k, x + h); if not finite(r2) then ok = false; break end
      local d = (r2 - r) / h; if d == 0 or not finite(d) then ok = false; break end
      local nx = x - r / d
      if not finite(nx) then ok = false; break end
      if abs(nx - x) <= 1e-13 * math.max(abs(nx), 1e-300) then x = nx; break end
      x = nx
    end
    if ok then
      local r = residAt(f, a, k, x)
      local s = residAt(f, a, k, x * (1 + 1e-6) + 1e-300)
      if finite(r) and finite(s) and abs(r) <= 1e-6 * abs(s - r) + 1e-300 then roots[#roots + 1] = x end
    end
    if #roots >= 3 then break end
  end
  return roots
end

local function evalFor(fi, k)
  local f = F[fi]; local qs, fs, sol = f[5], f[6], f[7][k]
  local a = {}
  for j, qi in ipairs(qs) do if j ~= k then a[j] = known[qi].v / fs[j] end end
  local cands = {}
  if type(sol) == 'table' then
    for c, s in ipairs(sol) do local y = call(s[1], a); if finite(y) then cands[#cands + 1] = { y = y, c = c } end end
  elseif sol == true and f[8] then
    local h = Q[qs[k]][11]; if h then h = h / fs[k] end
    for _, y in ipairs(numeric(f, a, k, h)) do cands[#cands + 1] = { y = y, c = 0 } end
  end
  if #cands == 0 then return nil end
  -- a positive answer first (lengths, densities, powers …), otherwise the first found
  local best
  for _, c in ipairs(cands) do if c.y > 0 then best = c; break end end
  if not best then for _, c in ipairs(cands) do if c.y >= 0 then best = c; break end end end
  best = best or cands[1]
  return { v = best.y * fs[k], c = best.c, n = #cands }
end

local function holds(f)
  if not f[10] then return true end
  local a = {}
  for j, qi in ipairs(f[5]) do if known[qi] then a[j] = known[qi].v / f[6][j] end end
  local y = call(f[10], a)
  return y == true
end

-- for the tests
function numericTest(f, a, k) return numeric(f, a, k) end
function residTest(f, a) return call(f[8], a) end
function evalForTest() end
setfenv(evalForTest, ENV)

function solve()
  known, conflicts = {}, {}
  for qi, v in pairs(user) do if not ignored[qi] then known[qi] = { v = v, src = 'user' } end end
  local used = {}
  for fi = 1, #F do if active(fi) then for _, qi in ipairs(F[fi][5]) do used[qi] = true end end end
  for qi in pairs(used) do local c = Q[qi][8]; if c and not known[qi] then known[qi] = { v = c, src = 'const' } end end
  local failed = {}
  for _ = 1, 80 do
    local ready = {}
    for fi = 1, #F do
      if active(fi) then
        local f = F[fi]; local n, unk, real = 0, nil, false
        for k, qi in ipairs(f[5]) do
          local kn = known[qi]
          if not kn then n = n + 1; unk = k; if n > 1 then break end
          elseif kn.src ~= 'const' and not Q[qi][10] then real = true end
        end
        if n == 1 and real then
          local qi = f[5][unk]; local skip = Q[qi][9] or failed[fi .. ':' .. unk] or f[7][unk] == false
          if not skip and f[11] then for _, u in ipairs(f[11]) do if known[u] then skip = true end end end
          if not skip and f[10] and not holds(f) then skip = true end
          if not skip then ready[#ready + 1] = { fi, unk } end
        end
      end
    end
    if #ready == 0 then break end
    table.sort(ready, function(x, y) local ax, ay = F[x[1]][9] and 1 or 0, F[y[1]][9] and 1 or 0; if ax ~= ay then return ax < ay end return x[1] < y[1] end)
    local changed = false
    for _, r in ipairs(ready) do
      local fi, k = r[1], r[2]; local qi = F[fi][5][k]
      if not known[qi] then
        local ok = true
        for j, q2 in ipairs(F[fi][5]) do if j ~= k and not known[q2] then ok = false end end
        if ok then
          local res = evalFor(fi, k)
          if res then known[qi] = { v = res.v, src = 'calc', f = fi, k = k, c = res.c, n = res.n }; changed = true
          else failed[fi .. ':' .. k] = true end
        end
      end
    end
    if not changed then break end
  end
  return known
end

------------------------------------------------------------------ numbers and units
local function fmtNum(x)
  if x == 0 then return '0' end
  if not finite(x) then return '?' end
  local a = abs(x)
  local s
  if a >= 1e-3 and a < 1e7 then s = string.format('%.6g', x)
  else s = string.format('%.5e', x); s = s:gsub('0+e', 'e'):gsub('%.e', 'e'):gsub('e%+?(%-?)0*(%d)', 'E%1%2') end
  return s
end
-- the unit a value is shown in: the one you chose, else the first of the list that keeps the number between 1 and 1000
local function unitFor(qi, si)
  local us = Q[qi][7]
  if #us == 0 then return nil end
  if unitSel[qi] and us[unitSel[qi]] then return us[unitSel[qi]], unitSel[qi] end
  if si and si ~= 0 then
    for i, u in ipairs(us) do local x = abs(si / u[2]); if x >= 1 and x < 1000 then return u, i end end
  end
  return us[1], 1
end
local function showVal(qi, si)
  local u = unitFor(qi, si)
  if not u then return fmtNum(si) end
  return fmtNum(si / u[2]) .. (u[1] ~= '' and ' ' .. u[1] or '')
end

------------------------------------------------------------------ the list of variables
local mode, search, sel, top = 'list', '', 1, 1
local rows = {}
local edit = { qi = nil, buf = '', unit = 1, err = nil }
local detail = { qi = nil, scroll = 0, lines = {} }
local note = nil
local W, H = 318, 212

local function lower(s) return string.lower(s or '') end
local function matches(qi, s)
  local q = Q[qi]
  local hay = lower(q[1] .. q[2] .. ' ' .. q[1] .. '_' .. q[2] .. ' ' .. q[3] .. ' ' .. q[5])
  return string.find(hay, lower(s), 1, true) ~= nil
end
local function inScope(qi)
  for _, fi in ipairs(FQ[qi] or {}) do if active(fi) then return true end end
  return false
end
local function byName(a, b) return lower(Q[a][3]) < lower(Q[b][3]) end

function buildRows()
  local keep = rows[sel] and rows[sel].qi
  rows = {}
  local mine, calc, rest = {}, {}, {}
  for qi = 1, #Q do
    if inScope(qi) or user[qi] then
      if search == '' or matches(qi, search) then
        local k = known[qi]
        if user[qi] then mine[#mine + 1] = qi
        elseif k and k.src == 'calc' then calc[#calc + 1] = qi
        elseif not (k and k.src == 'const' and search == '') then rest[#rest + 1] = qi end
      end
    end
  end
  table.sort(mine, byName); table.sort(calc, byName); table.sort(rest, byName)
  local function sec(title, list)
    if #list == 0 then return end
    rows[#rows + 1] = { head = title .. ' (' .. #list .. ')' }
    for _, qi in ipairs(list) do rows[#rows + 1] = { qi = qi } end
  end
  sec('Your values', mine); sec('Calculated', calc)
  sec(search == '' and 'All variables  (type to search)' or 'Matching', rest)
  if #rows == 0 then rows[1] = { head = search == '' and 'Nothing in scope: Menu > Topics' or 'Nothing matches "' .. search .. '"' } end
  sel = 1
  if keep then for i, r in ipairs(rows) do if r.qi == keep then sel = i end end end
  if rows[sel] and not rows[sel].qi then for i = sel, #rows do if rows[i].qi then sel = i; break end end end
end

local function refresh() solve(); buildRows(); platform.window:invalidate() end

------------------------------------------------------------------ drawing
local function setColor(gc, c) gc:setColorRGB(c[1], c[2], c[3]) end
local INK, MUTE, ACC, SELBG, HEAD, BG, CONST, BAD = { 0, 0, 0 }, { 110, 110, 110 }, { 0, 90, 180 }, { 205, 225, 250 }, { 230, 230, 230 }, { 255, 255, 255 }, { 120, 120, 120 }, { 190, 30, 30 }
local ROW = 16

local function fit(gc, s, w)
  if gc:getStringWidth(s) <= w then return s end
  while #s > 1 and gc:getStringWidth(s .. '…') > w do s = s:sub(1, -2); while #s > 0 and s:byte(#s) >= 128 and s:byte(#s) < 192 do s = s:sub(1, -2) end end
  return s .. '…'
end
local function drawSym(gc, qi, x, y)
  local q = Q[qi]
  gc:setFont('serif', 'r', 11); gc:drawString(q[1], x, y, 'top')
  local w = gc:getStringWidth(q[1])
  if q[2] ~= '' then gc:setFont('serif', 'r', 8); gc:drawString(q[2], x + w, y + 6, 'top'); w = w + gc:getStringWidth(q[2]) end
  return w
end

local function paintList(gc)
  setColor(gc, ACC); gc:fillRect(0, 0, W, 18)
  gc:setColorRGB(255, 255, 255); gc:setFont('sansserif', 'b', 10)
  local t = {}
  for i = 1, 3 do if topics[i] then t[#t + 1] = TOPIC_NAME[i] end end
  gc:drawString(search ~= '' and ('Search: ' .. search .. '_') or 'Solver: ' .. (#t == 3 and 'optics, optoelectronics, semis' or table.concat(t, ', ')), 4, 2, 'top')
  local vis = floor((H - 18 - 14) / ROW)
  if sel < top then top = sel end
  if sel > top + vis - 1 then top = sel - vis + 1 end
  for i = top, math.min(#rows, top + vis - 1) do
    local r = rows[i]; local y = 18 + (i - top) * ROW
    if r.head then
      setColor(gc, HEAD); gc:fillRect(0, y, W, ROW); setColor(gc, MUTE); gc:setFont('sansserif', 'b', 9); gc:drawString(r.head, 4, y + 2, 'top')
    else
      local qi = r.qi; local k = known[qi]
      if i == sel then setColor(gc, SELBG); gc:fillRect(0, y, W, ROW) end
      setColor(gc, ignored[qi] and MUTE or INK)
      local sw = drawSym(gc, qi, 4, y)
      local val = ignored[qi] and 'ignored' or (k and showVal(qi, k.v) or '—')
      gc:setFont('sansserif', k and k.src == 'calc' and 'b' or 'r', 10)
      local vw = gc:getStringWidth(val)
      setColor(gc, k and (k.src == 'calc' and ACC or k.src == 'const' and CONST) or (k and INK) or MUTE)
      if not k then setColor(gc, MUTE) elseif k.src == 'user' then setColor(gc, INK) end
      gc:drawString(val, W - 4 - vw, y + 1, 'top')
      setColor(gc, MUTE); gc:setFont('sansserif', 'r', 9)
      local nx = math.max(52, sw + 10)
      gc:drawString(fit(gc, Q[qi][3], W - 8 - vw - nx), nx, y + 2, 'top')
    end
  end
  setColor(gc, HEAD); gc:fillRect(0, H - 14, W, 14); setColor(gc, MUTE); gc:setFont('sansserif', 'r', 8)
  gc:drawString(note or 'enter: set · type: search · ◀▶ unit · menu: options', 4, H - 13, 'top')
end

local function paintEdit(gc)
  local qi = edit.qi; local q = Q[qi]
  setColor(gc, BG); gc:fillRect(0, 0, W, H)
  setColor(gc, ACC); gc:fillRect(0, 0, W, 18); gc:setColorRGB(255, 255, 255); gc:setFont('sansserif', 'b', 10)
  gc:drawString(fit(gc, q[3], W - 8), 4, 2, 'top')
  setColor(gc, INK); local sw = drawSym(gc, qi, 8, 26); gc:setFont('serif', 'r', 11); gc:drawString(' =', 8 + sw, 26, 'top')
  setColor(gc, ACC); gc:drawRect(6, 46, W - 12, 22)
  setColor(gc, INK); gc:setFont('sansserif', 'r', 12); gc:drawString(edit.buf .. '|', 10, 49, 'top')
  local us = q[7]
  if #us > 0 then
    gc:setFont('sansserif', 'b', 11); setColor(gc, ACC)
    local u = '◀ ' .. us[edit.unit][1] .. ' ▶'; gc:drawString(u, W - 10 - gc:getStringWidth(u), 74, 'top')
  end
  setColor(gc, MUTE); gc:setFont('sansserif', 'r', 9)
  local y = 96
  local desc = q[4] ~= '' and q[4] or ''
  if q[5] ~= '' then desc = desc .. ' Also: ' .. q[5] .. '.' end
  for line in string.gmatch(desc, '[^\n]+') do
    local words, cur = {}, ''
    for w in string.gmatch(line, '%S+') do
      local t = cur == '' and w or cur .. ' ' .. w
      if gc:getStringWidth(t) > W - 16 then words[#words + 1] = cur; cur = w else cur = t end
    end
    words[#words + 1] = cur
    for _, l in ipairs(words) do if y < H - 28 then gc:drawString(l, 8, y, 'top'); y = y + 12 end end
  end
  if edit.err then setColor(gc, BAD); gc:drawString(edit.err, 8, H - 28, 'top') end
  setColor(gc, HEAD); gc:fillRect(0, H - 14, W, 14); setColor(gc, MUTE); gc:setFont('sansserif', 'r', 8)
  gc:drawString('enter: OK (empty clears) · ◀▶ unit · esc: cancel', 4, H - 13, 'top')
end

local function wrap(gc, s, w)
  local out, cur = {}, ''
  for word in string.gmatch(s, '%S+') do
    local t = cur == '' and word or cur .. ' ' .. word
    if gc:getStringWidth(t) > w and cur ~= '' then out[#out + 1] = cur; cur = word else cur = t end
  end
  if cur ~= '' then out[#out + 1] = cur end
  return out
end

local function detailLines(qi)
  local k = known[qi]; local L = {}
  local function add(t, s, c) L[#L + 1] = { t = t, s = s, c = c } end
  local q = Q[qi]
  local name = q[1] .. (q[2] ~= '' and '_' .. q[2] or '')
  if not k then add('h', q[3]); add('p', 'Not known yet.'); return L end
  add('h', q[3])
  add('b', name .. ' = ' .. showVal(qi, k.v), k.src == 'calc' and ACC or INK)
  if k.src == 'user' then add('p', 'You entered this value.') return L end
  if k.src == 'const' then add('p', 'Constant. Enter your own value to replace it.') return L end
  local f = F[k.f]
  add('s', 'From: ' .. f[1] .. '  (' .. f[3] .. ')')
  add('s', 'Formula:'); add('p', f[4])
  local s = f[7][k.k]
  if type(s) == 'table' and s[k.c] then add('s', 'Rearranged:'); add('p', name .. ' = ' .. s[k.c][2])
  else add('s', 'Solved numerically.') end
  add('s', 'With your values:')
  for j, q2 in ipairs(f[5]) do
    if j ~= k.k then local Qq = Q[q2]; add('p', Qq[1] .. (Qq[2] ~= '' and '_' .. Qq[2] or '') .. ' = ' .. showVal(q2, known[q2].v) .. (known[q2].src == 'calc' and '  (calculated)' or '')) end
  end
  if k.n and k.n > 1 then add('s', k.n .. ' solutions; the positive one is shown.') end
  if f[9] then add('s', 'An approximation, used only when nothing exact applies.') end
  if f[12] ~= '' then add('s', f[12]) end
  return L
end

local function paintDetail(gc)
  setColor(gc, BG); gc:fillRect(0, 0, W, H)
  local y = 4 - detail.scroll
  for _, l in ipairs(detail.lines) do
    if l.t == 'h' then gc:setFont('sansserif', 'b', 11); setColor(gc, INK)
    elseif l.t == 'b' then gc:setFont('serif', 'b', 12); setColor(gc, l.c or INK)
    elseif l.t == 's' then gc:setFont('sansserif', 'r', 9); setColor(gc, MUTE)
    else gc:setFont('serif', 'r', 11); setColor(gc, INK) end
    for _, t in ipairs(wrap(gc, l.s, W - 16)) do
      if y > -16 and y < H - 14 then gc:drawString(t, l.t == 'p' and 12 or 6, y, 'top') end
      y = y + (l.t == 's' and 13 or 16)
    end
    if l.t == 'h' or l.t == 'b' then y = y + 2 end
  end
  detail.max = math.max(0, y + detail.scroll - (H - 20))
  setColor(gc, HEAD); gc:fillRect(0, H - 14, W, 14); setColor(gc, MUTE); gc:setFont('sansserif', 'r', 8)
  gc:drawString('▲▼ scroll · enter: use my own value · esc: back', 4, H - 13, 'top')
end

local HELP = {
  { 'h', 'CalcShelf Solver' },
  { 'p', 'Every optics, optoelectronics and semiconductor formula from CalcShelf, in one list. Enter the values you know: each formula left with one unknown is solved, and its result feeds the others.' },
  { 's', 'Keys' },
  { 'p', '▲▼ move · enter: set a value (or show how a result was found) · start typing a number to set the selected value · type letters to search · ◀▶ change the unit shown · del: clear a value · esc: clear the search.' },
  { 's', 'Menu' },
  { 'p', 'Reset all values, clear or ignore a variable, choose the topics, list the formulas that use a variable.' },
  { 's', 'Values are in the unit shown when you enter them; ◀▶ in the entry box changes it. You can type expressions such as 1550e-9 or 2*pi.' },
  { 's', 'github.com/netadmindave/CalcShelf · GPL-3.0' },
}

function on.paint(gc)
  W, H = platform.window:width(), platform.window:height()
  setColor(gc, BG); gc:fillRect(0, 0, W, H)
  if mode == 'edit' then paintEdit(gc) elseif mode == 'detail' or mode == 'help' or mode == 'flist' then paintDetail(gc) else paintList(gc) end
end

------------------------------------------------------------------ actions
local function selQ() local r = rows[sel]; return r and r.qi end
local function startEdit(qi, first)
  edit.qi = qi; edit.err = nil
  local k = known[qi]
  local _, ui = unitFor(qi, k and k.v)
  edit.unit = userUnit[qi] or unitSel[qi] or ui or 1
  if first then edit.buf = first
  elseif user[qi] then local u = Q[qi][7][edit.unit]; edit.buf = fmtNum(user[qi] / (u and u[2] or 1)) else edit.buf = '' end
  mode = 'edit'; platform.window:invalidate()
end
local function commitEdit()
  local qi = edit.qi
  local s = edit.buf:gsub('^%s+', ''):gsub('%s+$', '')
  if s == '' then user[qi] = nil; userUnit[qi] = nil; mode = 'list'; refresh(); return end
  local v = tonumber(s)
  if not v and math.eval then
    local ok, r = pcall(math.eval, s)
    if ok then v = tonumber(r) end
  end
  if not v or not finite(v) then edit.err = 'Not a number: ' .. s; platform.window:invalidate(); return end
  local u = Q[qi][7][edit.unit]
  user[qi] = v * (u and u[2] or 1); userUnit[qi] = edit.unit; unitSel[qi] = edit.unit
  mode = 'list'; refresh()
end
local function showDetail(qi)
  detail.qi = qi; detail.scroll = 0
  local gc = nil
  detail.lines = detailLines(qi); mode = 'detail'; platform.window:invalidate()
end
local function showLines(L, m) detail.lines = {}; for _, l in ipairs(L) do detail.lines[#detail.lines + 1] = { t = l[1], s = l[2] } end detail.scroll = 0; mode = m; platform.window:invalidate() end
local function formulasOf(qi)
  local L = { { 'h', 'Formulas with ' .. Q[qi][3] } }
  for _, fi in ipairs(FQ[qi] or {}) do
    local f = F[fi]
    if topics[f[2]] then L[#L + 1] = { 's', f[1] .. (ignoredF[fi] and ' (ignored)' or '') }; L[#L + 1] = { 'p', f[4] } end
  end
  showLines(L, 'flist')
end

------------------------------------------------------------------ keys
function on.charIn(ch)
  if ch == '−' or ch == '‒' then ch = '-' elseif ch == 'ᴇ' or ch == 'E' and mode == 'edit' then ch = 'e' elseif ch == '×' then ch = '*' elseif ch == '÷' then ch = '/' end
  if mode == 'edit' then edit.buf = edit.buf .. ch; edit.err = nil; platform.window:invalidate(); return end
  if mode ~= 'list' then return end
  note = nil
  if search == '' and ch:match('^[%d%.%-]$') and selQ() then startEdit(selQ(), ch); return end
  if ch:match('^[%w%s%p]$') or ch:byte(1) >= 128 then search = search .. ch; buildRows(); platform.window:invalidate() end
end
function on.backspaceKey()
  if mode == 'edit' then edit.buf = edit.buf:sub(1, -2); while #edit.buf > 0 and edit.buf:byte(#edit.buf) >= 128 and edit.buf:byte(#edit.buf) < 192 do edit.buf = edit.buf:sub(1, -2) end; platform.window:invalidate(); return end
  if mode ~= 'list' then return end
  if search ~= '' then search = search:sub(1, -2); buildRows(); platform.window:invalidate(); return end
  local qi = selQ(); if qi and user[qi] then user[qi] = nil; userUnit[qi] = nil; refresh() end
end
function on.clearKey()
  if mode == 'edit' then edit.buf = ''; platform.window:invalidate(); return end
  if mode == 'list' then search = ''; buildRows(); platform.window:invalidate() end
end
function on.escapeKey()
  if mode == 'list' then if search ~= '' then search = ''; buildRows() end; note = nil
  else mode = 'list' end
  platform.window:invalidate()
end
function on.enterKey()
  if mode == 'edit' then commitEdit(); return end
  if mode == 'detail' then startEdit(detail.qi); return end
  if mode ~= 'list' then mode = 'list'; platform.window:invalidate(); return end
  local qi = selQ(); if not qi then return end
  local k = known[qi]
  if k and k.src == 'calc' then showDetail(qi) else startEdit(qi) end
end
local function move(d)
  local i = sel
  repeat i = i + d until i < 1 or i > #rows or rows[i].qi
  if i >= 1 and i <= #rows then sel = i end
  platform.window:invalidate()
end
function on.arrowUp() if mode == 'list' then move(-1) elseif mode ~= 'edit' then detail.scroll = math.max(0, detail.scroll - 16); platform.window:invalidate() end end
function on.arrowDown() if mode == 'list' then move(1) elseif mode ~= 'edit' then detail.scroll = math.min(detail.max or 0, detail.scroll + 16); platform.window:invalidate() end end
local function cycleUnit(d)
  if mode == 'edit' then
    local n = #Q[edit.qi][7]; if n > 0 then edit.unit = (edit.unit - 1 + d) % n + 1 end
  elseif mode == 'list' then
    local qi = selQ(); if not qi then return end
    local n = #Q[qi][7]; if n == 0 then return end
    local k = known[qi]; local _, cur = unitFor(qi, k and k.v)
    unitSel[qi] = ((cur or 1) - 1 + d) % n + 1
  end
  platform.window:invalidate()
end
function on.arrowLeft() cycleUnit(-1) end
function on.arrowRight() cycleUnit(1) end
function on.tabKey() if mode == 'list' then for i = sel + 1, #rows do if rows[i].head then for j = i + 1, #rows do if rows[j].qi then sel = j; platform.window:invalidate(); return end end end end; for j = 1, #rows do if rows[j].qi then sel = j; break end end; platform.window:invalidate() end end
function on.mouseDown(x, y)
  if mode ~= 'list' then return end
  local i = top + floor((y - 18) / ROW)
  if y < 18 or y > H - 14 or not rows[i] or not rows[i].qi then return end
  if i == sel then on.enterKey() else sel = i; platform.window:invalidate() end
end

------------------------------------------------------------------ menu
local function resetAll() user, userUnit = {}, {}; note = 'All values cleared.'; refresh() end
local function clearSel() local qi = selQ(); if qi then user[qi] = nil; userUnit[qi] = nil; refresh() end end
local function ignoreSel() local qi = selQ(); if qi then ignored[qi] = not ignored[qi] or nil; note = ignored[qi] and 'Ignored: formulas with it are not used.' or 'No longer ignored.'; refresh() end end
local registerMenu
local function setTopic(i) return function() topics[i] = not topics[i]; local any = false; for t = 1, 3 do any = any or topics[t] end; if not any then topics[i] = true end; registerMenu(); refresh() end end
function registerMenu()
  local function mark(i) return (topics[i] and '✓ ' or '    ') .. TOPIC_NAME[i] end
  toolpalette.register({
    { 'Values', { 'Reset all values', resetAll }, { 'Clear this value', clearSel }, { 'Ignore / use this variable', ignoreSel } },
    { 'Topics', { mark(1), setTopic(1) }, { mark(2), setTopic(2) }, { mark(3), setTopic(3) },
      { 'All topics', function() topics = { true, true, true }; registerMenu(); refresh() end } },
    { 'Show', { 'How this was found', function() local qi = selQ(); if qi then showDetail(qi) end end },
      { 'Formulas with this variable', function() local qi = selQ(); if qi then formulasOf(qi) end end },
      { 'Help', function() showLines(HELP, 'help') end } },
  })
end

------------------------------------------------------------------ saved with the document
function on.save()
  local u, uu, us, ig = {}, {}, {}, {}
  for k, v in pairs(user) do u[tostring(k)] = v end
  for k, v in pairs(userUnit) do uu[tostring(k)] = v end
  for k, v in pairs(unitSel) do us[tostring(k)] = v end
  for k in pairs(ignored) do ig[#ig + 1] = k end
  return { user = u, userUnit = uu, unitSel = us, ignored = ig, topics = { topics[1] and 1 or 0, topics[2] and 1 or 0, topics[3] and 1 or 0 } }
end
function on.restore(s)
  if type(s) ~= 'table' then return end
  for k, v in pairs(s.user or {}) do user[tonumber(k)] = v end
  for k, v in pairs(s.userUnit or {}) do userUnit[tonumber(k)] = v end
  for k, v in pairs(s.unitSel or {}) do unitSel[tonumber(k)] = v end
  for _, k in ipairs(s.ignored or {}) do ignored[k] = true end
  if s.topics then for i = 1, 3 do topics[i] = s.topics[i] ~= 0 end end
  registerMenu(); refresh()
end

registerMenu()
solve(); buildRows()

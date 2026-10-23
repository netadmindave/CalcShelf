# Retakes the pictures in docs/img for the user guide. Run from tests/ with the app served on :8091.
# Shots that need firmware are taken only when the file is in CALC_FW; the others are kept as they are.
# Then run core-build/docs/webp.py to make the WebP copies the Guide tab shows.
import os
import asyncio
from PIL import Image
from playwright.async_api import async_playwright
U = os.environ.get('CALC_FW', 'firmware') + '/'
OUT = os.environ.get('SHOTS_OUT', '../docs/img') + '/'
B = 'http://localhost:8091'

def shrink(name, w):
    p = OUT + name; im = Image.open(p)
    if im.width > w: im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).save(p, optimize=True)

async def shot(pg, name, w=480):
    await pg.screenshot(path=OUT + name); shrink(name, w); print('took', name)

async def cas(pg, tex):
    await pg.evaluate("async (t)=>{ const p=__app.page; p.mf.value=t; await p.enter(false); }", tex); await pg.wait_for_timeout(900)

async def emu_file(pg, fam, model, path):
    await pg.evaluate("([fam, model]) => { const f=document.querySelector('#file-emu'); f.multiple=false; f.onchange=()=>{ const fs=[...f.files]; f.value=''; __app.emuApply(fam, model, fs); }; }", [fam, model])
    await pg.set_input_files('#file-emu', path)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        mk = lambda w=393, h=852: b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2.5, has_touch=True, is_mobile=True)
        async def fresh(w=393, h=852):
            ctx = await mk(w, h); pg = await ctx.new_page()
            await pg.goto(B + '/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2500)
            return ctx, pg
        # CAS with its keypad
        ctx, pg = await fresh()
        for t in ['\\int_0^{\\pi}\\sin\\left(x\\right)^2dx',
                  '6.022ᴇ23\\times2', '1.5ᴇ{-}3\\div4']:
            await cas(pg, t)
        # units typed the way the keypad does it: 9.81 _m/_s² × 2 _kg
        await pg.evaluate("(() => { const p=__app.page; p.mf.value='9.81'; p.mf.focus(); p.mf.position=99; })()")
        for a in ["insert('\\\\_')", "typed('m')", "typed('/')", "insert('\\\\_')", "typed('s')", "typed('^')", "typed('2')"]:
            await pg.evaluate("__app." + a)
        await pg.evaluate("(() => { const p=__app.page; p.mf.position=999; })()")
        for a in ["insert('\\\\times')", "typed('2')", "insert('\\\\_')", "typed('k')", "typed('g')"]:
            await pg.evaluate("__app." + a)
        print('units entry:', await pg.evaluate("__app.page.mf.value"))
        await pg.evaluate("__app.page.enter(false)"); await pg.wait_for_timeout(1500)
        await pg.evaluate("__app.page.mf.value='\\\\sqrt{2}'"); await pg.wait_for_timeout(1500)
        await shot(pg, 'cas.png')
        # uncertainty budget
        await cas(pg, '\\left(5.03\\pm0.02\\right)\\times\\left(2.1\\pm0.1\\right)')
        await pg.evaluate("(() => { const p=__app.page; p.uncSheet(p.history[p.history.length-1]); })()"); await pg.wait_for_timeout(1200)
        await shot(pg, 'uncertainty.png')
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(500)
        # triangle solver
        await pg.evaluate("Library.open(__app, 'trig')"); await pg.wait_for_timeout(1200); await shot(pg, 'trig.png')
        await ctx.close()
        # TI-36X Pro in the calculator tab
        ctx, pg = await fresh()
        await pg.evaluate("__app.emuApply('ti36','36xpro',null)"); await pg.wait_for_timeout(1500)
        for t in ['\\frac{1}{2}+\\frac{1}{3}', '\\sin\\left(30\\right)', '\\sqrt{8}']:
            await pg.evaluate("async (t)=>{ const p=__app.page.t36; p.mf.value=t; await p.enter(); }", t); await pg.wait_for_timeout(900)
        await shot(pg, 'ti36.png')
        await pg.evaluate("__app.page.t36.setNight(true)"); await pg.wait_for_timeout(500); await shot(pg, 'ti36-night.png')
        await pg.evaluate("__app.page.t36.setNight(false)")
        await ctx.close()
        # HP 48GX and 49g+, then several calculators open in tabs
        for model, name in [('48gx', 'hp48gx.png'), ('49gp', 'hp49gplus.png')]:
            ctx, pg = await fresh()
            await pg.evaluate("(m) => __app.emuApply('hp', m, null)", model); await pg.wait_for_timeout(5000)
            fr = next(f for f in pg.frames if '/hp/' in f.url); ID = await fr.evaluate("__hp.ID")
            for k in ['7', 'ENTER', '6', '×']: await fr.locator(f'.key[data-id="{ID[k]}"]').click(); await pg.wait_for_timeout(300)
            await pg.wait_for_timeout(1500); await shot(pg, name)
            await ctx.close()
        ctx, pg = await fresh()
        await pg.evaluate("__app.settings.multiEmu = true")
        for fam, model in [('ti36', '36xpro'), ('hp', '48gx'), ('hp', '49gp')]:
            await pg.evaluate("([f, m]) => { __app._emuTarget = null; return __app.emuApply(f, m, null); }", [fam, model]); await pg.wait_for_timeout(4000)
        await pg.wait_for_timeout(2000); await shot(pg, 'tabs.png')
        await ctx.close()
        # TI-92 Plus and Voyage 200: landscape only, the full width of the screen
        if os.path.exists(U + 'ti92p.rom'):
            for model, name in [('92p', 'ti92plus.png'), ('v200', 'v200.png')]:
                ctx, pg = await fresh(852, 393)
                await emu_file(pg, 'ti68k', model, U + 'ti92p.rom'); await pg.wait_for_timeout(9000)
                fr = next(f for f in pg.frames if '/ti89/' in f.url)
                await fr.evaluate("__ti.typeText('solve(x^2=4,x)', true)"); await pg.wait_for_timeout(6000)
                await fr.evaluate("__ti.typeText('2+3', true)"); await pg.wait_for_timeout(3000)
                await shot(pg, name, 1000)
                await ctx.close()
        # TI-89 Titanium and TI-84 Plus SE, when their OS is at hand
        if os.path.exists(U + 'TI89Titanium_OS.89u'):
            ctx, pg = await fresh()
            await emu_file(pg, 'ti68k', '89', U + 'TI89Titanium_OS.89u'); await pg.wait_for_timeout(12000)
            fr = next(f for f in pg.frames if '/ti89/' in f.url)
            await fr.evaluate("__ti.typeText('solve(x^2-2=0,x)', true)"); await pg.wait_for_timeout(6000)
            await fr.evaluate("__ti.typeText('∫(sin(x)^2,x,0,π)', true)"); await pg.wait_for_timeout(6000)
            await shot(pg, 'ti89.png'); await ctx.close()
        if os.path.exists(U + 'ti84se.rom'):
            ctx, pg = await fresh()
            await emu_file(pg, 'z80', 'z', U + 'ti84se.rom'); await pg.wait_for_timeout(6000)
            fr = next(f for f in pg.frames if '/classic/' in f.url)
            await fr.evaluate("window.__c && __c.typeText ? __c.typeText('2+3*4', true) : null"); await pg.wait_for_timeout(2500)
            await shot(pg, 'ti84.png'); await ctx.close()
        await b.close()
asyncio.run(main())

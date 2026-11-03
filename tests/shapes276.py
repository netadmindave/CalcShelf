# Every emulator at seven window shapes (phone, phone landscape, tablet both ways, half a tablet, square, wide):
# one contact sheet per calculator in out/shapes. Usage: python3 shapes276.py hp|hp49|t36|92p|84|ns
import asyncio, sys, os
from playwright.async_api import async_playwright
from PIL import Image
B='http://localhost:8091'; OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'shapes') + '/'
os.makedirs(OUT, exist_ok=True)
which = sys.argv[1]
SIZES=[(393,852,'phone'),(852,393,'phoneL'),(800,1280,'tabP'),(1280,800,'tabL'),(640,800,'half'),(700,700,'sq'),(1000,500,'wide')]
async def open_emu(pg):
    if which=='hp': await pg.evaluate("__app.emuApply('hp','48gx',null)"); await pg.wait_for_timeout(6000)
    elif which=='hp49': await pg.evaluate("__app.emuApply('hp','49gp',null)"); await pg.wait_for_timeout(6000)
    elif which=='t36': await pg.evaluate("__app.emuApply('ti36','36xpro',null)"); await pg.wait_for_timeout(2000)
    elif which in ('92p','92pad'):
        if which=='92pad':
            pass
        await pg.evaluate("([fam, model]) => { const f=document.querySelector('#file-emu'); f.onchange=()=>{ const fs=[...f.files]; f.value=''; __app.emuApply(fam, model, fs); }; }", ['ti68k','92p'])
        await pg.set_input_files('#file-emu', os.environ.get('CALC_FW', 'firmware') + '/ti92p.rom'); await pg.wait_for_timeout(9000)
    elif which=='84': await pg.evaluate("__app.emuApply('z80','z',null)"); await pg.wait_for_timeout(3000)
    elif which=='ns':
        await pg.evaluate("__app.settings.multiEmu=false")
        await pg.evaluate("([fam, model]) => { const f=document.querySelector('#file-emu'); f.multiple=true; f.onchange=()=>{ const fs=[...f.files]; f.value=''; __app.emuApply(fam, model, fs); }; }", ['nspire','cx2cas'])
        NS=os.environ.get('NSPIRE_FW', 'nsfw') + '/'
        await pg.set_input_files('#file-emu', [NS+f for f in ['boot1.img','manuf.img','btldr.img','instl.img','diags.img','os.tcc2']]); await pg.wait_for_timeout(5000)
        fr = next(f for f in pg.frames if '/nspire/' in f.url)
        btn = fr.locator('#ns-install, button:has-text("Install")').first
        if await btn.count(): await btn.click()
        for i in range(60):
            await pg.wait_for_timeout(3000)
            if await fr.evaluate("document.querySelector('#setup') ? document.querySelector('#setup').hidden : true"): break
        await pg.wait_for_timeout(15000)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':393,'height':852}, device_scale_factor=1.5, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2500)
        await open_emu(pg)
        ims=[]
        for w,h,tag in SIZES:
            await pg.set_viewport_size({'width':w,'height':h}); await pg.wait_for_timeout(1500)
            f=OUT+f'{which}_{tag}.png'; await pg.screenshot(path=f); ims.append(Image.open(f))
        ims=[i.resize((int(i.width*450/i.height),450)) for i in ims]
        W=sum(i.width for i in ims)+10*len(ims); c=Image.new('RGB',(W,450),'white'); x=0
        for i in ims: c.paste(i,(x,0)); x+=i.width+10
        c.save(OUT+f'sheet_{which}.png'); print(which,'errors',errs[:3])
        await b.close()
asyncio.run(main())

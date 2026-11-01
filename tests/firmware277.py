# Firmware copies: a file chosen for a calculator is kept in the app's storage, choosing another replaces it, backups
# include it, restoring on an empty phone installs it again, and firmware loaded before this version is copied over.
# Needs CALC_FW with ti92p.rom (your own dump) and, for the Nspire part, NSPIRE_FW with its system files and OS.
import asyncio, json, os, shutil, sys, tempfile
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8091'
FW = os.environ.get('CALC_FW', 'firmware'); NS = os.environ.get('NSPIRE_FW', '')
OUT = os.path.join(os.path.dirname(__file__), 'out'); os.makedirs(OUT, exist_ok=True)

async def main():
    tmp = tempfile.mkdtemp()
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 852, 'height': 393}, accept_downloads=True)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append('PAGE ' + str(e)))
        await pg.goto(BASE + '/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2500)
        E = pg.evaluate
        idx = "(async () => { const i = await FwStore.index(); return Object.entries(i).map(([k, e]) => k + ': ' + e.files.map(f => f.name + ' ' + f.size).join(', ')).join(' | '); })()"
        async def emu_file(fam, model, path, name=None):
            if name: shutil.copy(path, os.path.join(tmp, name)); path = os.path.join(tmp, name)
            await E("([fam, model]) => { const f = document.querySelector('#file-emu'); f.multiple = true; f.onchange = () => { const fs = [...f.files]; f.value = ''; __app.emuApply(fam, model, fs); }; }", [fam, model])
            await pg.set_input_files('#file-emu', path if isinstance(path, list) else [path])
        await emu_file('ti68k', '92p', os.path.join(FW, 'ti92p.rom')); await pg.wait_for_timeout(9000)
        print('after choosing:', await E(idx))
        await emu_file('ti68k', '92p', os.path.join(FW, 'ti92p.rom'), 'my92plus.rom'); await pg.wait_for_timeout(8000)
        print('after replacing:', await E(idx))
        if NS:
            files = [os.path.join(NS, f) for f in ['boot1.img', 'manuf.img', 'btldr.img', 'instl.img', 'diags.img', 'os.tcc2']]
            await E("__app.settings.multiEmu = true")
            await emu_file('nspire', 'cx2cas', files); await pg.wait_for_timeout(6000)
            print('nspire:', await E(idx))
        # backup with firmware
        await pg.locator('#btn-doc').click(); await pg.wait_for_timeout(300)
        async with pg.expect_download() as dl:
            await pg.locator('#sheet-body .mi', has_text='Back up').first.click()
        path = os.path.join(tmp, 'backup.tns.json'); await (await dl.value).save_as(path)
        d = json.load(open(path))
        print('backup:', os.path.getsize(path) // 1024, 'KB |', [(f['fam'], f['model'], f['name'], len(f['b64'])) for f in d.get('firmware', [])], '| tabs', [p['kind'] + ':' + str(p['state'].get('model', '')) for p in d['pages']])
        await ctx.close()
        # an empty phone: restore it
        ctx = await b.new_context(viewport={'width': 852, 'height': 393}); pg = await ctx.new_page()
        pg.on('pageerror', lambda e: errs.append('PAGE2 ' + str(e)))
        await pg.goto(BASE + '/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2500)
        E = pg.evaluate
        print('empty phone:', repr(await E(idx)))
        pg.on('dialog', lambda dg: asyncio.ensure_future(dg.accept()))
        await pg.locator('#btn-doc').click(); await pg.wait_for_timeout(300)
        async with pg.expect_file_chooser() as fc:
            await pg.locator('#sheet-body .mi', has_text='Restore from backup').click()
        await (await fc.value).set_files(path); await pg.wait_for_timeout(4000)
        print('restored:', await E(idx), '| pending', await E("UI.DB.get('fw:pending')"))
        i = await E("__app.pages.findIndex(p => p.kind === 'emu' && p.model === '92p')")
        await E(f"__app.select({i})"); await pg.wait_for_timeout(9000)
        fr = next((f for f in pg.frames if '/ti89/' in f.url), None)
        print('92+ running after restore:', await fr.evaluate("document.querySelector('#setup').hidden") if fr else 'no frame', '| pending', await E("UI.DB.get('fw:pending')"))
        await pg.screenshot(path=OUT + '/firmware_restored.png')
        # firmware loaded before this version: copied once from the calculator's own storage
        await E("(async () => { await UI.DB.del('fw:index'); await UI.DB.del('fw:migrated'); })()")
        await E("FwStore.migrate(EMU_MODELS_FOR_TEST)") if False else None
        await pg.reload(); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(3000)
        print('copied from an older install:', await E(idx))
        print('errors', errs[-6:])
        await b.close()
asyncio.run(main())

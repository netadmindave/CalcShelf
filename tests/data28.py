# 2.8 Data & Fit: import, dB → linear, fits with uncertainties, peaks, measure, FFT, table; Lists import.
import asyncio
from playwright.async_api import async_playwright
BASE='http://localhost:8091'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':393,'height':852}, device_scale_factor=2.75, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto(BASE+'/index.html'); await pg.wait_for_function("window.__app && __app.page && __app.cas"); await pg.wait_for_timeout(2000)
        E=lambda js: pg.evaluate(js)
        await E("__app.addPage('data')"); await pg.wait_for_timeout(400)
        await pg.screenshot(path='out/data_empty.png')
        await pg.set_input_files('.page.data input[type=file]', 'files/osa_two_lines.csv'); await pg.wait_for_timeout(800)
        print('columns:', await E("__app.page.cols.map(c=>c.name+'['+c.unit+']:'+c.v.length).join(', ')"))
        # dBm → mW
        await pg.locator('.page.data .seg button', has_text='Transform').tap(); await pg.wait_for_timeout(200)
        await pg.locator('.page.data .mi', has_text='dB ↔ linear').tap(); await pg.wait_for_timeout(300)
        await pg.locator('#sheet-body .btn.pri').tap(); await pg.wait_for_timeout(400)
        print('y now:', await E("__app.page.cols[__app.page.y].name"))
        # peaks
        await pg.locator('.page.data .seg button', has_text='Peaks').tap(); await pg.wait_for_timeout(400)
        print('peaks:', await E("__app.page.peakList.map(p=>[p.x.toFixed(4),p.y.toFixed(4),p.fwhm.toFixed(4)].join('/')).join('  ')"))
        await pg.screenshot(path='out/data_peaks.png')
        # fit the second peak (Lorentzian) via its Fit button, switch preset to Lorentzian
        await pg.locator('.page.data .dt-tbl .chip', has_text='Fit').nth(1).tap(); await pg.wait_for_timeout(400)
        await pg.locator('.page.data select[aria-label="Model"]').select_option('lorentz'); await pg.wait_for_timeout(300)
        await pg.locator('.page.data .btn.pri', has_text='Fit').tap(); await pg.wait_for_timeout(800)
        print('lorentz fit:', await E("__app.page.result && __app.page.result.names.map((n,k)=>n+'='+DataTools.fmtPM(__app.page.result.p[k],__app.page.result.sd[k])).join('; ')"))
        print('  stats:', await E("(r=>'n='+r.n+' redchi2='+r.redchi2.toExponential(2)+' R2='+r.r2.toFixed(5)+' iter='+r.iter+' conv='+r.converged)(__app.page.result)"))
        await pg.screenshot(path='out/data_fit.png', full_page=False)
        await pg.locator('.page.data .btn', has_text='Store in the CAS').tap(); await pg.wait_for_timeout(500)
        print('x0 in CAS:', await E("__app.cas.eval('x0')"), await E("__app.cas.eval('w_sd')"))
        # measure
        await pg.locator('.page.data .seg button', has_text='Measure').tap(); await pg.wait_for_timeout(300)
        print('measure:', (await pg.locator('.page.data .dt-card').inner_text()).replace('\n',' | ')[:300])
        # gaussian on whole data: fails/ok
        # FFT of a sine made by an expression column
        await E("__app.page.cols=[{name:'t (s)',unit:'s',v:Float64Array.from({length:1000},(_, i)=>i/1000)}]; __app.page.cols.push({name:'v',unit:'V',v:Float64Array.from(__app.page.cols[0].v,t=>1.5*Math.sin(2*Math.PI*120*t)+0.3)}); __app.page.x=0; __app.page.y=1; __app.page.refresh()")
        await pg.locator('.page.data .seg button', has_text='FFT').tap(); await pg.wait_for_timeout(200)
        await pg.locator('.page.data .btn.pri', has_text='Compute').tap(); await pg.wait_for_timeout(500)
        print('fft:', (await pg.locator('.page.data .dt-card').inner_text()).replace('\n',' | '))
        await pg.screenshot(path='out/data_fft.png')
        # sine fit on the original columns
        await E("__app.page.x=0; __app.page.y=1; __app.page.renderSel(); __app.page.redraw(true)")
        await pg.locator('.page.data .seg button', has_text='Fit').tap(); await pg.wait_for_timeout(200)
        await pg.locator('.page.data select[aria-label="Model"]').select_option('sine'); await pg.wait_for_timeout(200)
        await pg.locator('.page.data .btn.pri', has_text='Fit').tap(); await pg.wait_for_timeout(800)
        print('sine fit:', await E("__app.page.result && __app.page.result.names.map((n,k)=>n+'='+DataTools.fmtPM(__app.page.result.p[k],__app.page.result.sd[k])).join('; ')"))
        # table
        await pg.locator('.page.data .seg button', has_text='Table').tap(); await pg.wait_for_timeout(300)
        print('table cells:', await pg.locator('.page.data .dt-tbl span').count())
        # save/restore
        d = await E("JSON.stringify(__app.page.serialize()).length"); print('serialized bytes:', d)
        # Lists import
        await E("__app.addPage('lists')"); await pg.wait_for_timeout(300)
        await E("(async()=>{ const t=Numeric.parseTable('x,y\\n1,2\\n2,4.5\\n3,7\\n'); await __app.page.importColumns(t.names.map((n,i)=>[n,Array.from(t.cols[i])])); })()"); await pg.wait_for_timeout(800)
        print('lists x,y in CAS:', await E("__app.cas.eval('y')"), '| cell b2:', await E("__app.page.cells.b2.v"))
        print('errors', errs)
        await b.close()
asyncio.run(main())

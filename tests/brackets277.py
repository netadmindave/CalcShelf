# Keypad brackets: ( at the end makes a pair (also inside a pair), ) closes the innermost open ( first, then steps out.
import asyncio, sys
from playwright.async_api import async_playwright
SEQS = [
 ('A 2×(3+4)+1', '2 × ( 3 + 4 ) + 1', '15'),
 ('B (1+2)÷3', '( 1 + 2 ) ÷ 3', '1'),
 ('C 5÷(2+3)', '5 ÷ ( 2 + 3 )', '1'),
 ('D ((1+2)×3)', '( ( 1 + 2 ) × 3 )', '9'),
 ('E (1+2)^2', '( 1 + 2 ) ^ 2', '9'),
 ('G 3(2)', '3 ( 2 )', '6'),
 ('H 2×(3+4 unclosed', '2 × ( 3 + 4', '14'),
 ('I (2+3)×(4+5)', '( 2 + 3 ) × ( 4 + 5 )', '45'),
 ('J 2×((3+4)', '2 × ( ( 3 + 4 )', '14'),
 ('K (1+2)(3+4)', '( 1 + 2 ) ( 3 + 4 )', '21'),
 ('L ((1+2)×3)+1', '( ( 1 + 2 ) × 3 ) + 1', '10'),
 ('M (2×(3+4))÷2', '( 2 × ( 3 + 4 ) ) ÷ 2', '7'),
]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width':393,'height':852}, has_touch=True, is_mobile=True)).new_page()
        await pg.goto('http://localhost:8091/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2500)
        mf = pg.locator('.page:not([hidden]) math-field').first
        async def key(l):
            k = pg.locator('.kpage[data-id="num"] .key:has(.kf:text-is("%s"))' % l).first
            await k.tap(); await pg.wait_for_timeout(60)
        for name, seq, want in SEQS:
            await mf.evaluate('m => m.value = ""')
            steps = []
            for l in seq.split():
                await key(l); steps.append(l + ' ' + await mf.evaluate('m => m.value'))
            v = await mf.evaluate('m => m.value')
            await pg.evaluate('__app.page.enter()'); await pg.wait_for_timeout(1200)
            out = await pg.evaluate("(() => { const r = document.querySelectorAll('.page:not([hidden]) .hist .row'); return r[r.length-1].querySelector('.out').innerText.replace(/\\n/g,' '); })()")
            print(('OK ' if out.strip() == want else 'XX ') + name.ljust(22), v.ljust(55), '=>', out)
            if out.strip() != want: print('    ' + '\n    '.join(steps))
        await b.close()
asyncio.run(main())

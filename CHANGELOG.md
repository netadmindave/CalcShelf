# Changelog

CalcShelf was called **CAS Touch** up to 2.6.1, and began as **TI-89 Touch** (1.x), a TI-89 Titanium emulator with a modern touch UI. Versions 2.0 and 2.1 added the Nspire-style CAS, the classic TI calculators, the conversion tool and constants in alternative units.

## 2.7.2

- **Conversion tool, Units:** the From and To units are now dropdowns listing the units of the chosen quantity. *Other unit…* still takes any typed unit, including compound ones such as W/(m·K).
- **Conversion tool, Optics** (it was *Light & photons*): converts a linewidth or bandwidth between Δλ and Δν at a centre wavelength or frequency. For example, 0.02 nm at 1550 nm is 2495.7 MHz. Pick the result's unit (fm to µm, Hz to THz, 1/cm, µeV to eV or rad/s). The result also shows Δλ, Δν, Δν̃, Δω and ΔE, the fractional width, Q, the coherence length and time, and the transform-limited pulse lengths. The photon equivalents of the centre are still listed below.
- **Formulas:** new *Linewidth conversion (centre frequency)*, Δλ = cΔν/ν².

## 2.7.1 — CalcShelf

- **New name: CalcShelf** (it was CAS Touch, and TI-89 Touch before that). The app ID stays `com.ti89touch`, so it installs as an update and keeps your data.
- **TI-89 command finder:** every description is newly written. The names and Insert now use the right characters, for example exp▸list(, list▸mat(, P▸Rx( and R▸Pθ(, and commands such as normCdf( no longer insert a doubled parenthesis.
- The app no longer asks for the vibrate permission.
- First public release, with the user guide, build guide and credits.

## 2.7
- **Several emulated calculators at once.** Settings → Emulated calculators → *Several, running at once*. Each emulator tab is a different model, and the tabs in the background keep running at their own speed. Add one from + or the main menu; change a tab's model from its tab menu. This uses more battery and memory.
- **TI-36X Pro night display.** Choose *Night display* from the TI-36X Pro tab's menu (tap the open tab).
- **Removed: swiping keys for shifted functions**, on every keypad (CAS, TI, HP, TI-Nspire). Long-press a key to choose its 2nd, ◆ or shifted function, or tap the shift key first.
- **Removed: key vibration** and its settings.
- **HP 48 and 49:** the extra *Change calculator* item in the calculator's menu is gone (use the tab menu). The *Classic / Paper / Night* screen styles now work.

## 2.6.1

- **HP 48 menu keys show their labels.** The A–F keys show the menu labels from the bottom row of the screen (VECTR, MATR, LIST…), and they update as the menu changes.
- **Fix:** in dark mode, the HP 48's A–F keys and α key had light text on light keys, so they looked blank.

## 2.6

- **HP 48GX, HP 48SX, HP 49g+ and HP 49G.** These run HP's own ROMs on the Emu48 core, built to WebAssembly with a single-threaded host. They are ready to use: the ROMs are in the app.
  - Each keypad is laid out like the real calculator, with the left-shift and right-shift legends in each model's colours and the alpha letters. The 49 models have their arrow pad.
  - Tap ◀ or ▶ and the keys show their shifted functions. You can also swipe up on a key for ◀, down for ▶, or long-press it to choose.
  - Arrows and ⌫ repeat when held. Holding a menu key shows its full name, as on the real calculator.
  - The ⌨ key types text as key presses, using alpha lock for letters. It can also put the text on the stack as a string.
  - **Load an object** puts `.hp` binary objects or text files on stack level 1.
  - Speed can be Real, 2×, 4× or Max. Max is about 30× a real 48GX.
  - Memory is saved every 20 seconds and when you leave. On the 49 models this includes the flash (port 2).
  - A new calculator answers "Try To Recover Memory?" with NO by itself. The 49 models start in algebraic mode, like the real ones; MODE switches to RPN.
- **The HP-42S, HP-12C, HP-15C and HP-16C have been removed.** An emulator tab that used one of them opens as the HP 48GX.
- **TI-92 Plus, TI-92 and Voyage 200 use Graph89's layout.** Every key is where it is on the real calculator, at the positions taken from Graph89's skins:
  - On the Voyage 200, the F1–F8 keys sit under the screen.
  - On the TI-92 and TI-92 Plus, F1–F8 are in two columns left of the screen.
  - In both, the cursor pad and number block are on the right, with the QWERTY keyboard below.
  - Each key shows its 2nd and ◆ legends.
  - The layout is landscape. In portrait the page turns sideways, so you can turn the phone.
  - **Settings → Keypad → Two pages in portrait** brings back the earlier portrait keypad.

## 2.5

- **TI-Nspire CX II CAS.** The emulator tab can now run the real TI-Nspire OS on the Firebird core, built to WebAssembly.
  - Choose **TI-Nspire CX II CAS** in Replace OS or change calculator. Then select all your files at once: the boot ROM with its keys (`injected_btrom`), manuf, btldr, instl, diags and the OS (`.tcc2`).
  - The app recognises each file by its contents, so the file names don't matter. It warns you if a boot ROM has no keys or an OS is for another model. The OS loader (osldr) isn't needed.
  - **Install the OS** builds the flash from your files and runs TI's own installer. This takes about 2 minutes once: about 30 s to send the OS, 70 s for the first start, and a few seconds to save.
  - After that, the calculator resumes in about 1 second, exactly where you left it. The 132 MiB flash is stored compressed in groups of 16 blocks, and only changed groups are written again.
  - The keypad is the CX II keypad. The clickpad works as arrows when you tap its edge and as a click when you tap its centre. Hold it to grab. Swipe up on a key for its ctrl function (a setting), or tap ctrl first.
  - You can type with the ⌨ key or a hardware keyboard. Exponents are typed into the raised box and then left with →, so `x^2-5x+6` comes out as you would expect.
  - From the menu you can send a document (`.tns`), take a screenshot, save, reset, load a new OS, or erase everything. You can also set the speed (real or fast).
- **Limits.**
  - The emulator runs at about half the real calculator's speed while it is computing; idle screens are instant. The status line shows the speed.
  - It uses about 330 MB of memory while it runs.
  - It needs a current Android System WebView (WebAssembly exception handling). An older WebView shows a message that asks you to update it.
- **No TI code is included.** Your system files and OS stay on your phone, in the app's private storage.

## 2.4

- **A new line starts from ans** (CAS and TI-36X Pro), like a TI calculator: + − × ÷ ^ x² ! % and sto→ on an empty line insert ans first. (−) still starts a negative number. Turn this off in Settings.
- **Parentheses come in pairs.** ( inserts ( ) with the cursor inside. ) steps out of the enclosing ( ), or, when none is open, puts ( at the start: `2+3)` becomes `(2+3)`. This also works from a hardware keyboard.
- **Decimal under exact answers.** √2 shows ≈ 1.414 21 underneath. This is a setting.
- **Digit grouping.** Long numbers show with thin spaces: 1 099 511 627 776. This is a setting; inserted values are never grouped.
- **Uncertainty propagation.** Type values as value ± σ, for example `(5.03±0.02)×(2.1±0.1)` gives 10.56 ± 0.50 (relative ± 4.8 %).
  - Propagation is first order for independent inputs, with numeric partial derivatives, so any function and angle mode works.
  - Tap the result for the uncertainty budget: the sensitivity, contribution and share of each input.
  - The ± key is ◆ (−), and it is also on the f(x) page.
- **Unit-aware results.** Results with units show clean unit names, with one-tap convert chips on the newest answer (→ m, → N …). Older answers convert from their tap menu. More… accepts any compatible unit.
- **History tools.**
  - Swipe a result left to delete it, with Undo.
  - Pin results to the top. Clear page keeps pinned results.
  - Copy text or Copy LaTeX.
  - Export the history as CSV from the tab menu (CAS and TI-36X Pro).

## 2.3

- **One document.** The tabs are named and you can rename them: long-press a tab, or tap the open tab and choose Rename.
  - The main tab is **CAS**.
  - The menu offers a backup and restore of everything, instead of a list of documents.
- **One TI-36X Pro tab and one emulator tab.** The emulator tab's default name is the model number (TI-89, TI-92+, V200, TI-84+SE … TI-81, HP-42S, HP-15C …).
  - **Replace OS or change calculator** is in every emulator's menu and in the tab menu. It lists all 18 models.
  - Choosing an OS file of another model switches to that model automatically (.89u, .9xu, .v2u, .8xu, .73u).
  - Each model keeps its own OS and memory.
  - Older documents are merged on first start.
- **CAS keypad laid out like the TI-89:**
  - x y z t ^ / = ( ) , ÷ / | 7 8 9 × / EE 4 5 6 − / sto▸ 1 2 3 + / ans 0 . (−) enter.
  - Each key has its 89 2nd legend (blue) and ◆ legend (green). Swipe up for 2nd, swipe down for ◆, or long-press to choose.
- **Division is always a fraction.** ÷ (and typing /) builds a stacked fraction from the term before it, in the CAS and in the TI-36X Pro.
- **Eng number format.** Settings → Number format offers Normal, Sci and Eng (exponents in multiples of 3).
- **Trigonometry.** A new Trig tab in Constants & formulas, also reachable from the main menu and from CAS menu → Algebra → Trigonometry. It has:
  - **Triangle solver:** SSS, SAS, ASA, AAS and the ambiguous SSA case, which shows both triangles. It gives area, perimeter, heights, R and r, and a scaled drawing.
  - **Identities:** about 40 identities and an exact-value table. Each identity can be inserted, or verified by the CAS.
  - **Trig formulas:** 15 solvable formulas.

## 2.2.1

- **TI-36X Pro keypad matches the current TI-36X Pro.** Every key and 2nd legend is in the real position, with the 2nd legends printed above the keys.
  - Multi-tap keys work like the real ones: tap again within 1.6 s for the next legend. These are ln/log, e□/10□, π/e/i, sin/sin⁻¹, cos/cos⁻¹, tan/tan⁻¹, !/nCr/nPr, and x/y/z/t/a/b/c/d.
  - New 2nd functions: d/dx□ at a point, ∫□□dx, 1/□, the mixed number □□/□, expr-eval, op and set op, contrast ◂◐ ◐▸, off, and hex digits A–F.
  - The math menu now has MATH, NUM, DMS, R◂▸P and HYP tabs. The random menu has RAND and PRB. The base n menu has CONVR, TYPE and LOGIC.
- **Fix:** functions picked from menus, such as nCr( and lcm(, now evaluate. MathLive re-serialised them as `\operatorname{\mathrm{…}}`, which the parser did not recognise.

## 2.2

- **TI-92, TI-92 Plus and Voyage 200.**
  - These use the TiEmu core with a 240×128 screen.
  - The QWERTY keypad has two pages: math, and abc.
  - Home, Y=, Window, Graph and Table keys send the ◆ shortcuts.
  - Each model keeps its own saved state.
- **TI-73 Explorer.** Uses the TI-73 keypad, including its 2nd legends (checked against the real OS 1.91).
- **Auto-contrast for all Z80 models.** A real OS often sets a dark contrast; auto-contrast evens it out. You can turn it off in the menu.
- **HP-42S (Free42).**
  - The full 131×16 dot-matrix display with annunciators.
  - Menus, solver, ∫f(x), matrices and programs.
  - Copy and paste of X, and `.raw` program import.
  - State is saved continuously.
- **HP-12C, 15C and 16C.**
  - These run the real microcode on a cycle-accurate Nut CPU, at real speed.
  - Gold f and blue g work by swipe or long-press.
  - Continuous memory is kept as a compressed snapshot.
- **TI-36X Pro style scientific.** A MultiView page that runs on Giac. It includes:
  - Exact and decimal answers, fractions and mixed numbers.
  - DMS and DEG/RAD/GRAD angles, with r/g angle markers.
  - Complex numbers in a+bi and r∠θ forms.
  - Base n and logic operations.
  - Constants and conversions.
  - A data editor with 1-var and 2-var statistics and regressions.
  - Distributions, a table of f(x), num-solv, poly-solv and sys-solv.
  - Matrix and vector editors.
- **Fixes.** The `mod`, `countIf` and `exp▸list` CAS helpers are now defined.

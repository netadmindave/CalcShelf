# Changelog

CalcShelf was called **CAS Touch** up to 2.6.1, and began as **TI-89 Touch** (1.x), a TI-89 Titanium emulator with a modern touch UI. Versions 2.0 and 2.1 added the Nspire-style CAS, the classic TI calculators, the conversion tool and constants in alternative units.

## Unreleased

- **Uncertainty with units:** `10 ± 0.001 mm × 1550.1 ± 0.001 nm` gives (15501.0 ± 1.6) mm·nm instead of an error. A unit after the uncertainty applies to both numbers; with a unit on each (`10 mm ± 1 nm`), the uncertainty is converted to the value's unit. Mismatched units say so.

## 2.7.7

- Installs over 2.7.6 and keeps your tabs, settings and firmware.
- **Web version** at [netadmindave.github.io/CalcShelf](https://netadmindave.github.io/CalcShelf/): the same app in a browser on a computer, an iPhone or an iPad, published from the repository by GitHub Pages. It works offline after the first visit (a service worker caches it) and can be added to the home screen or installed. Your data and firmware stay in that browser.
- **Optics module 1.3:** about 100 more formulas in five new sections, following the topics of five books: **Laser design** (Svelto, *Principles of Lasers*: losses and photon lifetime, critical inversion, threshold pump power, output power, slope and coupling efficiencies, optimum coupling, relaxation oscillations, Q-switched pulse energy and width, frequency pulling, Frantz–Nodvik gain, M², brightness, thermal lens, phase-matching angle), **Classical optics** (Hecht, *Optics*: Fresnel amplitude coefficients, Lorentz dispersion, Newton’s rings, thin films, coefficient of finesse, grating dispersion, Fresnel zones, magnifiers, microscopes and telescopes, Sagnac, relativistic Doppler), **Fiber links & receivers** (Agrawal, *Fiber-Optic Communication Systems*: splice losses, ASE, noise figure, OSNR, thermal noise, extinction penalty, dispersion limits and compensation, heterodyne detection, laser-diode bandwidth and linewidth), **Nonlinear fiber optics** (Agrawal, *Nonlinear Fiber Optics*: effective length and area, nonlinear length, soliton order and period, SPM, modulation instability, Raman and Brillouin thresholds, walk-off, XPM, chirped-pulse broadening, soliton self-frequency shift, compression and fission) and **Ultrafast pulses** (Rullière, *Femtosecond Laser Pulses*: Gaussian and sech² widths, time–bandwidth, GDD of materials and grating pairs, pulse broadening and stretching, peak intensity and fluence, B-integral, carrier–envelope offset). The Variable Solver now has about 670 formulas.
- **Machinist module 1.2:** precision-mechanism design following Soemers, *Design Principles for Precision Mechanisms*: **Stiffness & flexures** (transmission ratio, series and parallel springs, bars, beams, shafts and tubes in torsion, leaf springs and parallel guides with shortening, stress and buckling, reinforced leaf springs, cross flexures, folded sheet flexures, notch hinges) and **Contact & dynamics** (Hertz contact of spheres and cylinders with stiffness, natural frequency, impact force, position errors after velocity and acceleration steps, inertia match, gravity balance with a zero-length spring, Abbe and cosine errors, thermal expansion).
- **Variable Solver unit menus on results:** every calculated value and constant can be shown in an equivalent unit (s, min, h; cm⁻³, m⁻³ …), or **auto** for a readable prefix.
- **Brackets:** **(** inserts a pair only at the end of the line; elsewhere it inserts just the **(**. **)** anywhere closes the last open **(** before the cursor, at that **(**'s own level, as one matching pair; with none open it inserts just the **)**. A bracket left unmatched after editing no longer gives “Expected \right”, and typed numbers like `3.24e-5` after × are read as scientific notation.
- **Typed input on a keyboard:** `**` is a power (`2**3` = 8), `1e3` and `1.5e-3` are scientific notation like the EE key, and an expression ending in an operator (`7*`) says what is missing instead of giving undef.
- **Fix:** a formula solved with one side equal to 0 (D₁L₁ + D₂L₂ = 0) could report no solution; roots that Giac solves exactly are no longer rejected by the numeric check.

## 2.7.6

- **New app ID, com.calcshelf** (it was com.ti89touch). Android installs 2.7.6 as a new app beside the old one rather than over it. To move your work: in the old app, **Back up** (it saves to Downloads/TI-89); in 2.7.6, **Restore from backup** and pick that file; then choose each calculator's OS or ROM again (2.7.5 backups don't hold firmware). Uninstall the old app when you're done.
- **Variable Solver tab** (+ → Variable Solver): every formula in CalcShelf (the library and every module, about 530) in one master list, solved from the values you know.
  - Each formula variable is matched to a named quantity with a short description and its other names (N_a, also p₀ in p-type material), so a value entered once feeds every formula that uses it: λ₀, n and L give ν, k, the wavelength in the medium, the photon energy and more; N_d and n_i give n₀, p₀ and E_F − E_Fi.
  - Values you enter move to the top, calculated values follow. **How** shows the formula a value came from, rearranged for it and filled in with your numbers; **In terms of your values** gives one formula in what you entered.
  - **Reset values**, **Ignore** a variable or a formula, choose **Which formulas** to use, and see which single value would calculate the most. Values two formulas disagree on are flagged.
  - Modules can name the quantity each variable is, define their own quantities, and limit approximations to one direction (docs/MODULES.md).
- **Variable Solver, p–n junctions and solar cells:** formulas for the electron and hole diffusion lengths, the diode current density, photon flux density, short-circuit current density, open-circuit voltage from J_L and J_s, thermalization heat, the depletion edges x_n and x_p, the peak junction field, responsivity, Einstein relations for electrons and holes, hole density from E_F, drift current, generation rate, excess carriers, photoconductivity, transit time, mobility from the scattering time, penetration depth and reflectance with absorption. A GaAs solar-cell problem now goes from N_a, N_d, n_i, D_n, τ_n0, D_p, τ_p0, the irradiance and wavelength to L_n, L_p, J_s, J_sc, V_oc and the heat.
- **Fix:** with both N_a and N_d entered (a junction), the approximations n₀ ≈ N_d and p₀ ≈ N_a no longer fire together and make up an intrinsic density from n₀p₀; the compensation formulas apply only in their own range (N_d > N_a or N_a > N_d). **Enter my own value** replaces a calculated value with yours. Semiconductor values show in cm⁻³, cm²/s, A/cm² and eV.
- **Module calculators recalculate as you type** or change a menu or unit, so a result never sits next to inputs it wasn't computed from (the on-screen keypad could cover the Calculate button, leaving the old result).
- **Computer Science module 1.1** (built in, tab CompSci): IPv4 and IPv6 subnet calculators (network, broadcast, masks, host range, bits, split, VLSM, summarize), storage conversions between bits, bytes and decimal or binary units (kB/KiB, MB/MiB, GB/GiB, TB/TiB), data rates and transfer times, RAID and ZFS layouts (RAID 0/1/5/6/10/50/60, ZFS mirrors and RAIDZ1/2/3, dRAID, Unraid: capacity, efficiency, fault tolerance, relative sequential and random speed, rebuild risk), bitwise operations and two's complement, tables (CIDR, special ranges, ports, ASCII, powers of 2, integer and float formats, complexity, HTTP codes) and formulas for the Variable Solver.
- **Periodic Table module** (built in): a landscape periodic table coloured by category, block, state or a property; every element's data and isotopes; molar masses of formulas; and chemistry formulas for the Variable Solver.
- **Machinist module 1.1:** a Formulas section (spindle speed, feed rate, removal rate, power, cutting time, pitch, surface finish) that the Variable Solver uses.
- **Optics module:** the majority-carrier approximations n₀ ≈ N_d and p₀ ≈ N_a, for the Variable Solver.
- **Emulators fill any window shape.** The calculator's screen is as wide as the window, and drawn to fill its frame (it was limited to whole-pixel sizes and could stay much smaller). In a window wider than tall (landscape, split screen, a tablet), the screen is on the left and the keys on the right, for every calculator. The TI-36X Pro no longer squashes its keys and labels together in a short window.
- **One screen style for every calculator:** Standard, Paper or Night in **Settings → Calculator screens** (also in each emulator tab's menu and in each calculator's own menu) applies to all emulated calculators and the TI-36X Pro. The TI-Nspire's colour screen gets a Night style too.
- **Calculator clocks follow the phone:**
  - **TI-89 Titanium, TI-92 Plus, Voyage 200:** set automatically at start, on returning to the app and every 10 minutes (**Clock follows the phone** in the menu). The manual **Set clock to phone time** used UTC instead of local time and reported failure when it worked; both are fixed.
  - **TI-84 Plus / Silver Edition:** set at start and on returning to the app, then kept by the phone's clock.
  - **HP 48 / 49:** set again on returning to the app and every 10 minutes, so time spent in the background no longer makes it run slow.
- **Differential Equations tab** (+ → Differential Equations): ordinary differential equations of any order, one equation or a system.
  - **Exact solutions** from Giac: the general solution with constants c₀, c₁ …, or the particular solution for initial or boundary conditions (y(0) = 1, y′(0) = 0, or y(0) = 1, y(π/2) = 2). Linear systems with constant coefficients are solved by the Laplace transform. Decimals are read as fractions, so answers stay exact. Insert the solution, copy it, define y(t) in the Calculator, or graph it.
  - **Numeric solutions** for any equation or system with initial values, linear or not: adaptive Runge–Kutta (Dormand–Prince 5(4)). A plot against the variable or a phase plane (any two of x, y, y′ …), a slope field for one first-order equation, values at any point, and a table you can copy as CSV. Solutions that blow up stop with a note.
  - Type derivatives as y′, y″ (the ′ key), dy/dt, d²y/dt², d/dt(y) or diff(y,t). **Examples** has 14 ready equations: decay, logistic, cooling, a damped oscillator, resonance, an RLC circuit, a boundary value problem, Cauchy–Euler, coupled springs, predator–prey, a pendulum, Van der Pol, Riccati and Lorenz.
- **Saved files go to Downloads/CalcShelf** (they went to Downloads/TI-89).
- **Installed firmware is shown:** in **Choose a calculator**, each model with an OS or ROM installed has an **Installed** badge and the file's name, size and date; a model's page says whether its firmware is installed, and offers **Replace OS or ROM…** when it is.
- **Firmware copies in the app:** every calculator OS, ROM dump and Nspire system file you choose is copied into CalcShelf's own storage. Choosing a new one for the same calculator replaces the copy. Firmware you loaded before this version is copied once when the app starts.
- **Backups include the firmware:** **Back up** now saves those copies in the backup file, so restoring it on a new phone brings back each calculator ready to run (the TI-Nspire's files are put back in its setup screen; tap Install). **Back up without firmware** makes the small backup as before. Keep a backup with firmware to yourself: it holds your own ROM dumps.
- **Modules:** tabs built from a module file, each for one subject. A module holds formulas, calculators (with unit menus and plots), searchable tables, constants, reference text and the app's own tools, and everything works inside its tab using the CAS. Open them from **+ → Modules**.
  - **Optics** (built in): every optics formula and constant from the library, the five optics tools, and calculators for wavelength ↔ frequency ↔ photon energy, power in dBm, a Gaussian beam with a plot of w(z), beam widths, a cavity, a step-index fiber, a fiber link and a comb beat note. The optics formulas also stay in the library and the conversion tool.
  - **Optics formulas from two textbooks:** about 225 more solvable formulas, following the topics of Saleh & Teich, *Fundamentals of Photonics* (2nd ed.) and Neamen, *Semiconductor Physics and Devices* (4th ed.), in new sections: rays, waves and Fourier optics; beams and resonators; EM, polarization and layered media; waveguides; photons and atoms; lasers and amplifiers; semiconductor photonics; acousto-, electro- and nonlinear optics; communications; semiconductor physics; junctions and devices. Each formula names the book chapter it comes from. The Optics module now has 331 formulas.
  - **Machinist** (built in): speeds and feeds with a cutting-speed table; unified, metric and NPT tap drills; pitch ↔ TPI; tap drills for a thread percentage; thread dimensions and three-wire measurement; number, letter, fractional and metric drills with inch and mm sizes and a nearest-size search; inch and metric clearance holes; drill point and countersink depth; decimal to fraction, bolt circles, sine bar, taper, chord and sagitta, bar stock weight and surface finish; G codes, M codes and address letters.
  - **Adding modules:** **Manage modules → Browse modules** opens a module repository in your browser (by default the [modules folder](modules) on GitHub, or any https:// address you set). Download a module there, then **Import a module file**. CalcShelf shows what the module holds before installing it, and still asks Android for no permissions.
  - **Data only:** a module can't run code. CalcShelf checks the file and every expression before the CAS sees it. See [SECURITY.md](SECURITY.md).
  - **[docs/MODULES.md](docs/MODULES.md)** explains how to make a module, and `modules/example.json` uses every kind of item.
- **Formula solver:** solutions smaller than 10⁻⁹ (picometres, picoseconds, bit error rates) are no longer merged with other candidates and lost.
- **All formulas** in every module tab: one list of all its formulas and calculators, by section or A–Z.
- **Fractions and units typed with a value** in the conversion tool, module calculators and the formula solver: `3/8`, `1 3/8`, `1-3/8`, `⅜`, `3/8in`, `1-1/2"`, `12.7 mm`. In the conversion tool, a unit typed after the value becomes the From unit. 
- **The CAS keypad for value fields:** the conversion tool, the formula solver, module calculators, the triangle solver and other value fields use the CAS keypad instead of the phone keyboard. A row above it has **/** and a space for fractions, unit keys (in, ", ft, mm) where a value can take a unit, **⌨** for the phone keyboard, and **done**. enter moves to the next field, then runs the form.
- **Units that Giac leaves uncombined are worked out:** √(190 cm²/s × 100 ns) gives 43.59 µm instead of √ns·s^−0.5. Results with mixed units go to SI base units, and named or base SI units get a prefix that keeps the number between 1 and 1000 (100 mW × 3 ns = 300 pJ).
- **(−) types a raised negation sign ⁻**, as on a TI, so it looks different from the minus key and sits right next to its number: 3ᴇ⁻2, 4×⁻3. It computes as a minus.
- **Fix:** tapping the **units** key could also pick a unit from the list it opened (the tap landed on it, often “fm”). Keypad keys no longer produce that second tap.
- **123 keypad:** **units** replaces |x| (long-press for |x| or n!), **eˣ** replaces x⁻¹ (long-press for x⁻¹ or 1/x), and the enter key on the keypad itself is now **≈** for a decimal answer (long-press for Entry or enter). The big **enter** below stays exact.
- **Formula solver unit menus:** every variable with a unit has a menu. It starts on **units** (your numbers as typed) and offers the units of the same kind, so you can enter a radius in inches and get an area in cm².
- **The tab bar scrolls sideways** with a finger when the tabs don't fit, and its ends fade to show there are more.
- **Fix:** a Sellmeier entry with two terms defined a broken n(λ) function; every term count works now.

## 2.7.5

- **CAS keypad:** the toolbar keys are full size, with wider **esc** and **tab**, and **⌫** stays on the toolbar (hold it to keep deleting). A new top row on the 123 page has **√**, **π**, **x²**, **x⁻¹** and **|x|**.
- **The ) key closes a ( whose ) you deleted**, instead of wrapping the whole entry in another pair. With a plain ( open before the cursor, it just adds the ). Only when no ( is open does it wrap what is before the cursor.
- **Uncertainties written without a leading zero work** ((1550 ± .02) × (1550 ± 1)). Before, they gave the "write each uncertain value…" error.
- **sin(x)² is read as (sin x)²**, as on a TI calculator. Before, it was read as sin(x²).
- **Units in results are tidied when Giac writes them with /** too, so 9.81 m/s² × 2 kg gives 19.62 N. Units typed in the entry line show upright in the history (9.81 m, not _m).
- **Guide pictures** retaken with the current screens.
- **EE works as on a TI calculator:** it types a small capital ᴇ and the exponent stays on the same line (6.02ᴇ23, 1.5ᴇ−3). A number with ᴇ counts as one number, so 1/2ᴇ3 is 1/2000. Answers in scientific notation show the same ᴇ (1.2044ᴇ24), and come back in that form when you reuse them.
- **Security review and hardening:**
  - **Content security policy:** every page may only load the app's own files. Nothing can be fetched from, or sent to, another site, and injected scripts don't run.
  - **Links:** the link handler opens only web pages (http and https) in the browser, and blocks any other kind of link.
  - **Saved files:** names are reduced to a plain file name, so a file can only land in Downloads.
  - **Emulator frames:** messages between the app and the emulator frames are accepted only from the app itself.
  - **Formulas from files:** LaTeX from backups or files can no longer use MathLive's HTML styling commands.
  - **Graphs:** the trace read-out shows function names as text, not as HTML.
  - **Checked and found clean:** MathLive 0.111.1 has the fixes for CVE-2025-29049 and CVE-2026-54705; no keys or passwords are in the repository history; the bundled test ROMs contain only CalcShelf's own test code.
- New **SECURITY.md**: what the app can and can't do, and how to report a problem.
- **Fixed: the version number.** Android showed every build as version 2.0, because the manifest's fixed values overrode the build's. It now shows 2.7.5.

## 2.7.4

- **The TI-36X Pro is now one of the emulated calculators**, under + → Emulated calculator → *TI scientific*, instead of its own kind of tab. A TI-36X Pro tab you already have becomes an emulator tab with its memory and night setting; with one emulator tab, it keeps the TI-36X Pro's memory when you switch that tab to another calculator.
- **Screen rotation:** the CAS and the TI-36X Pro stay upright. The TI-92, TI-92 Plus and Voyage 200 always run in landscape, and their portrait two-page keypad is gone. Other tabs still turn with the phone.
- **Units:** about 300 units in 130 quantities, many of them derived or combined (momentum, moment of inertia, GVD, D*, noise densities, radiance, dose rate…). The CAS Units sheet can be searched and takes any combination you type. Units that Giac reads differently from CalcShelf (`_Da`, `_kn`, `_yr`, `_°C`…) are now passed to it in SI form, so they compute correctly. `20_°C→_°F` gives 68 °F. Combined results are simplified (W·m/(K·m) → W/K).
- **Your own units and constants** (const → Mine): units work in the CAS and the conversion tool; constants are CAS variables in every document.
- **Optics calculators** in the conversion tool's Optics tab: Gaussian beam through ABCD elements with mode matching, material dispersion (n, n_g, β₂, D, β₃, zero-dispersion wavelength), Fabry–Pérot etalon, and thin-film stacks. New Sellmeier data: silicon, zinc selenide and YAG.
- In the conversion tool, the From and To lists show the units of the quantity you pick (for example, torque rather than energy for N·m).
- **Guide & manuals tab** (+ or ☰ → Guide & manuals): the complete user guide in the app, and links to the official TI and HP manuals for every calculator, which open in the phone's browser.
- **Combined units are tidied further:** units of one kind mixed together go to SI (ft·m → m², mm·km → m²), and combinations that make a common named unit become it (J/s → W, V·A → W, kg·m/s² → N). N·m stays N·m. A unit asked for with → is kept, and → now also converts to combined units such as J/s.
- **Fixed:** the Program Editor tab was titled “[object HTMLInputElement]”.
- **CAS history shows the value of ans.** When an entry uses ans, the history line shows the value it stood for, for example 5×2 instead of ans×2, so earlier lines still read correctly. ans(n) references are left as they are.
- **Fixed: emulators in landscape** used only the left part of the screen (the space the CAS gives its page next to the keypad). They, and the other tabs without the keypad, now use the full width.

## 2.7.3

- **Fixed: units in the CAS entry line.** A unit from the Units menu, or one typed with the abc keypad's **_** key, no longer leaves the entry line in text mode. Before, the next key went in as raw LaTeX (for example `\times`), and *Use entry* on such a line put the LaTeX back in. Units are now entered as maths, so `1.6_km × 2` works as expected. Entries saved by earlier versions are fixed when they are loaded or recalled.

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

# CalcShelf

**A computer-algebra calculator and a shelf of real calculators, in one Android app.**

CalcShelf has two parts:

- **A touch-first CAS** built on Giac, with a 2D math editor.
- **Emulators** that run the actual operating systems of classic TI and HP calculators, side by side in tabs.

It is free software under the GNU GPL v3. It stands on decades of work by the calculator-emulation community; see [Credits](CREDITS.md).

<p align="center">
  <img src="docs/img/cas.png" width="200" alt="The CAS tab">
  <img src="docs/img/ti36.png" width="200" alt="The TI-36X Pro tab">
  <img src="docs/img/hp48gx.png" width="200" alt="HP 48GX">
  <img src="docs/img/nspire.png" width="200" alt="TI-Nspire CX II CAS">
</p>
<p align="center">
  <img src="docs/img/v200.png" width="640" alt="Voyage 200 in the Graph89 layout">
</p>

## What's in it

| | What it is | Firmware |
|---|---|---|
| **CAS** | A symbolic and numeric calculator on Giac. It has a 2D editor, a keypad laid out like the TI-89's (with √, π and TI-style ᴇ entry), uncertainty propagation, results with units, history tools, and graphs, lists, notes and TI-Basic programs. | None needed |
| **TI-36X Pro style** | A scientific calculator with the current TI-36X Pro's keypad and menus, running on the same CAS. It has a night display, and is listed with the emulated calculators. | None needed (this is a recreation, not an emulation) |
| **TI-Nspire CX II CAS** | The real TI-Nspire OS on the Firebird emulator. | Your own: system files dumped from your calculator, plus TI's OS file |
| **TI-89 Titanium, TI-92, TI-92 Plus, Voyage 200** | TI AMS on the TiEmu core. The TI-92 models use Graph89's layout and always run in landscape. | Your own: a TI OS upgrade file (`.89u`, `.9xu`, `.v2u`) or a ROM dump |
| **TI-84 Plus (SE), 83 Plus (SE), 83, 82, 85, 86, 73, 81** | The TI-OS on the TilEm core. | Your own: an OS file (`.8xu`, `.73u`) or a ROM dump |
| **HP 48GX, HP 48SX, HP 49g+, HP 49G** | HP's own ROMs on the Emu48 core. | Included; HP allows these ROMs to be distributed for use with emulators |
| **Constants, formulas and conversions** | CODATA constants, material and Sellmeier data, solvable formulas, a triangle solver, trig identities, about 300 units (with your own units and constants), and a number-base and decibel converter. | — |
| **Optics calculators** | Δν ↔ Δλ linewidths, Gaussian beams through ABCD systems with mode matching, material dispersion (n_g, β₂, D, β₃), Fabry–Pérot etalons and thin-film stacks. | — |
| **Modules** | Tabs for one subject each, made of formulas, calculators, tables, constants and reference text that work inside the tab. Built in: **Optics** (every optics formula and tool, with beam, cavity, fiber and comb calculators) and **Machinist** (speeds and feeds, tap drills, thread data, number, letter, fractional and metric drills, clearance holes, shop math, G and M codes). Add others from the [modules folder](modules) or make your own: see [MODULES.md](docs/MODULES.md). | — |
| **Guide & manuals** | This user guide inside the app, and links to the official TI and HP manuals of every calculator. | — |

There is one document with named tabs. **Settings → Emulated calculators → Several** lets several emulated calculators run at the same time, each in its own tab.

## Get it

1. Download `CalcShelf.apk` from the [latest release](../../releases/latest).
2. Open it on your Android phone and allow the install.

You need Android 7.0 or newer, with a current Android System WebView. The TI-Nspire needs WebAssembly exception handling, which recent WebView versions have.

The app is about 6 MB. It asks for no permissions and works offline: a content security policy keeps every page to the app's own files, so nothing is fetched from or sent to other sites. Everything stays on the phone, and calculator files you load are kept in the app's private storage. See [SECURITY.md](SECURITY.md).

## Start here

- **[User guide](docs/USER_GUIDE.md)** covers every tab, key and menu, how to load each calculator's OS, and troubleshooting.
- **[Making modules](docs/MODULES.md)** describes the module format, and the [modules folder](modules) holds modules you can install.
- **[Building](docs/BUILDING.md)** explains how to build the APK and every emulator core from source.
- **[Changelog](CHANGELOG.md)**
- **[Credits](CREDITS.md)** lists who made the projects CalcShelf is built on.
- **[Security](SECURITY.md)** explains what the app can and can't do, and how to report a problem.

## About firmware

CalcShelf contains **no Texas Instruments code**. To use a TI calculator, you load your own OS file or ROM image once; it never leaves your phone.

- **TI OS upgrade files** (`.89u`, `.9xu`, `.v2u`, `.8xu`, `.tcc2` …) are free downloads from education.ti.com.
- **ROM dumps and the TI-Nspire system files** must come from a calculator you own. The [user guide](docs/USER_GUIDE.md#ti-nspire-cx-ii-cas) explains how.

The HP 48 and 49 ROM images are © HP. HP has allowed them to be downloaded for use with emulators since 2000. They are the same files that Emu48 for Android ships, and they are included.

## How it works, in one paragraph

The app is HTML and JavaScript in a minimal Android WebView shell (`apk/`, smali).

- **The CAS** is Giac compiled to WebAssembly. The 2D editor is MathLive.
- **Each emulator core** is compiled to WebAssembly with zig. The cores are TiEmu and TilEm (via Graph89), Firebird, and Emu48 (via Emu48 for Android).
  - Emu48 and Firebird got single-threaded hosts written for this project.
  - Emu48's host runs in virtual time: time follows the CPU's cycles while it runs, and skips ahead while it sleeps.
- **Saving:** state is kept in IndexedDB, compressed. The TI-Nspire's 132 MiB flash is saved in changed 2 MiB groups.

## Licence and trademarks

CalcShelf is licensed under the **GNU General Public License v3.0 or later** ([LICENSE](LICENSE)).

- **Copyleft:** it is derived from GPL projects, and Emu48 is GPL-2.0-or-later. The full list is in [CREDITS.md](CREDITS.md).
- **Other components:** MathLive is MIT; IBM Plex and KaTeX fonts are under the OFL.

TI-Nspire, TI-89, TI-92, Voyage 200, TI-84 Plus, TI-36X Pro and the other TI model names are trademarks of Texas Instruments. HP 48GX, HP 48SX, HP 49G and HP 49g+ are trademarks of HP. CalcShelf is not affiliated with or endorsed by Texas Instruments or HP.

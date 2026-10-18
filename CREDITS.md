# Credits and thanks

CalcShelf exists because many people spent years, often decades, building calculator emulators, computer-algebra systems and documentation, and then shared their work as free software. CalcShelf adds a touch interface, WebAssembly builds and some glue. The hard parts were done by the people below. Thank you.

If you're credited here and something is wrong or missing, please open an issue.

## Computer algebra and math display

- **Giac / Xcas**, by **Bernard Parisse** and **Renée De Graeve** (Institut Fourier, Université Grenoble Alpes). Giac is the engine behind every CAS result, the TI-36X Pro tab, the formulas and the triangle solver. GPL-3.0.
  - CalcShelf uses the WebAssembly build of Giac made by the **GeoGebra** team for GeoGebra's CAS. Thanks to GeoGebra for maintaining it.
- **MathLive**, by **Arno Gourdol** and the CortexJS contributors. It is the 2D math editor in every entry line. MIT.
- **KaTeX fonts**, by the KaTeX project, bundled with MathLive. MIT.

## TI-Nspire: Firebird

- **Firebird**, the community TI-Nspire emulator, by **Fabian Vogt** and contributors, at https://github.com/nspire-emus/firebird. GPL-3.0.
  - It grew out of **nspire_emu** by **Goplat**.
  - CalcShelf builds Firebird's core to WebAssembly with a single-threaded host. All the emulation of the CX II's ARM CPU, NAND, USB and hardware is Firebird's.
- **Ndless**, started by **Olivier Armand (ExtendeD)** and maintained by the Ndless team, makes it possible to run the dumping tools on a CX II. Thanks also to the authors of **PolyDumper** and **eMMUlate**, and to the **TI-Planet** community, which documents how to dump and emulate one's own calculator.

## TI-89, TI-92, TI-92 Plus and Voyage 200: TiEmu and Graph89

- **Graph89**, by **Dritan Hashorva**, the Android emulator for TI's graphing calculators, at https://github.com/eanema/graph89. GPL-3.0.
  - It is maintained in forks by **milaq** and **eanema**.
  - CalcShelf builds its native sources and copies its approach. The TI-92 Plus and Voyage 200 key layouts are taken from Graph89's skins.
- **TiEmu**, by **Romain Liévin**, **Kevin Kofler**, **Julien Blache**, **Thomas Corvazier** and **Christian Walther**, with skins by **Jaime Fernando Meza Meza**. GPL-2.0-or-later.
  - It emulates the 68000-based TI calculators.
  - Its CPU core comes from **UAE**, the Un*x Amiga Emulator, by **Bernd Schmidt** and the UAE team.
- **The TILP libraries** (libticables2, libticalcs2, libticonv, libtifiles2) handle TI file formats, character sets and linking. They are by **Romain Liévin**, **Kevin Kofler**, **Benjamin Moody**, **Julien Blache**, **Tijl Coosemans** and **Tyler Cassidy**. GPL-2.0-or-later.

## TI-84 Plus, 83, 82, 85, 86, 73 and 81: TilEm

- **TilEm 2**, by **Benjamin Moody**, **Thibault Duponchelle**, **Solignac Julien** and **Hugues Luc Bruant**. It emulates the Z80-based TI calculators. GPL-3.0.
- **Wabbitemu**, by the Wabbitemu team. Parts of it are used through Graph89, for the TI-83 Plus and TI-84 Plus link and file handling. GPL.

## HP 48 and HP 49: Emu48

- **Emu48**, by **Sébastien Carlier**, who wrote the original, and **Christoph Gießelink**, who has maintained and extended it for decades. It emulates the HP 48SX, 48GX, 49G and the Saturn-based Apple series. GPL-2.0-or-later.
- **Emu48+**, by **Cyrille de Brébisson** and **Eric Rechlin**. It added the Saturn+ processor of the HP 49g+, 48gII and 50g.
- **Emu48 for Android**, by **Régis Cosnier**, at https://github.com/dgis/emu48android. CalcShelf builds the Emu48 core from this repository, and its ROM images are the ones it ships.
- **Eric Rechlin's KML scripts and faceplates** for the "Real" 48SX, 48GX, 49G and 49g+. CalcShelf's HP key codes and keypad layouts are taken from them. Eric also runs **hpcalc.org**, the HP Calculator Archive, which has preserved HP calculator software and ROMs for decades.
- **HP**, for allowing the HP 48 and HP 49 ROM images to be distributed for use with emulators.

## Calculators in earlier versions

CalcShelf 2.2 to 2.5 also ran these, and they're thanked for that time:

- **Free42**, by **Thomas Okken**: the HP-42S. GPL-2.0.
- **Nonpareil**, by **Eric Smith**: the HP-12C, 15C and 16C, with HP's microcode under CC BY-SA.

## Data

- **Physical constants:** CODATA 2018 recommended values, published by NIST. SI 2019 exact values.
- **Optical constants:** published dispersion data and Sellmeier fits (Malitson, Schott, Corning and others), as cited in `app/www/data/constants.js`.
- **The TI-89 command reference** in the command finder lists TI's command names and syntax. The descriptions are written for CalcShelf.

## Fonts and tools

- **IBM Plex**, by Mike Abbink and Bold Monday for IBM. SIL Open Font License 1.1.
- **zig**, by Andrew Kelley and contributors. It compiles every emulator core to WebAssembly.
- **apktool**, by Connor Tumbleson and Ryszard Wiśniewski, and **uber-apk-signer**, by Patrick Favre-Bulle. They build and sign the APK.
- **Playwright**, by Microsoft, runs the UI tests. **Pillow**, **NumPy** and **SciPy** are used by the build scripts.

## Communities

Thanks to **ticalc.org**, **TI-Planet**, **Cemetech**, **hpcalc.org** and the **Museum of HP Calculators** forum. They have kept calculator programming, documentation and emulation alive, and answered countless questions.

## Trademarks

TI-Nspire, TI-89, TI-92, Voyage 200, TI-84 Plus, TI-83 Plus, TI-36X Pro and the other TI model names are trademarks of Texas Instruments. HP 48GX, HP 48SX, HP 49G and HP 49g+ are trademarks of HP. CalcShelf is not affiliated with or endorsed by either company.

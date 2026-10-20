# Building CalcShelf

CalcShelf is a web app (`app/www/`) in a minimal Android WebView shell (`apk/`, smali). The emulator cores are C/C++ projects compiled to WebAssembly. You can work on the app without rebuilding any core, because the compiled cores are in the repository.

## Repository layout

| Path | Contents |
|---|---|
| `app/www/index.html`, `js/`, `css/`, `data/` | The main app: the tabs, the CAS, the TI-36X Pro, the graphs, lists, notes and programs, and the constants, formulas and converter. |
| `app/www/js/cas-worker.js`, `vendor/giac/` | Giac in a Web Worker. `giac.wasm` is the GeoGebra project's WebAssembly build of Giac. |
| `app/www/vendor/mathlive/` | MathLive (the 2D math editor) and its KaTeX fonts. |
| `app/www/ti89/` | TI-89, TI-92, TI-92 Plus and Voyage 200 (TiEmu), selected with `?slot=89\|92\|92p\|v200`. `js/skin92.js` has Graph89's key positions. |
| `app/www/classic/` | The Z80 calculators (TilEm), selected with `?model=…`. |
| `app/www/nspire/` | The TI-Nspire CX II CAS (Firebird). |
| `app/www/hp/` | The HP 48 and 49 (Emu48), selected with `?model=48gx\|48sx\|49gp\|49g`. `rom/` has HP's ROMs. |
| `core-build/` | The scripts, patches and hosts that build each core to WebAssembly. |
| `apk/`, `build_apk.sh` | The Android shell (decoded with apktool) and the build and sign script. |
| `tests/` | The Playwright UI tests and the Node CAS tests. |

## Running the app in a browser

```sh
./serve.sh            # serves app/www on http://localhost:8091
```

Open `http://localhost:8091/` in Chrome or Chromium with a phone-sized window. Each emulator page also works on its own, for example `http://localhost:8091/hp/index.html?model=48gx`.

## Building the APK

You need Java 11 or newer, [apktool](https://apktool.org) 2.9.3, [uber-apk-signer](https://github.com/patrickfav/uber-apk-signer) 1.3.0, and **your own** signing keystore:

```sh
keytool -genkeypair -v -keystore my.keystore -alias calcshelf -keyalg RSA -keysize 2048 -validity 10000
TOOLS=/path/to/tools KEYSTORE=my.keystore KS_ALIAS=calcshelf KS_PASS=… ./build_apk.sh
```

- **The output** is `CalcShelf.apk`.
- **About the app ID:** it is `com.ti89touch`, kept from the first version so that updates install over older builds.
- **About signing:** Android only updates an app with an APK signed by the same key. If you sign with your own key, your build installs as a separate app.

## Building the emulator cores

Every core is built with **zig 0.17** (`pip install ziglang`) for `wasm32-wasi`, in the reactor model. The upstream sources are not copied into this repository. Each script takes the path of an upstream checkout and records the commit it was tested with.

### TiEmu and TilEm (TI 68k and Z80), from Graph89

You need the Graph89 sources (`app/src/main/jni` from https://github.com/eanema/graph89):

```sh
J=/path/to/graph89/app/src/main/jni ./core-build/build.sh         # TiEmu + libti* → g89.wasm
J=/path/to/graph89/app/src/main/jni ./core-build/build_tilem.sh   # TilEm + wabbit helpers + tz80.c
python3 -m ziglang cc -target wasm32-wasi -mexec-model=reactor -O2 -s -o tz80.wasm $(cat core-build/objs_tilem.txt) \
  -lwasi-emulated-signal -lwasi-emulated-process-clocks -lwasi-emulated-mman
```

These directories hold the code that replaces Android-only pieces:

- `core-build/shim/`: a minimal GLib and the Android logging stubs.
- `core-build/overlay/`: small TiEmu patches.
- `core-build/wasm/` and `core-build/tz80/`: the WebAssembly entry points.

`core-build/tz80/test/` has small test programs assembled from the included `.asm` sources. They are not TI code.

### Firebird (TI-Nspire)

You need the Firebird sources (https://github.com/nspire-emus/firebird; tested at commit `b10f3b5`):

```sh
cd core-build/nsp
FB=/path/to/firebird/core python3 patch_core.py   # copies the core and applies the WebAssembly patches
./build_wasm_lto.sh                                # → nspire_lto.wasm; copy it to app/www/nspire/core/nspire.wasm
```

- **Exception handling.** The build uses WebAssembly exception handling for setjmp and longjmp, with the flags `-mexception-handling -mllvm -wasm-enable-sjlj -mllvm -wasm-use-legacy-eh=false`. A `__c_longjmp` tag is defined in assembly.
- **No LTO for `emu.cpp`.** It is compiled without LTO, because LTO breaks its setjmp.
- **Host.** `wasm/nspire.cpp` is the host. It slices the main loop, keeps the flash in WebAssembly memory with per-block dirty flags, and handles snapshots and USB OS transfer.
- **Native harness.** `build_native.sh` builds `nstest`, a native test harness. The Node scripts in `nsp/test/` need your own system files: set `NS_FW` to their folder.

### Emu48 (HP 48 and 49)

You need the Emu48 for Android sources (https://github.com/dgis/emu48android; tested at commit `0e5908b`):

```sh
EMU48=/path/to/emu48android ./core-build/hp48/build.sh    # copies app/src/main/cpp/core, builds hp48.wasm
EMU48=/path/to/emu48android python3 core-build/hp48/gen/layouts.py app/www/hp/js/layouts.js
```

- **`host.c`** is a single-threaded host. It replaces Emu48's worker thread, Windows multimedia timers and events with one run loop in virtual time:
  - While the CPU runs, time comes from its cycle count.
  - While the CPU is in SHUTDN, time jumps to the next timer.
  - `timeSetEvent` callbacks are queued and fired from the loop.
- **`win32-layer.h`** is Emu48 for Android's Windows header, trimmed for WebAssembly.
- **`gen/layouts.py`** reads the key codes (`OutIn`) from Eric Rechlin's KML scripts.
- **The ROMs** `rom.48g`, `rom.48s` and `rom.49g` come from the same repository (`app/src/main/assets/calculators/`).
- **Tests.** `test/boot.mjs` and `test/state.mjs` boot each model and check save and resume in Node.

### Giac unit table

```sh
node core-build/units/gen_giacunits.js app/www/data/giacunits.js
```

This checks every unit name, and every prefixed name, against Giac. A name goes into `ok` when Giac reads it exactly as `js/units.js` does, and into `alias` when Giac has its own spelling for it. Every other unit is sent to Giac in SI form. Run it again after adding units.

### Graph89 key positions (TI-92 and Voyage 200 layout)

```sh
G89=/path/to/graph89 python3 core-build/skin92/gen.py app/www/ti89/js/skin92.js
```

This reads the key masks of Graph89's `landscape/ti92plus` and `landscape/v200` skins.

## Tests

The UI tests use [Playwright](https://playwright.dev/python/) with Chromium:

```sh
pip install playwright && playwright install chromium
./serve.sh &                        # port 8091
cd tests && python3 hp48.py         # each script prints what it checked and any page errors
```

- **Firmware.** Tests that need TI firmware read it from `CALC_FW`, a folder you provide. Never commit firmware.
  - **TI-89:** `TI89Titanium_OS.89u`.
  - **TI-92 Plus:** `ti92p.rom`.
  - **TI-84 Plus SE:** `ti84se.rom`.
  - **TI-Nspire:** the dumps and the `.tcc2` OS.
- **Screenshots** go to `tests/out/`.
- **The `pk_*` tests** run against the assets unpacked from a built APK, served at `http://localhost:8092/www`.
- **CAS tests** run in Node against the same Giac build: `node test_t2g.js`, `node e2e_cas.js`, `node sweep_formulas.js`.

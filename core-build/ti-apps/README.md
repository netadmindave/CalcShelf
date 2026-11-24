# Building the CalcShelf Solver for TI calculators

The built files are in [`TI-Apps/`](../../TI-Apps), with instructions for using them.

```
pip install lupa tivars
sh core-build/ti-apps/build_all.sh
```

| File | What it does |
|---|---|
| `build.js` | Loads the app's formulas and quantities and keeps the optics, optoelectronics and semiconductor ones. Rearranges every formula for every variable with Giac (the CAS in CalcShelf), then writes the TI-Nspire Lua app (`solver.lua` + data) and `out/solver-data.json` for the others. Rearrangements are cached in `out/solve-cache.json`; one that takes Giac more than 15 s is left to a numeric solver. |
| `solver.lua` | The TI-Nspire app: the Variable Solver loop, Newton's method for formulas with no closed form, and the screen. The formula data is inserted at `--[[DATA]]`. |
| `ti.js` | Writes the TI-89 programs (text programs, `ti89file.js`) and the TI-84 program sources from `solver-data.json`. |
| `ti84pack.py` | Tokenizes the TI-84 sources into `.8xp` with tivars. |
| `test_solver.py`, `test_examples.py` | Run the Nspire app in Lua 5.1 (lupa) with a mock of the Nspire API: every expression compiles, worked examples, the numeric solver, every screen. |
| `check84.py` | Static checks of the TI-84 programs: every Goto/Menu target exists, labels are unique, Then/End balance. |
| `build_all.sh` | All of the above, then copies the files to `TI-Apps/`. |

`luna` (github.com/ndless-nspire/Luna) packs the Lua into a `.tns`; put the binary in this folder or on PATH.

## Calculator limits the writers respect

- **TI-89:** a text program is tokenized the first time it runs. Above about 18 KB the calculator runs out of memory doing it, so sections are packed into programs of 10 KB or less. Dialog items have a width limit (the "Dimension" error), so titles, drop-down items and prompts are cut to fit. `Request …,0` keeps alpha-lock off. `csolve` is the built-in `cSolve(`, so the main program is `cshelf\solver`.
- **TI-84:** `Menu(` takes at most 7 options, so long menus are paged. Labels are two characters. Programs have at most 12 formulas, so one section fits in a TI-84 Plus's RAM.
- A closed form longer than 700 characters is replaced by the calculator's numeric solver (`solve(` / `nSolve(`).

Tested on CalcShelf's own emulators with the TI-89 Titanium, TI-92 Plus and TI-84 Plus SE: every TI-89 program tokenizes, archived programs run, and worked examples give the expected answers.

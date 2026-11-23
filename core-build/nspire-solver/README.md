# CalcShelf Solver for the TI-Nspire

The CalcShelf Variable Solver as a Lua app for the TI-Nspire CX and CX II (CAS and non-CAS, OS 3.6 or later).
It holds the optics, optoelectronics and semiconductor formulas of the CalcShelf optics module: 433 formulas and 823 variables.

## Using it

Copy `CalcShelf-Solver.tns` to the calculator (TI-Nspire Computer Link or Student Software) and open it.

- **▲ ▼** select a variable. **Enter** sets its value, or on a calculated value shows how it was found (formula, rearranged form, the values that went in).
- Start typing a number to set the selected value. Type letters to search by symbol or name. **esc** clears the search.
- **◀ ▶** change the unit a value is shown in; in the entry box they change the unit you type in.
- **del** clears the selected value. An empty entry clears it too.
- **menu**: reset all values, ignore a variable, turn the Optics, Optoelectronics and Semiconductors topics on and off, list the formulas with a variable, help.

Each formula left with one unknown is solved; its result feeds the other formulas until nothing more can be found. Constants (h, c, k_B, q …) are filled in. Values are saved with the document.

## How it is built

The calculator does no algebra. `build.js` rearranges every formula for every variable with Giac (the CAS in CalcShelf) on the computer and writes each rearranged form as a Lua expression. 1679 rearrangements have a closed form; the 43 that don't are solved on the calculator by Newton's method on the formula itself.

```
node core-build/nspire-solver/build.js      # writes out/CalcShelf-Solver.lua and, with luna, out/CalcShelf-Solver.tns
pip install lupa && python3 core-build/nspire-solver/test_solver.py   # Lua 5.1 checks with a mock of the Nspire API
```

`luna` (github.com/ndless-nspire/Luna) packs the Lua into a .tns; put the binary in this folder or on PATH. Rearrangements are cached in `out/solve-cache.json`; a rearrangement that takes Giac more than 15 s is left to the numeric solver.

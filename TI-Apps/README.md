# CalcShelf Solver for TI calculators

The optics, optoelectronics and semiconductor formulas from CalcShelf's Variable Solver (433 formulas, from the optics module and its book sources), as programs for TI graphing calculators. Each formula comes already rearranged for each of its variables, so the calculator only evaluates the result: no CAS is needed, and it runs on CAS and non-CAS models alike.

| Calculator | Folder | What it is |
|---|---|---|
| TI-Nspire CX, CX II (CAS or not, OS 3.6+) | [`TI-Nspire/`](TI-Nspire) | One Lua document, `CalcShelf-Solver.tns`. Works like the app's solver: enter what you know and everything it leads to is calculated, through as many formulas as it takes. |
| TI-89, TI-89 Titanium, TI-92 Plus, Voyage 200 | [`TI-89/`](TI-89) or [`CalcShelf-Solver-TI89.zip`](CalcShelf-Solver-TI89.zip) | 75 TI-Basic programs in a folder `cshelf`. Dialog boxes: pick a formula and what to find, then enter the others. |
| TI-84 Plus CE, TI-84 Plus (SE), TI-83 Premium CE | [`TI-84/`](TI-84) or [`CalcShelf-Solver-TI84.zip`](CalcShelf-Solver-TI84.zip) | 48 TI-Basic programs. Menus: pick a formula and what to find, then enter the others. |

The TI-89 and TI-84 versions solve one formula at a time; only the Nspire version chains formulas together.

Units are written in each prompt and answer (`λ nm`, `f mm`, `n_i 1/cm^3`): enter values in those units. Constants such as h, c, k_B and q are filled in for you. When an equation has more than one real answer, each is shown.

## TI-Nspire

Send `CalcShelf-Solver.tns` with TI-Nspire Computer Link or the TI-Nspire Student/Teacher Software, then open it.

- **▲ ▼** select a variable. **enter** sets its value or, on a calculated value, shows the formula, the rearranged form and the values used.
- Start typing a number to set the selected value. Type letters to search. **esc** clears the search.
- **◀ ▶** change the unit, both in the list and in the entry box.
- **del** clears a value. **menu** has reset, ignore a variable, the Optics, Optoelectronics and Semiconductors topics, and help.

Values are saved with the document.

## TI-89, TI-89 Titanium, TI-92 Plus, Voyage 200

1. Send every `.89p` file with TI Connect (CE) or TiLP. They go in a folder named `cshelf`. Send them **to Archive**: together they need about 560 KB, more than the RAM holds. Archived programs run normally.
2. Run `cshelf\solver()`. To type `\` on a TI-89, press **2nd** then **÷**.
3. Choose a topic, a section and a formula. Pick what to find, then type the other values and press **ENTER**.

The program sets Approximate, Radian and Real modes while it runs and puts your modes and current folder back when you leave with **ESC**. The first time a section is opened it takes a few seconds while the calculator converts it to its own format.

`csout`, `csnum` and `csshow` are helpers that show the answers; `csa01a` … `csc25g` are the formula sections. Formulas with no closed-form answer use the calculator's `nSolve(`.

## TI-84 Plus CE and TI-84 Plus

1. Send every `.8xp` file with TI Connect CE or TiLP.
2. Run `prgmCSHELF`.
3. Choose a topic, a section, a formula and what to find, then answer the prompts. Each prompt shows the unit, for example `λ nm=`.

On a TI-84 Plus CE (OS 5.3 or later) the programs can stay in Archive. On a TI-84 Plus or Plus SE a program has to be in RAM to run, and RAM holds `CSHELF` and a section or two (about 24 KB). Keep the rest archived and unarchive the section you need (**2nd** **MEM** **2** **7**).

The program uses a+bi mode while it runs so that a square root of a negative number doesn't stop it, and it shows only real answers. It sets Real when you quit. Formulas with no closed-form answer use the calculator's `solve(`, which finds the answer nearest its starting guess. If an equation has two answers, check that it's the one you want.

## What isn't included

A few rearrangements use functions these calculators don't have, such as erf. They appear only in the Nspire version (6 of 1722 on the TI-89 and TI-84).

## Building

The files are generated from CalcShelf's formula data by [`core-build/ti-apps`](../core-build/ti-apps): `sh core-build/ti-apps/build_all.sh`. See its README.

GPL-3.0-or-later, like CalcShelf. No TI software is included.

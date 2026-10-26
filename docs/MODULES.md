# Making a CalcShelf module

A module adds a tab to CalcShelf for one subject. It can hold formulas that solve for any variable, calculators, searchable tables, constants, reference text, and links to the tools built into CalcShelf. CalcShelf comes with two modules, **Optics** and **Machinist**.

A module is one JSON file. It is **data only**: it holds no code. CalcShelf checks the file, draws every screen itself, and sends the module's formulas to its own CAS (Giac) only after checking that they just compute. So a module can't read your documents, reach the internet or change CalcShelf's settings.

- [Install a module](#install-a-module)
- [Share your module](#share-your-module)
- [The file](#the-file)
- [Items](#items): [calc](#calc) · [formula](#formula) · [table](#table) · [constants](#constants) · [text](#text) · [tool](#tool) · [link](#link)
- [Expressions](#expressions)
- [Units](#units)
- [Check your module](#check-your-module)
- [Limits](#limits)

## Install a module

CalcShelf asks Android for no permissions, so it doesn't download anything itself. Your phone's browser downloads the module and CalcShelf imports the file.

1. In CalcShelf, tap **+** → **Manage modules…** → **Browse modules ↗**. The module repository opens in your browser. By default this is the [modules folder](../modules) of the CalcShelf repository.
2. Open the module's `.json` file and download it. On GitHub, tap **Raw**, then use the browser's **Download** command, or long-press the raw link and choose **Download link**.
3. In CalcShelf, tap **Import a module file…** and pick the downloaded file.
4. CalcShelf shows the module's name, author and contents. Tap **Install**. The module opens in its own tab.

To open an installed module later, tap **+** and pick it under **Modules**. To remove an imported module, use **Manage modules…** → **Remove**. A module you import with the same `id` as a built-in one replaces it; removing it brings the built-in one back.

In **Manage modules…** you can also change the repository address, for example to a folder in your own GitHub repository. The address must start with `https://`.

## Share your module

Put the `.json` file anywhere people can download it, such as a GitHub repository. To add it to the CalcShelf repository, open a pull request that adds the file to [`modules/`](../modules) and a line to `modules/index.json`.

## The file

Start from [`modules/example.json`](../modules/example.json), which uses every kind of item.

```json
{
  "format": "calcshelf-module",
  "formatVersion": 1,
  "id": "electronics",
  "name": "Electronics",
  "tab": "Electronics",
  "version": "1.0.0",
  "author": "Your name",
  "license": "CC0-1.0",
  "homepage": "https://github.com/you/your-modules",
  "icon": "electric",
  "description": "Resistor networks, filters and op-amp circuits.",
  "sections": [
    { "title": "Basics", "items": [ ... ] },
    { "title": "Filters", "items": [ ... ] }
  ]
}
```

| Field | Required | Meaning |
|---|---|---|
| `format` | yes | Always `"calcshelf-module"`. |
| `formatVersion` | yes | `1`. |
| `id` | yes | 2–48 lower-case letters, digits and `-`. It identifies the module, so keep it the same between versions. |
| `name` | yes | The full name, shown in menus. |
| `tab` | no | A short name for the tab, up to 16 characters. Defaults to `name`. |
| `version` | no | Your version number, shown when installing. |
| `author`, `license`, `homepage`, `description` | no | Shown when installing. `homepage` must start with `https://`. |
| `icon` | no | One of `module`, `optics`, `machinist`, `gear`, `electric`, `flask`, `ruler`, `book`, `wave`. |
| `sections` | yes | Each section is a chip at the top of the tab and has a `title` and a list of `items`. |

Every item has a `type` and a `title`. It can also have a `note` (shown under the title), `tags` (extra words for the search box) and `tex` (a LaTeX formula shown in the list).

## Items

### calc

A calculator with inputs and outputs. It calculates as soon as it opens if every input has a default, and again when you tap **Calculate**.

```json
{ "type": "calc", "title": "Spindle speed", "tex": "N=\\frac{12V_c}{\\pi D}",
  "inputs": [
    { "id": "Vc", "label": "Surface speed", "unit": "ft/min", "default": "300", "units": ["ft/min", "m/min"] },
    { "id": "D", "label": "Diameter", "unit": "in", "default": "0.5", "units": ["in", "mm"] },
    { "id": "mat", "label": "Material", "options": [ { "label": "Aluminum", "value": "800" }, { "label": "Steel", "value": "400" } ], "default": 0 }
  ],
  "outputs": [
    { "id": "N", "label": "Spindle speed", "expr": "12*Vc/(pi*D)", "unit": "rpm", "digits": 4 },
    { "label": "Feed at 0.002 in per tooth, 4 teeth", "expr": "N*0.002*4", "unit": "in/min", "units": ["in/min", "mm/min"] }
  ],
  "plot": { "expr": "12*Vc/(pi*d)", "x": "d", "from": "0.1", "to": "2", "xlabel": "D (in)", "ylabel": "rpm" } }
```

**Inputs**

- `id`: the name used in expressions. Letters and digits, starting with a letter.
- `label`: what the user sees.
- `unit`: the unit the expressions expect. Values are converted to it.
- `units`: the units to offer in a menu beside the value. Without a list, the unit is only shown. Users can also type a unit after the value (`3/8 in`, `9.525 mm`), and fractions such as `1 3/8` or `1-3/8`.
- `default`: the starting value, written as an expression.
- `options`: a list of choices instead of a typed value. Each choice is `{ "label", "value" }`, and its `value` is an expression. `default` is the index of the choice selected at first.

**Outputs**

- `id` (optional): later outputs and the plot can use the result by this name.
- `label` and `expr`: what is shown, and the expression that computes it.
- `unit`: the unit of the result. `units` offers a menu to show the result in other units.
- `digits`: significant figures to show.
- `format`:
  - `number` (the default): a decimal number.
  - `exact`: the CAS's exact answer, for example a fraction such as 5/16, with its decimal value beside it.
  - `list`: a vector or matrix, for example from `seq(...)`.

**`angles`** sets the calculator's angle unit, `"rad"` (the default) or `"deg"`. Trig functions in its expressions use that unit whatever the CAS's angle mode is. Angles always reach the expressions in this unit: an input with an angle unit (`°`, `rad`, `mrad`) is converted to it. In the same way, an output with an angle unit must be computed in this unit, and CalcShelf converts it to the output's `unit` for display. For example, in a `"rad"` calculator, write a divergence as `lam/(pi*w0)` with `"unit": "mrad"`, not `lam/(pi*w0)*1000`.

**`plot`** (optional) draws `expr` against the variable `x`, from `from` to `to`, at `points` points (default 200). The expressions can use the inputs and the outputs that have an `id`. `x` must be a name that isn't an input or output.

### formula

An equation the user can solve for any one of its variables, with a menu of units for each. This is the format the formula library uses.

```json
{ "type": "formula", "title": "Thin lens", "tex": "\\frac1f=\\frac1{s_o}+\\frac1{s_i}", "eq": "1/f=1/so+1/si",
  "vars": [
    { "name": "f", "desc": "focal length", "unit": "m" },
    { "name": "so", "desc": "object distance", "unit": "m" },
    { "name": "si", "desc": "image distance", "unit": "m" },
    { "name": "n", "desc": "index", "unit": "", "default": "1" }
  ] }
```

`eq` has exactly one `=`. Write each variable's `unit` in SI, or in the unit the equation expects. The solver starts every unit menu on **units**, which uses the numbers as typed, and offers the units of the same kind. Angles (unit `rad`) follow the calculator's angle mode unless the user picks a unit. A variable can also be written as an array, `["f", "focal length", "m", ""]`.

### table

```json
{ "type": "table", "title": "Number drills", "columns": ["Drill", "Inch", "mm"],
  "rows": [["#1", ".2280", "5.791"], ["#2", ".2210", "5.613"]],
  "near": [ { "col": 1, "label": "inches" }, { "col": 2, "label": "mm" } ] }
```

Typing in the search box filters the rows. With `near`, typing a number instead lists the 12 rows whose value in that column is closest, nearest first. With more than one entry, chips let the user choose the column. Cells are text.

### constants

```json
{ "type": "constants", "title": "Wavelengths", "items": [
  { "name": "HeNe laser (vacuum)", "symbol": "\\lambda_{HeNe}", "value": "632.991e-9", "unit": "m", "note": "632.816 nm in air" },
  { "name": "Fused silica", "symbol": "n_{FS}(\\lambda)", "sellmeier": [0.6961663, 0.004679148, 0.4079426, 0.01351206, 0.8974794, 97.934] }
] }
```

Tapping a constant shows it in other units and can store it in a CAS variable. `value` is a number, or a band `[a, b]`. `sellmeier` gives Sellmeier coefficients B₁ C₁ B₂ C₂ …, with λ in µm.

### text

```json
{ "type": "text", "title": "Conventions", "md": "- Wavelengths are **vacuum** wavelengths.\n- See [the guide](https://example.org/guide)." }
```

Markdown: headings, **bold**, *italic*, lists, tables, `code`, code blocks, quotes and links. Links must start with `https://` or be `#anchors`, and open in the browser. HTML is not shown. Text items appear as cards in the section.

### tool

```json
{ "type": "tool", "tool": "optics.beam", "note": "Follow a beam through lenses." }
```

Opens a tool that is built into CalcShelf:

| `tool` | Tool |
|---|---|
| `optics.linewidth` | Δν ↔ Δλ and photon equivalents |
| `optics.beam` | Gaussian beam through lenses and space (ABCD) |
| `optics.dispersion` | Material dispersion from Sellmeier data |
| `optics.etalon` | Fabry–Pérot etalon |
| `optics.thinfilm` | Thin-film stack |
| `trig.triangle` | Triangle solver |
| `convert.units` | Unit conversion |

### link

```json
{ "type": "link", "title": "Machinery’s Handbook", "url": "https://example.org" }
```

Opens an `https://` page in the browser.

## Expressions

Expressions are Giac, the CAS that CalcShelf runs, and are written as you would type them in the CAS: `12*Vc/(pi*D)`, `sqrt(x^2+y^2)`, `atan(h/L)`, `round(x*64)/64`, `seq([k, cos(2*pi*k/N)], k, 1, N)`.

Useful functions include `sqrt`, `exp`, `ln`, `log10`, `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `abs`, `round`, `floor`, `ceil`, `min`, `max`, `seq`, `sum` and `piecewise`. `pi` and `e` are built in.

To keep modules safe, an expression may only use letters, digits, spaces and `. , + - * / ^ ( ) [ ] < > ! | '`. Before CalcShelf runs an expression, it refuses:

- assignment and storing (`:=`, `=>`), and `=` anywhere except in a formula's `eq`;
- strings, and building code from text (`expr`, `eval`, `string`, `parse`);
- programs and loops (`local`, `for`, `while`, `prog` …);
- commands that change the CAS or its settings (`purge`, `restart`, `reset`, `assume`, `angle_radian`, `Digits` …);
- input, output and files (`Input`, `Disp`, `read`, `write`, `system` …).

The full list is `BLOCKED` in [`app/www/js/modules.js`](../app/www/js/modules.js). A calculation that takes more than 10 seconds is stopped. Inputs and outputs are given private names in the CAS, so a module can't overwrite your variables.

## Units

Use CalcShelf's unit names, as in the conversion tool: `m`, `mm`, `µm`, `nm`, `in`, `ft`, `thou`, `s`, `min`, `Hz`, `THz`, `rpm`, `W`, `mW`, `eV`, `J`, `N`, `lbf`, `Pa`, `psi`, `K`, `°C`, `°`, `rad`, `mrad`, `kg`, `lb`, and combinations such as `ft/min`, `in/min`, `W/m²`, `ps/(nm·km)`, `in³/min`.

A unit CalcShelf doesn't know (`dBm`, `%`, `TPI`) is shown as a label without conversion. Every unit in a `units` list must be the same kind as `unit`; any that can't be converted are left out of the menu.

## Check your module

Import it into CalcShelf. If something is wrong, CalcShelf says which section and item, and why.

To check modules from the command line, use the repository's build script. It checks every module with the same code the app uses:

```
node core-build/modules/build.js
```

The built-in modules are generated from `core-build/modules/*.js`. The Optics module takes its formulas and constants from `app/www/data/formulas.js` and `data/constants.js`, so it stays in step with the Constants & formulas library.

## Limits

| | Limit |
|---|---|
| File size | 4 MB |
| Sections | 60 |
| Items in all | 2000 |
| Table rows | 10 000 (600 shown at once; search to narrow) |
| Table columns | 16 |
| Calculator inputs, formula variables | 24 |
| Calculator outputs | 24 |
| Expression length | 4000 characters |
| Text item | 40 000 characters |

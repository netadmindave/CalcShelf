# CalcShelf modules

Modules add a tab to CalcShelf for one subject. Each one is a single `.json` file that holds data only: formulas, calculators, tables, constants and reference text. CalcShelf checks a module before installing it, and a module can't run code or reach the internet.

## Install a module on your phone

1. Long-press the module's **Download** link below and choose **Download link**. Or open the file, tap **Raw**, and use your browser's **Download** command.
2. In CalcShelf, tap **+** → **Manage modules…** → **Import a module file…**, and pick the downloaded file.
3. Check the name and contents, then tap **Install**.

## Modules

| Module | Version | What it has | Download |
|---|---|---|---|
| **Optics** (built into CalcShelf) | 1.1.0 | Light and photons, geometric optics, diffraction, Gaussian beams, cavities and thin films, fibers, frequency combs, detection, materials and data, plus formulas following Saleh & Teich’s *Fundamentals of Photonics* and Neamen’s *Semiconductor Physics and Devices*; 302 formulas, 9 calculators, the five optics tools | [optics.json](https://raw.githubusercontent.com/netadmindave/CalcShelf/main/modules/optics.json) |
| **Machinist** (built into CalcShelf) | 1.0.0 | Speeds and feeds; thread pitch, tap drills (unified, metric, NPT), thread dimensions and three-wire measurement; number, letter, fractional and metric drills; clearance holes; shop math; G and M codes | [machinist.json](https://raw.githubusercontent.com/netadmindave/CalcShelf/main/modules/machinist.json) |
| **Example module** | 1.0.0 | One of each kind of item. Copy it to start your own module | [example.json](https://raw.githubusercontent.com/netadmindave/CalcShelf/main/modules/example.json) |

The built-in modules are listed here so you can see what they hold and restore them. You don't need to install them.

`index.json` lists the modules in this folder for tools that read it.

## Make a module

See [docs/MODULES.md](../docs/MODULES.md) for the file format, every kind of item, and the rules for expressions. To add your module here, open a pull request that adds its `.json` file to this folder and a row to the table above.

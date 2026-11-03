# CalcShelf modules

Modules add a tab to CalcShelf for one subject. Each one is a single `.json` file that holds data only: formulas, calculators, tables, constants and reference text. CalcShelf checks a module before installing it, and a module can't run code or reach the internet.

## Install a module on your phone

1. Long-press the module's **Download** link below and choose **Download link**. Or open the file, tap **Raw**, and use your browser's **Download** command.
2. In CalcShelf, tap **+** → **Manage modules…** → **Import a module file…**, and pick the downloaded file.
3. Check the name and contents, then tap **Install**.

## Modules

| Module | Version | What it has | Download |
|---|---|---|---|
| **Optics** (built into CalcShelf) | 1.2.0 | Light and photons, geometric optics, diffraction, Gaussian beams, cavities and thin films, fibers, frequency combs, detection, materials and data, plus formulas following Saleh & Teich’s *Fundamentals of Photonics* and Neamen’s *Semiconductor Physics and Devices*; 331 formulas, 9 calculators, the five optics tools | [optics.json](https://raw.githubusercontent.com/netadmindave/CalcShelf/main/modules/optics.json) |
| **Machinist** (built into CalcShelf) | 1.1.0 | Speeds and feeds; thread pitch, tap drills (unified, metric, NPT), thread dimensions and three-wire measurement; number, letter, fractional and metric drills; clearance holes; shop math; G and M codes | [machinist.json](https://raw.githubusercontent.com/netadmindave/CalcShelf/main/modules/machinist.json) |
| **Periodic Table** (built into CalcShelf) | 1.0.0 | A landscape periodic table, all 118 elements with their data and isotopes, molar masses, and chemistry formulas | [periodic.json](https://raw.githubusercontent.com/netadmindave/CalcShelf/main/modules/periodic.json) |
| **Computer Science** (built into CalcShelf) | 1.1.0 | IPv4 and IPv6 subnet calculators (VLSM, summaries); storage in bits, bytes, kB/KiB, MB/MiB, GB/GiB, TB/TiB; data rates and transfer times; RAID and ZFS layouts with capacity, efficiency and relative speed; bitwise operations and two's complement; CIDR, ports, ASCII, powers of 2, integer and float formats, complexity and HTTP tables; formulas | [compsci.json](https://raw.githubusercontent.com/netadmindave/CalcShelf/main/modules/compsci.json) |
| **Example module** | 1.0.0 | One of each kind of item. Copy it to start your own module | [example.json](https://raw.githubusercontent.com/netadmindave/CalcShelf/main/modules/example.json) |

The built-in modules are listed here so you can see what they hold and restore them. You don't need to install them.

`index.json` lists the modules in this folder for tools that read it.

## Make a module

See [docs/MODULES.md](../docs/MODULES.md) for the file format, every kind of item, and the rules for expressions. To add your module here, open a pull request that adds its `.json` file to this folder and a row to the table above.

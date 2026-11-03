// The Periodic Table module: element data (in its "Elements" and "Isotopes" tables) for the built-in periodic-table
// view (chem.periodic), and chemistry formulas for the Variable Solver.
// Data: PubChem's periodic table (NCBI, public domain) via the periodic-table-data package (MIT); group, period,
// block, category, shells, ionization energies, molar heat, discovery from the PIE periodic-table tool data (MIT);
// van der Waals radii and bonding type from the periodic-table package (ISC); isotope masses and natural abundances
// from cheminfo's chemical-elements package (MIT). See CREDITS.md.
const fs = require('fs'), path = require('path');
module.exports = () => {
  const E = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'elements.json'), 'utf8'));
  const s = (v) => (v == null || v === '' ? '' : String(v));
  const COLS = ['Z', 'Symbol', 'Name', 'Atomic mass (u)', 'Group', 'Period', 'Block', 'Category', 'Electron configuration', 'Electrons per shell',
    'Electronegativity (Pauling)', 'Atomic radius (pm)', 'Van der Waals radius (pm)', 'First ionization energy (eV)', 'Ionization energies (kJ/mol)',
    'Electron affinity (eV)', 'Oxidation states', 'State at 25 °C', 'Melting point (K)', 'Boiling point (K)', 'Density (g/cm³)', 'Molar heat capacity (J/(mol·K))',
    'Discovered', 'Discovered by', 'Named by', 'Bonding', 'Monoisotopic mass (u)', 'Colour', 'x', 'y'];
  const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
  const rows = E.map((e) => [s(e.z), e.sym, e.name, s(e.mass), s(e.group), s(e.period), s(e.block), cap(s(e.category)), s(e.config), (e.shells || []).join(', '),
    s(e.en), s(e.radius), s(e.vdw), s(e.ie1), (e.ies || []).join(', '), s(e.ea), s(e.ox), s(e.state), s(e.melt), s(e.boil), s(e.density), s(e.heat),
    s(e.year), s(e.by), s(e.named), cap(s(e.bonding)), s(e.mono), s(e.color), s(e.x), s(e.y)]);
  const iso = [];
  for (const e of E) for (const [A, m, ab] of e.iso || []) iso.push([s(e.z), e.sym, s(A), s(m), ab == null ? '' : String(+(ab * 100).toPrecision(8))]);
  const F = (title, tex, eq, vars, note) => ({ type: 'formula', title, tex, eq, vars, note: note || '' });
  return {
    format: 'calcshelf-module', formatVersion: 1,
    id: 'periodic', name: 'Periodic Table', tab: 'Elements', version: '1.0.0', icon: 'atom', main: 'chem.periodic',
    author: 'CalcShelf', license: 'GPL-3.0-or-later (data: public domain and MIT, see About)',
    homepage: 'https://github.com/netadmindave/CalcShelf',
    description: 'All 118 elements: tap one for its mass, configuration, electronegativity, radii, ionization energies, melting and boiling points, density, discovery and isotopes. Colour the table by category, block, state or a property, and work out the molar mass of a formula.',
    variables: [
      { id: 'nmol', symbol: 'n', name: 'Amount of substance', description: 'Number of moles.', unit: 'mol', names: ['nm'] },
      { id: 'Mmol', symbol: 'M', name: 'Molar mass', description: 'Mass per mole: the atomic or formula mass in g/mol.', unit: 'kg/mol', names: ['M'] },
      { id: 'mchem', symbol: 'm', name: 'Mass of substance', description: 'Mass of the sample.', unit: 'kg', names: ['m'] },
      { id: 'cmol', symbol: 'c', name: 'Molar concentration', description: 'Moles per volume (molarity).', unit: 'mol/m^3', also: 'molarity', names: ['cm'] },
      { id: 'Vsol', symbol: 'V', name: 'Solution or gas volume', description: 'Volume of the solution or gas.', unit: 'm^3', names: ['V'] },
      { id: 'Nat', symbol: 'N', name: 'Number of particles', description: 'Number of atoms or molecules.', unit: '', names: ['N'] },
      { id: 'NAv', symbol: 'N_A', name: 'Avogadro constant', description: 'Particles per mole (exact).', unit: '1/mol', value: 6.02214076e23, names: ['NAv'] },
      { id: 'Pgas', symbol: 'P', name: 'Gas pressure', description: 'Pressure of the gas.', unit: 'Pa', names: ['P'] },
    ],
    sections: [
      { title: 'Elements', items: [{ type: 'table', title: 'Elements', columns: COLS, rows, near: [{ col: 3, label: 'mass' }], note: 'Tap the table view (the first chip) for the periodic table. Masses in u (= g/mol); temperatures in kelvin.' }] },
      { title: 'Isotopes', items: [{ type: 'table', title: 'Isotopes', columns: ['Z', 'Element', 'Mass number A', 'Mass (u)', 'Natural abundance (%)'], rows: iso, near: [{ col: 3, label: 'mass' }] }] },
      { title: 'Formulas', items: [
        F('Amount from mass', 'n=\\frac{m}{M}', 'nm=m/M', [['nm', 'amount', 'mol', '', 'nmol'], ['m', 'mass', 'g', '', 'mchem'], ['M', 'molar mass', 'g/mol', '', 'Mmol']]),
        F('Number of particles', 'N=nN_A', 'N=nm*NAv', [['N', 'number of particles', '', '', 'Nat'], ['nm', 'amount', 'mol', '', 'nmol'], ['NAv', 'Avogadro constant', '1/mol', '6.02214076e23', 'NAv']]),
        F('Molar concentration', 'c=\\frac{n}{V}', 'cm=nm/V', [['cm', 'concentration', 'mol/L', '', 'cmol'], ['nm', 'amount', 'mol', '', 'nmol'], ['V', 'volume', 'L', '', 'Vsol']]),
        F('Ideal gas law', 'PV=nRT', 'P*V=nm*R*T', [['P', 'pressure', 'Pa', '', 'Pgas'], ['V', 'volume', 'm³', '', 'Vsol'], ['nm', 'amount', 'mol', '', 'nmol'], ['R', 'gas constant', 'J/(mol·K)', '8.314462618', 'Rgas'], ['T', 'temperature', 'K', '', 'T']]),
        F('Dilution', 'c_1V_1=c_2V_2', 'c1*V1=c2*V2', [['c1', 'starting concentration', 'mol/L'], ['V1', 'starting volume', 'L'], ['c2', 'final concentration', 'mol/L'], ['V2', 'final volume', 'L']]),
        F('Mass fraction of an element', 'w=\\frac{k\\,A_r}{M}', 'w=k*Ar/M', [['w', 'mass fraction', ''], ['k', 'atoms of the element per formula unit', ''], ['Ar', 'atomic mass of the element', 'g/mol'], ['M', 'molar mass', 'g/mol', '', 'Mmol']]),
      ] },
      { title: 'About', items: [{ type: 'text', title: 'Where the data comes from', md: [
        '- **Masses, configurations, electronegativity, atomic radius, first ionization energy, electron affinity, oxidation states, state, melting and boiling points, density, year of discovery:** PubChem’s periodic table (NCBI, U.S. National Library of Medicine; public domain), through the `periodic-table-data` package (MIT).',
        '- **Group, period, block, category, electrons per shell, all ionization energies, molar heat capacity, discoverer and namer:** the data of the PIE periodic-table tool (`@pie-players/pie-tool-periodic-table`, MIT).',
        '- **Van der Waals radii and bonding type:** the `periodic-table` package (ISC).',
        '- **Isotope masses and natural abundances:** cheminfo’s `chemical-elements` package (MIT).',
        '',
        'Values for the heaviest elements are predictions. Check critical numbers against a primary reference (NIST, IUPAC, CRC Handbook).',
      ].join('\n') }] },
    ],
  };
};

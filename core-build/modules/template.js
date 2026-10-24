// A small module that uses every kind of item: copy it to start your own. Described in docs/MODULES.md.
module.exports = function template() {
  return {
    format: 'calcshelf-module', formatVersion: 1,
    id: 'example', name: 'Example module', tab: 'Example', version: '1.0.0', icon: 'book',
    author: 'Your name', license: 'CC0-1.0', homepage: 'https://github.com/netadmindave/CalcShelf/blob/main/docs/MODULES.md',
    description: 'One of each kind of item a CalcShelf module can hold. Copy this file to start your own module.',
    sections: [
      { title: 'Calculators', items: [
        { type: 'calc', title: 'Ohm’s law and power', tex: 'I=\\frac VR,\\ P=VI',
          note: 'Inputs and outputs can offer units; CalcShelf converts them.',
          inputs: [
            { id: 'V', label: 'Voltage', unit: 'V', default: '12', units: ['V', 'mV', 'kV'] },
            { id: 'R', label: 'Resistance', unit: 'Ω', default: '470', units: ['Ω', 'kΩ', 'MΩ'] }],
          outputs: [
            { id: 'I', label: 'Current', expr: 'V/R', unit: 'A', units: ['A', 'mA', 'µA'] },
            { label: 'Power', expr: 'V*I', unit: 'W', units: ['W', 'mW'] }] },
        { type: 'calc', title: 'Damped oscillation', tex: 'y=Ae^{-t/\\tau}\\cos(2\\pi ft)',
          inputs: [
            { id: 'A', label: 'Amplitude A', default: '1' },
            { id: 'tau', label: 'Decay time τ', unit: 's', default: '0.5' },
            { id: 'f', label: 'Frequency', unit: 'Hz', default: '5', units: ['Hz', 'kHz'] }],
          outputs: [{ label: 'Value at t = τ', expr: 'A*exp(-1)*cos(2*pi*f*tau)' }],
          plot: { expr: 'A*exp(-t/tau)*cos(2*pi*f*t)', x: 't', from: '0', to: '4*tau', points: 300, xlabel: 't (s)', ylabel: 'y' } },
        { type: 'calc', title: 'A choice from a list', inputs: [
            { id: 'g', label: 'Planet', options: [{ label: 'Earth', value: '9.80665' }, { label: 'Moon', value: '1.62' }, { label: 'Mars', value: '3.721' }], default: 0 },
            { id: 'm', label: 'Mass', unit: 'kg', default: '70', units: ['kg', 'lb'] }],
          outputs: [{ label: 'Weight', expr: 'm*g', unit: 'N', units: ['N', 'lbf'] }] },
      ] },
      { title: 'Formulas', items: [
        { type: 'formula', title: 'Kinetic energy', tex: 'E=\\tfrac12mv^2', eq: 'E=m*v^2/2',
          vars: [{ name: 'E', desc: 'kinetic energy', unit: 'J' }, { name: 'm', desc: 'mass', unit: 'kg' }, { name: 'v', desc: 'speed', unit: 'm/s' }],
          note: 'Solves for whichever variable you pick.' },
      ] },
      { title: 'Data', items: [
        { type: 'table', title: 'A table you can search', columns: ['Item', 'Value (mm)', 'Value (in)'],
          rows: [['Small', '1.00', '.0394'], ['Medium', '2.50', '.0984'], ['Large', '5.00', '.1969']],
          near: [{ col: 1, label: 'mm' }], note: 'Type a number to find the nearest row.' },
        { type: 'constants', title: 'Constants', items: [{ name: 'Standard gravity', symbol: 'g_n', value: '9.80665', unit: 'm/s²', note: 'exact' }] },
        { type: 'tool', tool: 'convert.units', note: 'Modules can open the tools built into CalcShelf.' },
        { type: 'link', title: 'How to make a module', url: 'https://github.com/netadmindave/CalcShelf/blob/main/docs/MODULES.md' },
        { type: 'text', title: 'Reference text', md: 'Text uses **Markdown**: lists, tables, `code` and [https links](https://github.com/netadmindave/CalcShelf).\n\n- One\n- Two' },
      ] },
    ],
  };
};

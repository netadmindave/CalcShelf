// The Optics module: every optics formula and constant CalcShelf has, the optics tools, a few calculators and reference.
// Built by build.js from data/formulas.js and data/constants.js, so the module and the Constants & formulas library agree.
module.exports = function optics({ FORMULAS, CONSTANTS }) {
  const formulas = (cat) => FORMULAS.filter((f) => f.cat === cat).map((f) => ({ type: 'formula', title: f.n, tex: f.tex, eq: f.eq, vars: f.v.map((v) => v.slice(0, 4).map((x) => (x == null ? '' : String(x)))), note: f.note || '', tags: f.cat }));
  const consts = (cat, title, note) => {
    const g = CONSTANTS.find((c) => c.cat === cat);
    return { type: 'constants', title: title || cat.replace(/^Optics: /, ''), note: note || g.note || '', items: g.items.map((c) => (c.sell ? { name: c.n, symbol: c.s, sellmeier: c.sell, note: c.note || '' } : { name: c.n, symbol: c.s, value: String(c.v), unit: c.u || '', note: c.note || '' })) };
  };
  const tool = (t, note) => ({ type: 'tool', tool: t, note: note || '' });
  const text = (title, md) => ({ type: 'text', title, md });

  return {
    format: 'calcshelf-module', formatVersion: 1,
    id: 'optics', name: 'Optics', tab: 'Optics', version: '1.1.0', icon: 'optics',
    author: 'CalcShelf', license: 'GPL-3.0-or-later', homepage: 'https://github.com/netadmindave/CalcShelf/tree/main/modules',
    description: 'Optics and photonics: light and photons, geometric optics, diffraction, Gaussian beams, cavities and etalons, fibers, frequency combs, detection and materials, with the optics tools and material data. Version 1.1 adds formulas following Saleh & Teich’s Fundamentals of Photonics (rays to ultrafast optics) and Neamen’s Semiconductor Physics and Devices (carriers, junctions, transistors, optical devices). Every formula solves for any of its variables.',
    sections: [
      { title: 'Light & photons', items: [
        { type: 'calc', title: 'Wavelength, frequency and photon energy', tex: '\\nu=\\frac c\\lambda,\\ E=h\\nu,\\ \\tilde\\nu=\\frac1\\lambda',
          note: 'Vacuum wavelength. Change the units of any value with its menu.',
          inputs: [{ id: 'lam', label: 'Vacuum wavelength λ', unit: 'nm', default: '1550', units: ['nm', 'µm', 'pm', 'Å', 'm'] }],
          outputs: [
            { id: 'nu', label: 'Frequency ν', expr: '299792458/(lam*1e-9)/1e12', unit: 'THz', units: ['THz', 'GHz', 'PHz', 'Hz'], digits: 9 },
            { label: 'Photon energy E', expr: '6.62607015e-34*299792458/(lam*1e-9)/1.602176634e-19', unit: 'eV', units: ['eV', 'meV', 'J'], digits: 8 },
            { label: 'Wavenumber', expr: '1/(lam*1e-7)', unit: '1/cm', units: ['1/cm', '1/m', '1/µm'], digits: 8 },
            { label: 'Angular frequency ω', expr: '2*pi*299792458/(lam*1e-9)', unit: 'rad/s', digits: 8 },
            { label: 'Period', expr: 'lam*1e-9/299792458*1e15', unit: 'fs', units: ['fs', 'ps', 'as'], digits: 8 }] },
        tool('optics.linewidth', 'Convert a linewidth or bandwidth between wavelength, frequency, wavenumber and energy at a centre wavelength.'),
        { type: 'calc', title: 'Optical power: mW, dBm and photon flux', tex: 'P_{dBm}=10\\log_{10}\\frac{P}{1\\,\\mathrm{mW}}',
          inputs: [{ id: 'P', label: 'Power P', unit: 'mW', default: '1', units: ['mW', 'µW', 'nW', 'W'] }, { id: 'lam', label: 'Wavelength λ', unit: 'nm', default: '1550', units: ['nm', 'µm'] }],
          outputs: [{ label: 'Power', expr: '10*log10(P)', unit: 'dBm', digits: 6 }, { label: 'Photon flux', expr: 'P*1e-3*lam*1e-9/(6.62607015e-34*299792458)', unit: '1/s', digits: 6 }] },
        { type: 'calc', title: 'dBm to power', inputs: [{ id: 'd', label: 'Power', unit: 'dBm', default: '0' }],
          outputs: [{ label: 'Power', expr: '10^(d/10)', unit: 'mW', units: ['mW', 'µW', 'nW', 'W'], digits: 6 }] },
        ...formulas('Optics: light & photons'),
      ] },
      { title: 'Geometric', items: [...formulas('Optics: geometric'), ...formulas('Optics: interfaces')] },
      { title: 'Diffraction', items: formulas('Optics: diffraction') },
      { title: 'Gaussian beams', items: [
        { type: 'calc', title: 'Gaussian beam from its waist', tex: 'z_R=\\frac{\\pi w_0^2n}{M^2\\lambda},\\ w(z)=w_0\\sqrt{1+(z/z_R)^2}',
          note: 'The plot shows the 1/e² radius w(z) over ±3 Rayleigh ranges.',
          inputs: [
            { id: 'w0', label: 'Waist radius w₀ (1/e²)', unit: 'µm', default: '100', units: ['µm', 'mm', 'nm'] },
            { id: 'lam', label: 'Wavelength λ', unit: 'nm', default: '1550', units: ['nm', 'µm'] },
            { id: 'M2', label: 'Beam quality M²', default: '1' },
            { id: 'n', label: 'Index n', default: '1' },
            { id: 'z', label: 'Distance from the waist z', unit: 'mm', default: '100', units: ['mm', 'cm', 'm', 'µm'] }],
          outputs: [
            { id: 'zR', label: 'Rayleigh range z_R', expr: 'pi*(w0*1e-6)^2*n/(M2*lam*1e-9)*1e3', unit: 'mm', units: ['mm', 'cm', 'm', 'µm'] },
            { label: 'Beam radius w(z)', expr: 'w0*sqrt(1+(z/zR)^2)', unit: 'µm', units: ['µm', 'mm'] },
            { label: 'Wavefront radius R(z)', expr: 'z*(1+(zR/z)^2)', unit: 'mm', units: ['mm', 'm'] },
            { label: 'Gouy phase', expr: 'atan(z/zR)', unit: 'rad', units: ['rad', '°'] },
            { label: 'Far-field half-angle divergence', expr: 'M2*lam*1e-9/(pi*n*w0*1e-6)', unit: 'mrad', units: ['mrad', 'µrad', '°', 'rad'] },
            { label: 'Confocal parameter 2z_R', expr: '2*zR', unit: 'mm', units: ['mm', 'm'] }],
          plot: { expr: 'w0*sqrt(1+(zz/zR)^2)', x: 'zz', from: '-3*zR', to: '3*zR', xlabel: 'z (mm)', ylabel: 'w (µm)' } },
        { type: 'calc', title: 'Gaussian widths: 1/e², FWHM and 1/e', tex: '\\mathrm{FWHM}=w\\sqrt{2\\ln2}',
          note: 'For the intensity profile I ∝ exp(−2r²/w²). w is the 1/e² radius.',
          inputs: [{ id: 'w', label: '1/e² radius w', unit: 'µm', default: '100', units: ['µm', 'mm', 'nm'] }],
          outputs: [
            { label: '1/e² diameter', expr: '2*w', unit: 'µm', units: ['µm', 'mm'] },
            { label: 'FWHM diameter (intensity)', expr: 'w*sqrt(2*ln(2))', unit: 'µm', units: ['µm', 'mm'] },
            { label: '1/e radius (intensity)', expr: 'w/sqrt(2)', unit: 'µm', units: ['µm', 'mm'] },
            { label: 'Power inside radius w', expr: '100*(1-exp(-2))', unit: '%' }] },
        tool('optics.beam', 'Follow a Gaussian beam through lenses and free space with ABCD matrices.'),
        ...formulas('Optics: Gaussian beams'),
      ] },
      { title: 'Cavities & films', items: [
        tool('optics.etalon', 'Free spectral range, finesse, linewidth and the transmission of a Fabry–Pérot etalon.'),
        tool('optics.thinfilm', 'Reflectance and transmittance of a stack of thin films.'),
        { type: 'calc', title: 'Cavity from its length and mirrors', tex: '\\Delta\\nu_{FSR}=\\frac c{2nL},\\ \\mathcal F=\\frac{\\pi\\sqrt R}{1-R}',
          inputs: [
            { id: 'L', label: 'Cavity length L', unit: 'mm', default: '100', units: ['mm', 'cm', 'm', 'µm'] },
            { id: 'n', label: 'Index n (group index for a dispersive medium)', default: '1' },
            { id: 'R', label: 'Mirror reflectance R (both mirrors)', default: '0.99' },
            { id: 'lam', label: 'Wavelength λ', unit: 'nm', default: '1550', units: ['nm', 'µm'] }],
          outputs: [
            { id: 'FSR', label: 'Free spectral range', expr: '299792458/(2*n*L*1e-3)/1e6', unit: 'MHz', units: ['MHz', 'GHz', 'kHz', 'Hz'] },
            { id: 'F', label: 'Finesse', expr: 'pi*sqrt(R)/(1-R)' },
            { label: 'Linewidth (FWHM)', expr: 'FSR/F*1e3', unit: 'kHz', units: ['kHz', 'MHz', 'Hz'] },
            { label: 'Quality factor Q', expr: '299792458/(lam*1e-9)/(FSR*1e6/F)' },
            { label: 'Photon lifetime', expr: '-2*n*L*1e-3/(299792458*ln(R^2))*1e9', unit: 'ns', units: ['ns', 'µs', 'ps'] },
            { label: 'FSR in wavelength', expr: '(lam*1e-9)^2/(2*n*L*1e-3)*1e12', unit: 'pm', units: ['pm', 'nm'] }] },
        ...formulas('Optics: cavities'),
      ] },
      { title: 'Fibers', items: [
        { type: 'calc', title: 'Step-index fiber', tex: 'V=\\frac{2\\pi a}{\\lambda}NA',
          note: 'Single-mode when V < 2.405. The mode-field radius uses Marcuse’s fit, good for 1.2 < V < 2.4.',
          inputs: [
            { id: 'a', label: 'Core radius a', unit: 'µm', default: '4.1', units: ['µm', 'nm', 'mm'] },
            { id: 'NA', label: 'Numerical aperture NA', default: '0.12' },
            { id: 'lam', label: 'Wavelength λ', unit: 'nm', default: '1550', units: ['nm', 'µm'] }],
          outputs: [
            { id: 'V', label: 'V number', expr: '2*pi*a*1e-6*NA/(lam*1e-9)' },
            { label: 'Single-mode cutoff wavelength', expr: '2*pi*a*1e-6*NA/2.405*1e9', unit: 'nm', units: ['nm', 'µm'] },
            { label: 'Mode-field diameter (Marcuse)', expr: '2*a*(0.65+1.619/V^1.5+2.879/V^6)', unit: 'µm', units: ['µm', 'nm'] },
            { label: 'Approximate number of modes (V²/2)', expr: 'max(1,V^2/2)', digits: 3 },
            { label: 'Acceptance half-angle in air', expr: 'asin(NA)', unit: 'rad', units: ['°', 'rad', 'mrad'] }] },
        { type: 'calc', title: 'Fiber link loss and dispersion', tex: 'P_{out}=P_{in}-\\alpha L,\\ \\Delta\\tau=DL\\Delta\\lambda',
          inputs: [
            { id: 'Pin', label: 'Launched power', unit: 'dBm', default: '0' },
            { id: 'adb', label: 'Attenuation', unit: 'dB/km', default: '0.2' },
            { id: 'L', label: 'Length', unit: 'km', default: '50', units: ['km', 'm'] },
            { id: 'D', label: 'Dispersion', unit: 'ps/(nm·km)', default: '17' },
            { id: 'dl', label: 'Source bandwidth Δλ', unit: 'nm', default: '0.1', units: ['nm', 'pm'] }],
          outputs: [
            { id: 'Pout', label: 'Received power', expr: 'Pin-adb*L', unit: 'dBm' },
            { label: 'Received power', expr: '10^((Pin-adb*L)/10)', unit: 'mW', units: ['mW', 'µW', 'nW'] },
            { label: 'Pulse broadening', expr: 'D*L*dl', unit: 'ps', units: ['ps', 'ns', 'fs'] }] },
        ...formulas('Optics: fibers'),
      ] },
      { title: 'Frequency combs', items: [
        { type: 'calc', title: 'Comb tooth and beat note', tex: '\\nu_n=nf_{rep}+f_{ceo},\\ f_b=\\nu-\\nu_n',
          note: 'Finds the comb tooth nearest a CW laser and the beat between them.',
          inputs: [
            { id: 'nu', label: 'CW laser frequency ν', unit: 'THz', default: '193.414', units: ['THz', 'GHz'] },
            { id: 'frep', label: 'Repetition rate', unit: 'MHz', default: '250', units: ['MHz', 'GHz', 'kHz'] },
            { id: 'fceo', label: 'Offset frequency f_ceo', unit: 'MHz', default: '20', units: ['MHz', 'kHz', 'GHz'] }],
          outputs: [
            { id: 'nn', label: 'Nearest tooth number n', expr: 'round((nu*1e12-fceo*1e6)/(frep*1e6))', format: 'exact' },
            { label: 'Tooth frequency', expr: '(nn*frep*1e6+fceo*1e6)/1e12', unit: 'THz', digits: 12 },
            { label: 'Beat with the CW laser (signed)', expr: '(nu*1e12-(nn*frep*1e6+fceo*1e6))/1e6', unit: 'MHz', units: ['MHz', 'kHz', 'GHz'], digits: 8 }] },
        ...formulas('Optics: frequency combs'),
      ] },
      { title: 'Detection', items: formulas('Optics: detection') },
      { title: 'Materials', items: [
        tool('optics.dispersion', 'Index, group index, GVD and the dispersion parameter of a glass from its Sellmeier data.'),
        ...formulas('Optics: materials'),
        consts('Optics: Sellmeier', 'Sellmeier data'),
        consts('Optics: refractive index', 'Refractive indices'),
        consts('Optics: dn/dT & expansion', 'dn/dT and thermal expansion'),
      ] },
      ...require('./optics_books')(),
      { title: 'Data', items: [
        consts('Optics: wavelengths', 'Laser and reference wavelengths'),
        { type: 'table', title: 'Telecom bands (ITU)', columns: ['Band', 'Name', 'From (nm)', 'To (nm)', 'From (THz)', 'To (THz)'],
          rows: [['O', 'Original', 1260, 1360], ['E', 'Extended', 1360, 1460], ['S', 'Short', 1460, 1530], ['C', 'Conventional', 1530, 1565], ['L', 'Long', 1565, 1625], ['U', 'Ultra-long', 1625, 1675]]
            .map(([b, n, a, z]) => [b, n, String(a), String(z), (299792.458 / a).toFixed(2), (299792.458 / z).toFixed(2)]),
          near: [{ col: 2, label: 'nm' }] },
        { type: 'table', title: 'Spectral regions', columns: ['Region', 'Wavelength', 'Photon energy'],
          rows: [['UV-C', '100–280 nm', '12.4–4.43 eV'], ['UV-B', '280–315 nm', '4.43–3.94 eV'], ['UV-A', '315–400 nm', '3.94–3.10 eV'], ['Violet', '380–450 nm', '3.26–2.76 eV'], ['Blue', '450–495 nm', '2.76–2.50 eV'], ['Green', '495–570 nm', '2.50–2.18 eV'], ['Yellow', '570–590 nm', '2.18–2.10 eV'], ['Orange', '590–620 nm', '2.10–2.00 eV'], ['Red', '620–750 nm', '2.00–1.65 eV'], ['Near IR (IR-A)', '0.75–1.4 µm', '1.65–0.886 eV'], ['Short-wave IR (IR-B)', '1.4–3 µm', '0.886–0.413 eV'], ['Mid IR', '3–8 µm', '413–155 meV'], ['Long-wave IR', '8–15 µm', '155–82.7 meV'], ['Far IR', '15–1000 µm', '82.7–1.24 meV']],
          note: 'Colour and IR boundaries are conventions and vary between sources; the UV and IR-A/B bands are the CIE ones.' },
      ] },
      { title: 'Reference', items: [
        text('Conventions used here', [
          '- **Wavelengths** are vacuum wavelengths unless a formula says otherwise. Air at 1550 nm shifts them by about 0.027 %.',
          '- **Gaussian beam sizes** are 1/e² intensity radii w. FWHM = w·√(2 ln 2) ≈ 1.177 w.',
          '- **Thin lenses** use the real-is-positive convention: 1/f = 1/s_o + 1/s_i, with a real image at positive s_i.',
          '- **Reflectance and transmittance** are fractions from 0 to 1 unless the unit says %.',
          '- **Angles** follow the calculator’s angle mode in the formula solver, or the unit you pick. Calculators in this module set their own.',
          '- **dB** values are power ratios: 10·log₁₀(P₂/P₁). dBm is relative to 1 mW.',
        ].join('\n')),
        text('Handy numbers', [
          '| Quantity | Value |',
          '|---|---|',
          '| hc | 1239.842 eV·nm |',
          '| c / 1550 nm | 193.414 THz |',
          '| 1 nm at 1550 nm | ≈ 124.8 GHz |',
          '| 1 GHz at 1550 nm | ≈ 8.01 pm |',
          '| 1 cm⁻¹ | 29.979 GHz, 0.12398 meV |',
          '| kT at 295 K | 25.4 meV |',
          '| Shot noise, 1 mA in 1 Hz | 17.9 pA/√Hz |',
          '| Gaussian time-bandwidth (transform limit) | 0.441 |',
          '| sech² time-bandwidth (transform limit) | 0.315 |',
        ].join('\n')),
      ] },
    ],
  };
};
